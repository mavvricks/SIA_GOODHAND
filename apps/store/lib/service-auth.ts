import { jwtVerify } from "jose";
export async function hasServiceScope(header: string | null, scope: string) {
  const secret = process.env.FSM_SESSION_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  try {
    const { payload } = await jwtVerify(
      header.slice(7),
      new TextEncoder().encode(secret),
    );
    return (
      payload.sub ===
        (process.env.STORE_SERVICE_CLIENT_ID || "store-service") &&
      typeof payload.scope === "string" &&
      payload.scope.split(" ").includes(scope)
    );
  } catch {
    return false;
  }
}
