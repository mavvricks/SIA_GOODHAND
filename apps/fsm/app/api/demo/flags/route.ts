import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { NextResponse, type NextRequest } from "next/server";
import { simulationService } from "@/lib/simulation/simulation-service";

async function handlePOST(req: NextRequest) {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { key, value } = await req.json();
    if (typeof key !== "string" || typeof value !== "boolean") {
      return NextResponse.json(
        { error: "key (string) and value (boolean) are required" },
        { status: 422 },
      );
    }

    simulationService.setFlag(key, value);
    return NextResponse.json({
      success: true,
      flags: simulationService.getAllFlags(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = databaseRoute("fsm", handlePOST, { readOnly: false });
