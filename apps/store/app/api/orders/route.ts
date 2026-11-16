import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ordersService } from "@/lib/services/orders-service";
import { canViewOrder, customerOrder } from "@/lib/order-access";
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user)
    return NextResponse.json(
      { error: { message: "Sign in to track your orders." } },
      { status: 401 },
    );
  return NextResponse.json(
    {
      orders: ordersService
        .listOrders()
        .filter((order) => canViewOrder(user, order))
        .map(customerOrder),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
