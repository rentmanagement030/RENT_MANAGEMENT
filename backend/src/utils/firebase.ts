import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../config/env";
import { logger } from "./logger";
import { UnauthorizedError } from "./http";

let appInstance: App | null = null;

export function getFirebaseAdminApp(): App | null {
  if (!appInstance) {
    const apps = getApps();
    if (apps.length > 0) {
      appInstance = apps[0];
      return appInstance;
    }

    const projectId = env.firebaseProjectId || "c2d-rentals";

    try {
      if (env.firebaseClientEmail && env.firebasePrivateKey) {
        appInstance = initializeApp({
          credential: cert({
            projectId,
            clientEmail: env.firebaseClientEmail,
            privateKey: env.firebasePrivateKey,
          }),
        });
      } else {
        appInstance = initializeApp({ projectId });
      }
      logger.info(`Firebase Admin SDK initialized successfully for project: ${projectId}`);
    } catch (err) {
      logger.error(`Failed to initialize Firebase Admin SDK: ${String(err)}`);
    }
  }

  return appInstance;
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies a Firebase ID token using the official Firebase Admin SDK.
 * Fails closed if Firebase Admin is not configured in production or if verification fails.
 * In NODE_ENV === 'test', explicitly isolated test tokens (prefixed with 'test-token-')
 * are allowed strictly during automated test runs.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  if (!idToken || typeof idToken !== "string") {
    throw new UnauthorizedError("Invalid or missing Firebase ID token");
  }

  // Strictly isolated test mode for automated vitest suites (NODE_ENV === 'test')
  if (env.nodeEnv === "test" && idToken.startsWith("test-token-")) {
    const parts = idToken.split(":");
    const email = parts[1] || "test@c2dtech.in";
    const uid = parts[2] || `test-uid-${email}`;
    return {
      uid,
      email,
      email_verified: true,
      name: "Test User",
    };
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    throw new UnauthorizedError("Authentication service unavailable (Firebase Admin not configured)");
  }

  try {
    const auth = getAuth(app);
    // Verify signature using Google public x509 certs without requiring service account keys
    const decoded = await auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch (err) {
    logger.warn(`Firebase token verification failed: ${String(err)}`);
    throw new UnauthorizedError("Invalid or expired authentication token");
  }
}
