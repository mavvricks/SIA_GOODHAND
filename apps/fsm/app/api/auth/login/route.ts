import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { authenticateFsmUser } from "@/lib/accounts";
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const user = await authenticateFsmUser(email, password);
    if (!user)
      return NextResponse.json(
        { error: { message: "Invalid email or password" } },
        { status: 401 },
      );
    const token = await createSessionToken(user);
    const response = NextResponse.json({ success: true, user });
    response.cookies.set("fsm_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 3600,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: { message: "Login failed" } },
      { status: 400 },
    );
  }
}
