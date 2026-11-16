export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "development"
  ) {
    const { startLocalOutboxWorker } = await import("./lib/outbox/dispatch");
    startLocalOutboxWorker();
  }
}
