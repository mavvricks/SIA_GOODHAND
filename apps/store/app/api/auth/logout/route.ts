import { NextResponse, type NextRequest } from "next/server";
import { revokeSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("store_session")?.value;
  if (token) await revokeSessionToken(token);
  const res = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
  res.cookies.set("store_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
