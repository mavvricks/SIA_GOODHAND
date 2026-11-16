import { StoreHeader } from "@/components/StoreHeader";
import { OrderTracking } from "@/components/OrderTracking";
export default function OrdersPage() {
  return (
    <>
      <StoreHeader />
      <main className="max-w-4xl mx-auto p-6">
        <OrderTracking />
      </main>
    </>
  );
}
