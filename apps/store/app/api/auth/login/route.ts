import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { authenticateStoreUser } from "@/lib/accounts";
import { allowAuthAttempt } from '../../../../../../packages/database/rate-limit.mjs';
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 1024) return NextResponse.json({ error: { message: 'Invalid credentials.' } }, { status: 400 });
    if (!(await allowAuthAttempt('store', 'login', req.headers.get('x-forwarded-for')?.split(',')[0] || '', email))) return NextResponse.json({ error: { category: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in five minutes.' } }, { status: 429 });
    const user = await authenticateStoreUser(email, password);
    if (!user)
      return NextResponse.json(
        {
          error: {
            message:
              "Invalid email or password. Create an account if you are a new customer.",
          },
        },
        { status: 401 },
      );
    const token = await createSessionToken(user);
    const response = NextResponse.json({ success: true, user });
    response.cookies.set("store_session", token, {
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
