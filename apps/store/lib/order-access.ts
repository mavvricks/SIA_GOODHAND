import type { StoredOrder } from "./services/orders-service";
import type { UserSession } from "./auth";
export function canViewOrder(user: UserSession | null, order: StoredOrder) {
  return Boolean(
    user &&
    (user.role === "store_admin" ||
      (order.ownerId
        ? order.ownerId === user.userId
        : order.customerEmail.toLowerCase() === user.email.toLowerCase())),
  );
}
export function customerOrder(order: StoredOrder) {
  const { ownerId, customerEmail, customerPhone, ...rest } = order;
  return {
    ...rest,
    delivery: order.delivery
      ? { ...order.delivery, actor: undefined }
      : undefined,
    deliveryHistory: order.deliveryHistory?.map(({ actor, ...event }) => event),
  };
}
