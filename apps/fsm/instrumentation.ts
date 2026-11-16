export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "development"
  ) {
    const { flushFsmOutbox } = await import("./lib/outbox");
    await flushFsmOutbox();
  }
}
