"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { StoreHeader } from "@/components/StoreHeader";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

const localTime = (hour: number) => {
  const date = new Date(Date.now() + 48 * 3600000);
  date.setHours(hour, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const paymentOptions = [
  { value: "cash", label: "Cash", detail: "Pay in cash" },
  { value: "qrph", label: "QRPH", detail: "Scan to pay" },
  { value: "gcash", label: "GCash", detail: "E-wallet" },
  { value: "card", label: "Card", detail: "Debit or credit" },
] as const;
type PaymentMethod = (typeof paymentOptions)[number]["value"];

const money = (amount: number) =>
  amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" });

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [review, setReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const reviewRef = useRef<HTMLElement>(null);
  const idempotencyKey = useRef("");
  const [includeInstallation, setIncludeInstallation] = useState(true);
  const [start, setStart] = useState(() => localTime(9));
  const [end, setEnd] = useState(() => localTime(11));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("gcash");
  const [simulateFailure, setSimulateFailure] = useState(false);
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

  useEffect(() => {
    if (user)
      setForm((previous) => ({
        ...previous,
        customerName: user.fullName || "",
        customerEmail: user.email,
      }));
  }, [user]);

  const total = items.reduce(
    (sum, item) => sum + Number(item.pricePhp) * item.quantity,
    0,
  );
  const paymentLabel = paymentOptions.find(
    (option) => option.value === paymentMethod,
  )!.label;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
      setTimeout(
        () =>
          reviewRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        0,
      );
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const response = await fetch("/api/checkout", {
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
          items: items.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
            unitPricePhp: item.pricePhp,
          })),
          include_installation: includeInstallation,
          ...(includeInstallation
            ? {
                preferredStart: new Date(start).toISOString(),
                preferredEnd: new Date(end).toISOString(),
                specialInstructions: form.specialInstructions,
              }
            : {}),
          paymentMethod,
          simulatePaymentFailure: simulateFailure,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "Checkout failed");
      clearCart();
      router.push(`/orders/${data.orderNumber}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout failed");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    type = "text",
    autoComplete?: string,
  ) => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        name={key}
        type={type}
        autoComplete={autoComplete}
        required
        value={form[key]}
        onChange={(event) =>
          setForm((previous) => ({ ...previous, [key]: event.target.value }))
        }
        className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
    </label>
  );

  const sectionTitle = (number: string, title: string, detail: string) => (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0b1c2d] text-sm font-bold text-[#ffc400]">
        {number}
      </span>
      <div>
        <h2 className="text-base font-bold leading-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <StoreHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6 lg:pt-10">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#0b1c2d]"
        >
          <ArrowLeft size={16} /> Back to cart
        </Link>
        <div className="mb-7 mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d71920]">
              Secure checkout
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0b1c2d] sm:text-4xl">
              Complete your order
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Review your delivery, installation, and payment details in one
              place.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <ShieldCheck size={16} className="text-emerald-700" /> Your order
            details stay with GoodHand
          </div>
        </div>

        {!user && (
          <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Please{" "}
            <Link href="/login" className="font-bold underline">
              sign in
            </Link>{" "}
            before checkout to track your order.
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <form
            id="checkout-form"
            onSubmit={submit}
            onChange={() => {
              setReview(false);
              idempotencyKey.current = "";
            }}
            className="min-w-0 space-y-4"
          >
            <fieldset disabled={loading} className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                {sectionTitle(
                  "1",
                  "Contact details",
                  "We’ll use these to confirm and update your order.",
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {field("customerName", "Full name", "text", "name")}
                  </div>
                  {field("customerPhone", "Mobile number (PH)", "tel", "tel")}
                  {field("customerEmail", "Email address", "email", "email")}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                {sectionTitle(
                  "2",
                  "Delivery address",
                  "Where should we send your hardware?",
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {field("line1", "Street address", "text", "street-address")}
                  </div>
                  {field(
                    "city",
                    "City / Municipality",
                    "text",
                    "address-level2",
                  )}
                  {field(
                    "province",
                    "Province / Region",
                    "text",
                    "address-level1",
                  )}
                  {field("postalCode", "Postal code", "text", "postal-code")}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                {sectionTitle(
                  "3",
                  "Installation service",
                  "Choose the support that fits your order.",
                )}
                <label
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition ${includeInstallation ? "border-[#e4b200] bg-amber-50" : "border-slate-200 bg-slate-50"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#0b1c2d]">
                      <PackageCheck size={19} />
                    </span>
                    <span>
                      <strong className="block text-sm text-slate-950">
                        Professional installation
                      </strong>
                      <span className="block text-xs text-slate-600">
                        Add a technician visit to this order
                      </span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeInstallation}
                    onChange={(event) =>
                      setIncludeInstallation(event.target.checked)
                    }
                    aria-label="Include Professional Installation Service"
                    aria-controls="installation-schedule"
                    className="h-5 w-5 accent-[#d4a900]"
                  />
                </label>
                {includeInstallation ? (
                  <div id="installation-schedule" className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Preferred start
                        <input
                          id="preferred-start"
                          type="datetime-local"
                          required
                          value={start}
                          onChange={(event) => setStart(event.target.value)}
                          className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                        />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Preferred end
                        <input
                          id="preferred-end"
                          type="datetime-local"
                          required
                          value={end}
                          onChange={(event) => setEnd(event.target.value)}
                          className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                        />
                      </label>
                    </div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Site instructions{" "}
                      <span className="font-normal text-slate-400">
                        (optional)
                      </span>
                      <textarea
                        maxLength={500}
                        rows={2}
                        value={form.specialInstructions}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            specialInstructions: event.target.value,
                          }))
                        }
                        placeholder="Access instructions or details the technician should know"
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-normal focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                    </label>
                  </div>
                ) : (
                  <p
                    role="status"
                    className="mt-3 rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-900"
                  >
                    Hardware Delivery Only (Self-Installation). No technician or
                    schedule needed.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                {sectionTitle(
                  "4",
                  "Payment method",
                  "Choose how you’d like to pay in this demo.",
                )}
                <div
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="Simulated payment method"
                >
                  {paymentOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex min-h-20 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-center transition ${paymentMethod === option.value ? "border-[#d4a900] bg-amber-50 ring-1 ring-[#d4a900]" : "border-slate-200 hover:border-slate-400"}`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={option.value}
                        checked={paymentMethod === option.value}
                        onChange={() => setPaymentMethod(option.value)}
                        className="sr-only"
                      />
                      {paymentMethod === option.value && (
                        <Check
                          size={14}
                          className="absolute right-2 top-2 text-amber-700"
                        />
                      )}
                      <span className="text-sm font-bold text-slate-950">
                        {option.label}
                      </span>
                      <span className="mt-1 text-[11px] text-slate-500">
                        {option.detail}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                  <CreditCard size={15} className="shrink-0" /> Simulation only.
                  No money is charged or card and wallet details collected.
                </p>
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer">
                    Demo payment controls
                  </summary>
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={simulateFailure}
                      onChange={(event) =>
                        setSimulateFailure(event.target.checked)
                      }
                    />
                    Force payment failure
                  </label>
                </details>
              </section>

              {review && (
                <section
                  ref={reviewRef}
                  role="region"
                  aria-label="Review and confirm order"
                  className="rounded-2xl border-2 border-[#e4b200] bg-amber-50 p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-amber-800" />
                    <h2 className="text-lg font-bold text-slate-950">
                      Review before confirming
                    </h2>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <p>
                      <span className="block text-xs text-slate-500">
                        Contact
                      </span>
                      <strong>{form.customerName}</strong>
                      <br />
                      {form.customerEmail}
                      <br />
                      {form.customerPhone}
                    </p>
                    <p>
                      <span className="block text-xs text-slate-500">
                        Deliver to
                      </span>
                      {form.line1}, {form.city}, {form.province}{" "}
                      {form.postalCode}
                    </p>
                    <p>
                      <span className="block text-xs text-slate-500">
                        Service
                      </span>
                      {includeInstallation
                        ? "Professional installation"
                        : "Hardware Delivery Only (Self-Installation)"}
                    </p>
                    <p>
                      <span className="block text-xs text-slate-500">
                        Payment
                      </span>
                      {paymentLabel} (simulated)
                    </p>
                  </div>
                  {includeInstallation && (
                    <p className="mt-3 text-sm">
                      <span className="text-xs text-slate-500">
                        Preferred visit:{" "}
                      </span>
                      {new Date(start).toLocaleString("en-PH")} –{" "}
                      {new Date(end).toLocaleString("en-PH")}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setReview(false)}
                    className="mt-4 text-sm font-semibold text-[#0b1c2d] underline"
                  >
                    Edit details
                  </button>
                </section>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}
            </fieldset>
          </form>

          <aside className="lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                <h2 className="text-lg font-bold text-[#0b1c2d]">
                  Order summary
                </h2>
                <p className="text-xs text-slate-500">
                  {items.length} {items.length === 1 ? "product" : "products"}{" "}
                  in your cart
                </p>
              </div>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {items.map((item) => (
                  <div
                    key={item.sku}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Qty {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-slate-900">
                      {money(Number(item.pricePhp) * item.quantity)}
                    </span>
                  </div>
                ))}
                {!items.length && (
                  <Link
                    href="/products"
                    className="text-sm font-semibold text-[#0e2378] underline"
                  >
                    Your cart is empty. Browse products
                  </Link>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
                  <span>Items subtotal</span>
                  <span>{money(total)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-[#0b1c2d]">
                  <span>Order total</span>
                  <span>{money(total)}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  The displayed total covers the items in your cart. Payment is
                  simulated; no charge is made.
                </p>
                <button
                  form="checkout-form"
                  type="submit"
                  disabled={loading || !items.length}
                  className="w-full rounded-xl bg-[#ffc400] px-4 py-3.5 text-sm font-bold text-[#0b1c2d] shadow-sm transition hover:bg-[#eeb500] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Submitting…"
                    : review
                      ? "Confirm order"
                      : "Review order"}{" "}
                  · {money(total)}
                </button>
                <p className="text-center text-xs text-slate-500">
                  {review
                    ? "Confirming places your simulated order."
                    : "You can review everything before confirming."}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <Truck size={16} className="shrink-0 text-[#0e2378]" /> Delivery
                updates
              </p>
              <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <ShieldCheck size={16} className="shrink-0 text-[#0e2378]" />{" "}
                Order tracking
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
