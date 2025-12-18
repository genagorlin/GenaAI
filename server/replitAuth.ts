import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Use production database URL if available, fallback to development
  const connectionString = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set for session storage");
  }
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
  }
  
  const sessionStore = new pgStore({
    conString: connectionString,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any) => {
      if (err || !user) {
        console.log("[Auth Callback] Error or no user:", err);
        return res.redirect("/api/login");
      }
      
      const email = user.claims?.email;
      const firstName = user.claims?.first_name;
      const lastName = user.claims?.last_name;
      const profileImageUrl = user.claims?.profile_image_url;
      
      // Check if this is a client login (has clientReturnTo in session)
      const clientReturnToEncoded = (req.session as any).clientReturnTo;
      if (clientReturnToEncoded) {
        // Client login flow - skip allowlist check
        delete (req.session as any).clientReturnTo;
        
        // Decode the URL-encoded returnTo and validate it's a same-origin path
        let clientReturnTo = decodeURIComponent(clientReturnToEncoded);
        
        // Security: Only allow relative paths starting with /chat/ to prevent open redirect
        if (!clientReturnTo.startsWith('/chat/') || clientReturnTo.includes('//')) {
          clientReturnTo = '/';
        }
        console.log("[Auth Callback] Client login for email:", email, "returnTo:", clientReturnTo);
        
        req.login(user, async (loginErr) => {
          if (loginErr) {
            console.log("[Auth Callback] Client login error:", loginErr);
            return res.redirect("/");
          }
          
          // Extract clientId from returnTo URL if it's a chat page
          const chatMatch = clientReturnTo.match(/\/chat\/([^/?]+)/);
          if (chatMatch && email) {
            const clientId = chatMatch[1];
            
            // Check if client exists and update or create
            let existingClient = await storage.getClient(clientId);
            
            if (existingClient) {
              // Update existing client with auth info if not already set
              if (!existingClient.email || existingClient.email !== email) {
                await storage.updateClientAuth(clientId, {
                  email,
                  name: existingClient.name || `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
                  photoUrl: profileImageUrl,
                });
              }
            } else {
              // Create new client on first login
              const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0];
              await storage.registerClient({
                id: clientId,
                name: fullName,
                email,
                photoUrl: profileImageUrl,
              });
              
              // Send welcome message
              await storage.createMessage({
                clientId,
                role: "ai",
                content: `Hi ${firstName || 'there'}! Welcome to GenaGPT. I'm your thinking partner - here whenever you want to work through something. What's on your mind?`,
                type: "text",
              });
              console.log("[Auth Callback] Created new client and sent welcome message:", clientId);
            }
          }
          
          console.log("[Auth Callback] Client login successful, redirecting to:", clientReturnTo);
          return res.redirect(clientReturnTo);
        });
        return;
      }
      
      // Coach login flow - check allowlist
      console.log("[Auth Callback] Coach login attempt for email:", email);
      
      if (email) {
        // Bootstrap mode: if no authorized users exist, create the first user as admin
        const allUsers = await storage.getAllAuthorizedUsers();
        if (allUsers.length === 0) {
          console.log("[Auth Callback] No authorized users exist - bootstrapping first user as admin:", email);
          await storage.createAuthorizedUser(email, "admin");
        }
        
        const authorizedUser = await storage.getAuthorizedUserByEmail(email);
        console.log("[Auth Callback] Authorized user lookup result:", authorizedUser);
        
        if (!authorizedUser) {
          console.log("[Auth Callback] User NOT in allowlist, redirecting to /unauthorized");
          return res.redirect("/unauthorized");
        }
        console.log("[Auth Callback] User IS authorized, proceeding with login");
        // Update last login
        await storage.updateAuthorizedUserLastLogin(email);
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.log("[Auth Callback] Login error:", loginErr);
          return res.redirect("/api/login");
        }
        console.log("[Auth Callback] Login successful, redirecting to /");
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // Client-specific login entry point (stores returnTo, then redirects to same OIDC flow)
  // The /api/callback handler detects clientReturnTo in session and skips allowlist
  app.get("/api/client/login", (req, res, next) => {
    const returnTo = req.query.returnTo as string;
    if (returnTo) {
      (req.session as any).clientReturnTo = returnTo;
    }
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    // Check if user is in authorized list
    const email = user.claims?.email;
    if (email) {
      const authorizedUser = await storage.getAuthorizedUserByEmail(email);
      if (!authorizedUser) {
        return res.status(403).json({ message: "Not authorized to access this application" });
      }
    }
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Client authentication - checks session is authenticated but doesn't require allowlist
export const isClientAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const email = user.claims?.email;
  if (!email) {
    return res.status(403).json({ message: "No email found" });
  }
  
  const authorizedUser = await storage.getAuthorizedUserByEmail(email);
  if (!authorizedUser || authorizedUser.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  return next();
};

// Client authentication with ownership verification
// Verifies the authenticated user's email matches the client record
export const requireClientAuth = (getClientId: (req: any) => string | Promise<string>): RequestHandler => {
  return async (req: any, res, next) => {
    const user = req.user as any;

    // First check if authenticated
    if (!req.isAuthenticated() || !user?.expires_at) {
      return res.status(401).json({ message: "Unauthorized", requiresAuth: true });
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Handle token refresh if expired
    if (now > user.expires_at) {
      const refreshToken = user.refresh_token;
      if (!refreshToken) {
        return res.status(401).json({ message: "Session expired", requiresAuth: true });
      }
      try {
        const config = await getOidcConfig();
        const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
        updateUserSession(user, tokenResponse);
      } catch (error) {
        return res.status(401).json({ message: "Session expired", requiresAuth: true });
      }
    }

    // Get client ID from route
    let clientId: string;
    try {
      clientId = await getClientId(req);
    } catch (err) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Verify email ownership
    const sessionEmail = user.claims?.email?.toLowerCase();
    if (!sessionEmail) {
      return res.status(401).json({ message: "No email in session" });
    }

    const clientRecord = await storage.getClient(clientId);
    if (!clientRecord) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Check if client email matches session email
    if (!clientRecord.email) {
      // Client record exists but no email - this is a legacy record
      // Allow access but encourage linking (the callback will update on next login)
      console.log(`[Auth] Client ${clientId} has no email, allowing session with ${sessionEmail}`);
      req.clientRecord = clientRecord;
      return next();
    }

    if (clientRecord.email.toLowerCase() !== sessionEmail) {
      console.log(`[Auth] Email mismatch: session=${sessionEmail}, client=${clientRecord.email}`);
      return res.status(403).json({ message: "Access denied - email mismatch" });
    }

    // Attach client record to request for use in handlers
    req.clientRecord = clientRecord;
    return next();
  };
};

// Helper to get clientId from thread lookup
export async function getClientIdFromThread(threadId: string): Promise<string> {
  const thread = await storage.getThread(threadId);
  if (!thread) throw new Error("Thread not found");
  return thread.clientId;
}
