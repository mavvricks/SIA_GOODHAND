import { getLocalDatabase } from "../../../packages/local-db/index.mjs";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.STORE_SESSION_SECRET ||
    "store_default_super_secret_session_key_minimum_64_characters_long_for_security",
);

export interface UserSession {
  userId: string;
  email: string;
  role: "customer" | "store_admin";
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
  const sessionId = crypto.randomUUID();
  getLocalDatabase("store").createSession(
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
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.jti || typeof payload.userId !== "string") return null;
    const row = getLocalDatabase("store").sessionUser(
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
  const cookie = req.cookies.get("store_session");
  if (!cookie?.value) return null;
  return verifySessionToken(cookie.value);
}

// Obtain an OAuth client-credentials token from the receiving system.
export async function createStoreToFsmServiceToken(
  scopes: string[],
): Promise<string> {
  const base = process.env.STORE_FSM_BASE_URL || "http://localhost:3100/api/v1";
  const response = await fetch(new URL("/api/oauth/token", base), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.STORE_SERVICE_CLIENT_ID || "store-service",
      client_secret:
        process.env.STORE_SERVICE_CLIENT_SECRET ||
        "change_me_store_service_secret_at_least_32_characters",
      scope: scopes.join(" "),
    }),
    signal: AbortSignal.timeout(2000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`FSM token request failed (${response.status})`);
  const body = await response.json();
  if (!body.access_token)
    throw new Error("FSM token response did not contain access_token");
  return body.access_token;
}

export async function revokeSessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.jti) getLocalDatabase("store").revokeSession(payload.jti);
  } catch {
    /* Already expired or invalid. */
  }
}
