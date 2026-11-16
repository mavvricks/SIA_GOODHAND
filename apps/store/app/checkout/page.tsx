"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StoreHeader } from "@/components/StoreHeader";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
const localTime = (hour: number) => {
  const d = new Date(Date.now() + 48 * 3600000);
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [review, setReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const idempotencyKey = useRef("");
  const [includeInstallation, setIncludeInstallation] = useState(true);
  const [start, setStart] = useState(() => localTime(9));
  const [end, setEnd] = useState(() => localTime(11));
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    line1: "",
    city: "",
    province: "Metro Manila",
    postalCode: "",
    specialInstructions: "",
  });
  const [simulateFailure, setSimulateFailure] = useState(false);
  useEffect(() => {
    if (user)
      setForm((old) => ({
        ...old,
        customerName: user.fullName || "",
        customerEmail: user.email,
      }));
  }, [user]);
  const total = items.reduce(
    (sum, i) => sum + Number(i.pricePhp) * i.quantity,
    0,
  );
  const money = (n: number) =>
    n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!items.length) {
      setError("Your cart is empty. Add products before checking out.");
      return;
    }
    if (includeInstallation && Date.parse(end) <= Date.parse(start)) {
      setError("Preferred end must be after start.");
      return;
    }
    if (!review) {
      setReview(true);
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail,
          address: {
            line1: form.line1,
            city: form.city,
            province: form.province,
            postalCode: form.postalCode,
          },
          items: items.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            unitPricePhp: i.pricePhp,
          })),
          include_installation: includeInstallation,
          ...(includeInstallation
            ? {
                preferredStart: new Date(start).toISOString(),
                preferredEnd: new Date(end).toISOString(),
                specialInstructions: form.specialInstructions,
              }
            : {}),
          simulatePaymentFailure: simulateFailure,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Checkout failed");
      clearCart();
      router.push("/orders/" + data.orderNumber);
    } catch (e: any) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label className="block text-sm">
      {label}
      <input
        name={key}
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="block mt-1 w-full border rounded-lg p-3"
      />
    </label>
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <StoreHeader />
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Checkout</h1>
        {!user && (
          <p className="rounded bg-yellow-50 p-3">
            Please{" "}
            <a href="/login" className="underline font-semibold">
              sign in
            </a>{" "}
            before checking out to securely track your orders.
          </p>
        )}
        <p>
          Order hardware for delivery, with optional professional installation.
        </p>
        <section className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-bold">Order items</h2>
          {items.map((i) => (
            <p key={i.sku}>
              {i.name} × {i.quantity} — {money(Number(i.pricePhp) * i.quantity)}
            </p>
          ))}
          {!items.length && (
            <a href="/products" className="underline">
              Your cart is empty. Browse products
            </a>
          )}
          <p className="font-bold">Total: {money(total)}</p>
        </section>
        <form
          onSubmit={submit}
          onChange={() => {
            setReview(false);
            idempotencyKey.current = "";
          }}
          className="space-y-6"
        >
          <fieldset disabled={loading} className="space-y-6">
            <section className="bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-bold">1. Contact & Customer Details</h2>
              {field("customerName", "Full Name")}
              {field("customerPhone", "Contact Phone (PH)", "tel")}
              {field("customerEmail", "Email Address", "email")}
            </section>
            <section className="bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-bold">2. Installation / Delivery Address</h2>
              {field("line1", "Street Address")}
              {field("city", "City")}
              {field("province", "Province / Region")}
              {field("postalCode", "Postal Code")}
            </section>
            <section className="bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-bold">
                3. Professional Installation Schedule
              </h2>
              <label className="flex gap-3 font-semibold">
                <input
                  type="checkbox"
                  checked={includeInstallation}
                  onChange={(e) => setIncludeInstallation(e.target.checked)}
                  aria-controls="installation-schedule"
                />
                Include Professional Installation Service
              </label>
              {includeInstallation ? (
                <div id="installation-schedule" className="space-y-3">
                  <label className="block">
                    Preferred Start Time
                    <input
                      id="preferred-start"
                      type="datetime-local"
                      required
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="block border rounded p-3 w-full"
                    />
                  </label>
                  <label className="block">
                    Preferred End Time
                    <input
                      id="preferred-end"
                      type="datetime-local"
                      required
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="block border rounded p-3 w-full"
                    />
                  </label>
                  <label className="block">
                    Special Site Instructions
                    <textarea
                      maxLength={500}
                      value={form.specialInstructions}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          specialInstructions: e.target.value,
                        })
                      }
                      className="block border rounded p-3 w-full"
                    />
                  </label>
                </div>
              ) : (
                <p role="status" className="bg-blue-50 p-3 rounded">
                  Hardware Delivery Only (Self-Installation). No technician or
                  installation schedule is required.
                </p>
              )}
            </section>
            <section className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-bold">4. Payment Method</h2>
              <p>Simulated Immediate Gateway</p>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                />
                Force Payment Failure (Demo Mode)
              </label>
            </section>
            {review && (
              <section
                role="region"
                aria-label="Review and confirm order"
                className="border-2 border-yellow-400 bg-yellow-50 rounded-xl p-5 space-y-3"
              >
                <h2 className="font-bold text-lg">Review before confirming</h2>
                <p>
                  {form.customerName} · {form.customerEmail} ·{" "}
                  {form.customerPhone}
                </p>
                <p>
                  Deliver to: {form.line1}, {form.city}, {form.province},{" "}
                  {form.postalCode}
                </p>
                <p className="font-semibold">
                  {includeInstallation
                    ? "Professional installation included"
                    : "Hardware Delivery Only (Self-Installation)"}
                </p>
                {includeInstallation && (
                  <p>
                    Preferred: {new Date(start).toLocaleString("en-PH")} –{" "}
                    {new Date(end).toLocaleString("en-PH")}
                  </p>
                )}
                <p>Total: {money(total)}</p>
                <p className="text-sm">
                  Payment is simulated in this demo. Check your items, delivery
                  address and service choice before confirming.
                </p>
                <button
                  type="button"
                  onClick={() => setReview(false)}
                  className="underline"
                >
                  Back to editing
                </button>
              </section>
            )}
            {error && (
              <p role="alert" className="bg-red-50 text-red-800 p-3 rounded">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !items.length}
              className="w-full bg-yellow-400 rounded-xl p-4 font-bold disabled:opacity-50"
            >
              {loading
                ? "Submitting…"
                : review
                  ? "Pay & Confirm " +
                    (includeInstallation
                      ? "Installation Order"
                      : "Hardware Order")
                  : "Review order"}{" "}
              ({money(total)})
            </button>
          </fieldset>
        </form>
      </main>
    </div>
  );
}
