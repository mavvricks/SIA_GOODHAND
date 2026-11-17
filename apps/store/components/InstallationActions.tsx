"use client";
import { useState } from "react";

const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function InstallationActions({
  orderNumber,
  status,
  preferredStart,
  preferredEnd,
}: {
  orderNumber: string;
  status?: string;
  preferredStart?: string;
  preferredEnd?: string;
}) {
  const [action, setAction] = useState<"reschedule" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState(localDateTime(preferredStart));
  const [end, setEnd] = useState(localDateTime(preferredEnd));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [requestKey, setRequestKey] = useState("");
  if (
    ["Completed", "Cancelled", "In Progress", "Reschedule Required"].includes(
      status || "",
    )
  )
    return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      action === "cancel" &&
      !window.confirm(
        "Cancel the professional installation for this order? Hardware delivery will continue.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/installation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestKey,
          },
          body: JSON.stringify({
            action,
            reason,
            ...(action === "reschedule"
              ? {
                  requestedStart: new Date(start).toISOString(),
                  requestedEnd: new Date(end).toISOString(),
                }
              : {}),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || "Could not update the installation.",
        );
      setMessage(
        action === "reschedule"
          ? "Reschedule request sent to dispatch."
          : "Installation cancelled. Hardware delivery continues.",
      );
      setAction(null);
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the installation.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-t border-slate-200 pt-4 space-y-3 text-sm">
      <p className="font-semibold text-slate-800">
        Need to change your installation?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setAction("reschedule");
            setRequestKey(crypto.randomUUID());
            setMessage("");
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 font-semibold"
        >
          Request a new time
        </button>
        <button
          type="button"
          onClick={() => {
            setAction("cancel");
            setRequestKey(crypto.randomUUID());
            setMessage("");
          }}
          className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700"
        >
          Cancel installation
        </button>
      </div>
      {action && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-lg bg-slate-50 border border-slate-200 p-4"
        >
          {action === "reschedule" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Requested start
                <input
                  required
                  type="datetime-local"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className="mt-1 block w-full rounded border p-2"
                />
              </label>
              <label>
                Requested end
                <input
                  required
                  type="datetime-local"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className="mt-1 block w-full rounded border p-2"
                />
              </label>
            </div>
          )}
          <label>
            Reason
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
          <p className="text-xs text-slate-600">
            Hardware delivery continues. Installation cancellation requires at
            least 24 hours before a confirmed appointment.
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              type="submit"
              className="rounded bg-[#0e2378] px-3 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Submit request"}
            </button>
            <button type="button" onClick={() => setAction(null)}>
              Close
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="text-slate-700">
          {message}
        </p>
      )}
    </div>
  );
}
