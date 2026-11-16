import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      role: session.role,
      fullName: session.fullName,
    },
  });
}
