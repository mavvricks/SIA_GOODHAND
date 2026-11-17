import { accountDatabase } from "../../../packages/database/accounts.mjs";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.FSM_SESSION_SECRET ||
    "fsm_default_super_secret_session_key_minimum_64_characters_long_for_security",
);

export interface UserSession {
  userId: string;
  email: string;
  role: "dispatcher" | "technician" | "admin";
  fullName: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: UserSession): Promise<string> {
  if (process.env.NODE_ENV === 'production' && !process.env.FSM_SESSION_SECRET) throw new Error('FSM session signing is not configured');
  const sessionId = crypto.randomUUID();
  await accountDatabase("fsm").createSession(
    sessionId,
    user.userId,
    Date.now() + 8 * 3600 * 1000,
  );
  return new SignJWT({ ...user })
    .setJti(sessionId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(
  token: string,
): Promise<UserSession | null> {
  if (process.env.NODE_ENV === 'production' && !process.env.FSM_SESSION_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.jti || typeof payload.userId !== "string") return null;
    const row = await accountDatabase("fsm").sessionUser(
      payload.jti,
      payload.userId,
    );
    return row
      ? ({
          userId: row.id,
          email: row.email,
          role: row.role,
          fullName: row.full_name,
        } as UserSession)
      : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(
  req: NextRequest,
): Promise<UserSession | null> {
  const cookie = req.cookies.get("fsm_session");
  if (!cookie?.value) return null;
  return verifySessionToken(cookie.value);
}

// Service-to-service OAuth token verification (HS256)
export async function verifyServiceToken(
  authHeader: string | null,
  requiredScope: string,
): Promise<{
  valid: boolean;
  errorCategory?: "AUTHENTICATION_REQUIRED" | "FORBIDDEN_SCOPE";
  clientId?: string;
}> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, errorCategory: "AUTHENTICATION_REQUIRED" };
  }

  const token = authHeader.substring(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const scopes = ((payload.scope as string) || "").split(" ");
    if (!scopes.includes(requiredScope)) {
      return { valid: false, errorCategory: "FORBIDDEN_SCOPE" };
    }
    return { valid: true, clientId: payload.sub as string };
  } catch {
    return { valid: false, errorCategory: "AUTHENTICATION_REQUIRED" };
  }
}

export async function createServiceToken(
  clientId: string,
  scopes: string[],
): Promise<string> {
  return new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

export async function revokeSessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.jti) await accountDatabase("fsm").revokeSession(payload.jti);
  } catch {
    /* Already expired or invalid. */
  }
}
