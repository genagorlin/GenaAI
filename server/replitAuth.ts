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
    cookie: {
      httpOnly: true,
      secure: true,
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
        
        // Security: Only allow relative paths starting with /chat/ or /inbox/ to prevent open redirect
        if ((!clientReturnTo.startsWith('/chat/') && !clientReturnTo.startsWith('/inbox/')) || clientReturnTo.includes('//')) {
          clientReturnTo = '/';
        }
        console.log("[Auth Callback] Client login for email:", email, "returnTo:", clientReturnTo);
        
        // Extract clientId from returnTo URL
        const chatMatch = clientReturnTo.match(/\/(?:chat|inbox)\/([^/?]+)/);
        if (!chatMatch || !email) {
          console.log("[Auth Callback] Invalid client login - no clientId or email");
          return res.redirect("/client-access-denied");
        }
        
        const clientId = chatMatch[1];
        const existingClient = await storage.getClient(clientId);
        
        if (!existingClient) {
          // Client doesn't exist - deny access (must be created by coach first)
          console.log("[Auth Callback] Client not found:", clientId);
          return res.redirect("/client-access-denied?reason=not-found");
        }
        
        // Check email verification
        const clientEmail = existingClient.email?.toLowerCase();
        const loginEmail = email.toLowerCase();
        
        if (clientEmail && clientEmail !== loginEmail) {
          // Email doesn't match - deny access
          console.log("[Auth Callback] Email mismatch. Client email:", clientEmail, "Login email:", loginEmail);
          return res.redirect("/client-access-denied?reason=email-mismatch");
        }
        
        // First time login - bind this email to the client
        if (!clientEmail) {
          console.log("[Auth Callback] First login for client", clientId, "- binding email:", loginEmail);
          await storage.updateClientAuth(clientId, {
            email: loginEmail,
            name: existingClient.name || `${firstName || ''} ${lastName || ''}`.trim() || loginEmail.split('@')[0],
            photoUrl: profileImageUrl,
          });
        }
        
        req.login(user, async (loginErr) => {
          if (loginErr) {
            console.log("[Auth Callback] Client login error:", loginErr);
            return res.redirect("/");
          }
          
          // Store session metadata in req.session (persists across requests)
          // This must be done AFTER req.login since login creates the session
          (req.session as any).sessionType = "client";
          (req.session as any).boundClientId = clientId;
          
          console.log("[Auth Callback] Client login successful for", clientId, ", redirecting to:", clientReturnTo);
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
    // Clear client session metadata before logout
    delete (req.session as any).sessionType;
    delete (req.session as any).boundClientId;
    
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

// Verify that the authenticated user has access to a specific client's data
// This checks:
// 1. The session is a client session (not a coach session)
// 2. The boundClientId in the session matches the requested clientId
// 3. The session email matches the client's email
export const verifyClientAccess = (getClientId: (req: any) => string | undefined): RequestHandler => {
  return async (req, res, next) => {
    const user = req.user as any;
    const session = req.session as any;
    
    // Check authentication
    if (!req.isAuthenticated() || !user?.claims?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(400).json({ message: "Client ID required" });
    }
    
    // CRITICAL: Verify this is a client session (stored in req.session, not req.user)
    if (session.sessionType !== "client") {
      console.log(`[ClientAccess] Rejected - not a client session. SessionType: ${session.sessionType}`);
      return res.status(403).json({ message: "Access denied - client session required" });
    }
    
    // CRITICAL: Verify the session is bound to this specific clientId
    if (session.boundClientId !== clientId) {
      console.log(`[ClientAccess] Rejected - session bound to different client. Bound: ${session.boundClientId}, Requested: ${clientId}`);
      return res.status(403).json({ message: "Access denied - wrong client" });
    }
    
    const sessionEmail = user.claims.email.toLowerCase();
    
    // Get the client record
    const clientRecord = await storage.getClient(clientId);
    if (!clientRecord) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    // Check if client has an email set
    const clientEmail = clientRecord.email?.toLowerCase();
    if (!clientEmail) {
      // Client has no email set yet - this shouldn't happen if they logged in properly
      // But we'll allow access since the callback should have bound the email
      return next();
    }
    
    // Verify email match
    if (clientEmail !== sessionEmail) {
      console.log(`[ClientAccess] Email mismatch. Session: ${sessionEmail}, Client: ${clientEmail}`);
      return res.status(403).json({ message: "Access denied - email mismatch" });
    }
    
    return next();
  };
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
