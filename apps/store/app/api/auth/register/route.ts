import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { storeAccounts } from "@/lib/accounts";
const schema = z
  .object({
    email: z.string().trim().email().max(254),
    fullName: z.string().trim().min(2).max(100),
    password: z.string().min(8).max(72),
  })
  .strict();
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json());
    const database = storeAccounts();
    database.addUser({
      id: crypto.randomUUID(),
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      role: "customer",
      passwordHash: await bcrypt.hash(input.password, 10),
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    const duplicate = String(error.message).includes("UNIQUE constraint");
    return NextResponse.json(
      {
        error: {
          message: duplicate
            ? "An account with this email already exists."
            : error instanceof z.ZodError
              ? error.issues[0]?.message
              : "Registration failed",
        },
      },
      { status: duplicate ? 409 : 422 },
    );
  }
}
