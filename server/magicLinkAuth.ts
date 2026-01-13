import { Resend } from "resend";
import { randomBytes } from "crypto";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { magicLinkTokens, authorizedUsers } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { storage } from "./storage";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set for session storage");
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
  }

  const sessionStore = new pgStore({
    conString: connectionString,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

async function sendMagicLinkEmail(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const magicLink = `${appUrl}/api/auth/verify?token=${token}`;
  const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

  console.log("[MagicLink] Attempting to send email to:", email, "from:", emailFrom);
  console.log("[MagicLink] Magic link:", magicLink);

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: "Sign in to GenaAI",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sign in to GenaAI</h2>
          <p>Click the button below to sign in. This link expires in 15 minutes.</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Sign In
          </a>
          <p style="color: #666; font-size: 14px;">
            If you didn't request this email, you can safely ignore it.
          </p>
          <p style="color: #999; font-size: 12px;">
            Or copy this link: ${magicLink}
          </p>
        </div>
      `,
    });
    console.log("[MagicLink] Email sent successfully:", result);
    return { success: true };
  } catch (error: any) {
    console.error("[MagicLink] Failed to send email:", error);
    const errorMessage = error?.message || error?.toString() || "Unknown error";
    return { success: false, error: errorMessage };
  }
}

async function createMagicLinkToken(email: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(magicLinkTokens).values({
    email: email.toLowerCase(),
    token,
    expiresAt,
  });

  return token;
}

async function verifyAndConsumeToken(token: string): Promise<string | null> {
  const now = new Date();

  const result = await db
    .select()
    .from(magicLinkTokens)
    .where(
      and(
        eq(magicLinkTokens.token, token),
        gt(magicLinkTokens.expiresAt, now),
        isNull(magicLinkTokens.usedAt)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const tokenRecord = result[0];

  // Mark token as used
  await db
    .update(magicLinkTokens)
    .set({ usedAt: now })
    .where(eq(magicLinkTokens.id, tokenRecord.id));

  return tokenRecord.email;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Request magic link
  app.post("/api/auth/magic-link", async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user is authorized (coach in authorized_users OR client in clients table)
    // Bootstrap: if no authorized users exist, allow anyone
    const allUsers = await storage.getAllAuthorizedUsers();
    if (allUsers.length > 0) {
      const authorizedUser = await storage.getAuthorizedUserByEmail(normalizedEmail);
      const clientUser = await storage.getClientByEmail(normalizedEmail);
      if (!authorizedUser && !clientUser) {
        // Still send success to prevent email enumeration
        console.log("[MagicLink] Unauthorized email attempted login:", normalizedEmail);
        return res.json({ success: true, message: "If this email is registered, you will receive a sign-in link." });
      }
    }

    const token = await createMagicLinkToken(normalizedEmail);
    const result = await sendMagicLinkEmail(normalizedEmail, token);

    if (!result.success) {
      console.error("[MagicLink] Email send failed for:", normalizedEmail, "Error:", result.error);
      return res.status(500).json({ error: `Failed to send email: ${result.error}` });
    }

    console.log("[MagicLink] Sent magic link to:", normalizedEmail);
    res.json({ success: true, message: "If this email is registered, you will receive a sign-in link." });
  });

  // Verify magic link token
  app.get("/api/auth/verify", async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.redirect("/?error=invalid_token");
    }

    const email = await verifyAndConsumeToken(token);

    if (!email) {
      return res.redirect("/?error=expired_token");
    }

    // Bootstrap mode: if no authorized users exist, create the first user as admin
    const allUsers = await storage.getAllAuthorizedUsers();
    if (allUsers.length === 0) {
      console.log("[MagicLink] No authorized users exist - bootstrapping first user as admin:", email);
      await storage.createAuthorizedUser(email, "admin");
    }

    // Check if user is a coach (authorized_user) or a client
    const authorizedUser = await storage.getAuthorizedUserByEmail(email);
    const clientUser = await storage.getClientByEmail(email);

    if (!authorizedUser && !clientUser) {
      return res.redirect("/unauthorized");
    }

    // Update last login for coaches
    if (authorizedUser) {
      await storage.updateAuthorizedUserLastLogin(email);
    }

    // Check if user already exists by email, if not create one (for coaches)
    if (authorizedUser) {
      const existingUser = await storage.getUser(email);
      if (!existingUser) {
        // Check if there's a user with this email but different ID (from Replit migration)
        const { db } = await import("./db");
        const { users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const [userByEmail] = await db.select().from(users).where(eq(users.email, email));

        if (!userByEmail) {
          // No user exists at all, create one
          await storage.upsertUser({
            id: email,
            email,
            firstName: null,
            lastName: null,
            profileImageUrl: null,
          });
        }
        // If userByEmail exists, user is already in the system via migration
      }
    }

    // Create session - different roles for coaches vs clients
    const userRole = authorizedUser ? authorizedUser.role : "client";
    const clientId = clientUser ? clientUser.id : null;

    (req.session as any).user = {
      email,
      role: userRole,
      clientId, // Only set for client logins
    };

    console.log("[MagicLink] User logged in:", email, "role:", userRole);

    // Redirect clients to their portal, coaches to dashboard
    if (clientUser && !authorizedUser) {
      res.redirect(`/client/${clientUser.id}`);
    } else {
      res.redirect("/");
    }
  });

  // Logout
  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[MagicLink] Logout error:", err);
      }
      res.redirect("/");
    });
  });

  // Login page redirect (for compatibility)
  app.get("/api/login", (_req, res) => {
    res.redirect("/?showLogin=true");
  });

  // Client login - store returnTo and redirect to login
  app.get("/api/client/login", (req, res) => {
    const returnTo = req.query.returnTo as string;
    if (returnTo) {
      (req.session as any).clientReturnTo = returnTo;
    }
    res.redirect("/?showLogin=true&client=true");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = req.session as any;

  if (!session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Verify user is still authorized
  const authorizedUser = await storage.getAuthorizedUserByEmail(session.user.email);
  if (!authorizedUser) {
    return res.status(403).json({ message: "Not authorized to access this application" });
  }

  // Attach user info to request for route handlers
  (req as any).user = {
    claims: {
      sub: session.user.email,
      email: session.user.email,
    },
  };

  next();
};

export const isClientAuthenticated: RequestHandler = async (req, res, next) => {
  const session = req.session as any;

  if (!session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Attach user info to request
  (req as any).user = {
    claims: {
      sub: session.user.email,
      email: session.user.email,
    },
  };

  next();
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const session = req.session as any;

  if (!session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const authorizedUser = await storage.getAuthorizedUserByEmail(session.user.email);
  if (!authorizedUser || authorizedUser.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

export const verifyClientAccess = (getClientId: (req: any) => string | undefined): RequestHandler => {
  return async (req, res, next) => {
    const session = req.session as any;
    const clientId = getClientId(req);

    if (!clientId) {
      return res.status(400).json({ message: "Client ID required" });
    }

    if (!session.user?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userEmail = session.user.email.toLowerCase();

    // PATH A: Check if user is a coach (in authorized_users allowlist)
    const authorizedUser = await storage.getAuthorizedUserByEmail(userEmail);
    if (authorizedUser) {
      // User is a coach - allow access to any client data
      (req as any).user = { claims: { sub: userEmail, email: userEmail } };
      return next();
    }

    // PATH B: User is not a coach, check if they're the client
    const clientRecord = await storage.getClient(clientId);
    if (!clientRecord) {
      return res.status(404).json({ message: "Client not found" });
    }

    const clientEmail = clientRecord.email?.toLowerCase();
    if (clientEmail && clientEmail === userEmail) {
      (req as any).user = { claims: { sub: userEmail, email: userEmail } };
      return next();
    }

    return res.status(403).json({ message: "Access denied" });
  };
};
