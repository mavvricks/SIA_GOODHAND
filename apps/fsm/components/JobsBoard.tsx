"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusChip } from "@prototype/ui";
import type { StoredJob } from "@/lib/services/jobs-store";
import type { UserSession } from "@/lib/auth";
import {
  isQualified,
  type technicians as technicianDirectory,
} from "@/lib/technicians";

type Technician = (typeof technicianDirectory)[number] & {
  phone?: string;
  branch?: string;
};
type Job = Omit<
  StoredJob,
  "customerEmail" | "customerPhone" | "idempotencyKey"
> & { canClaim: boolean; claimBlockedReason?: string };
type Queue = {
  jobs: Job[];
  user: UserSession;
  technician?: Technician;
  technicians: Technician[];
};
type Action = (job: Job, action: string, body?: unknown) => Promise<boolean>;
const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const localInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

function AssignmentForm({
  job,
  technicians,
  onAction,
  busy,
}: {
  job: Job;
  technicians: Technician[];
  onAction: Action;
  busy: boolean;
}) {
  const [technicianId, setTechnicianId] = useState("");
  const [start, setStart] = useState(localInput(job.preferredStart));
  const [end, setEnd] = useState(localInput(job.preferredEnd));
  const eligible = technicians.filter((tech) => isQualified(tech, job.items));
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-3 border-t border-slate-200 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onAction(job, "assign", {
          technicianId,
          scheduledStart: new Date(start).toISOString(),
          scheduledEnd: new Date(end).toISOString(),
        });
      }}
    >
      <label className="text-xs font-semibold">
        Technician
        <select
          className="block w-full mt-1 p-2 border rounded bg-white"
          required
          value={technicianId}
          onChange={(event) => setTechnicianId(event.target.value)}
        >
          <option value="">Choose a qualified technician</option>
          {eligible.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.name} — {tech.branch || "Branch not set"} —{" "}
              {tech.phone || tech.email}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold">
        Schedule start
        <input
          className="block w-full mt-1 p-2 border rounded"
          required
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
      </label>
      <label className="text-xs font-semibold">
        Schedule end
        <input
          className="block w-full mt-1 p-2 border rounded"
          required
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </label>
      <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
        <button
          disabled={busy || !eligible.length}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded disabled:opacity-50"
        >
          Force assign
        </button>
        <span className="text-xs text-slate-500">
          Assign an unclaimed job. Qualifications and schedule conflicts are
          checked.
        </span>
      </div>
    </form>
  );
}

function CompletionForm({
  job,
  onAction,
  busy,
}: {
  job: Job;
  onAction: Action;
  busy: boolean;
}) {
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [serials, setSerials] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  return (
    <form
      className="mt-4 space-y-3 border-t pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onAction(job, "complete", {
          result: "success",
          completedAt: new Date().toISOString(),
          notes,
          usedItems: job.items
            .map((item) => ({
              sku: item.sku,
              quantity: item.quantity - (returned[item.sku] || 0),
              serialNumbers: (serials[item.sku] || "")
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter(Boolean),
            }))
            .filter((item) => item.quantity > 0),
          returnedItems: job.items
            .map((item) => ({
              sku: item.sku,
              quantity: returned[item.sku] || 0,
            }))
            .filter((item) => item.quantity > 0),
        });
      }}
    >
      <h3 className="font-semibold text-sm">Installation completion report</h3>
      {job.items.map((item) => (
        <fieldset key={item.sku} className="rounded border p-3 space-y-2">
          <legend className="px-1 text-xs font-semibold">
            {item.sku} · {item.quantity} ordered
          </legend>
          <label className="block text-xs">
            Units returned unused
            <input
              type="number"
              min={0}
              max={item.quantity}
              value={returned[item.sku] || 0}
              onChange={(event) =>
                setReturned({
                  ...returned,
                  [item.sku]: Number(event.target.value),
                })
              }
              className="block border rounded p-2 w-full mt-1"
            />
          </label>
          <label className="block text-xs">
            Installed serial numbers (one per line)
            <textarea
              rows={2}
              value={serials[item.sku] || ""}
              onChange={(event) =>
                setSerials({ ...serials, [item.sku]: event.target.value })
              }
              required={item.quantity - (returned[item.sku] || 0) > 0}
              className="block border rounded p-2 w-full mt-1"
            />
          </label>
        </fieldset>
      ))}
      <label className="block text-xs">
        Completion notes
        <textarea
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="block w-full border rounded mt-1 p-2"
        />
      </label>
      <button
        disabled={busy}
        className="bg-emerald-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
      >
        Submit completion report
      </button>
    </form>
  );
}

export function JobsBoard({ mode }: { mode: "dispatcher" | "technician" }) {
  const [data, setData] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [jobFeedback, setJobFeedback] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/jobs", { cache: "no-store" });
      if (response.status === 401) {
        setUnauthorized(true);
        setData(null);
        return;
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "Could not load jobs.");
      setData(result);
      setUnauthorized(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  const act: Action = async (job, action, body) => {
    setBusy(job.jobNumber);
    setJobFeedback((previous) => ({
      ...previous,
      [job.jobNumber]: "Working…",
    }));
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/jobs/${encodeURIComponent(job.jobNumber)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "Action failed.");
      setJobFeedback((previous) => ({
        ...previous,
        [job.jobNumber]:
          action === "unclaim"
            ? "Job returned to the pending queue."
            : "Saved successfully.",
      }));
      setMessage(
        action === "unclaim"
          ? "Job returned to the pending queue."
          : action === "claim"
            ? "Job claimed and scheduled for you."
            : action === "assign"
              ? "Technician assigned successfully."
              : action === "loading"
                ? "Hardware loading saved."
                : action === "start"
                  ? "Job started."
                  : "Completion report saved.",
      );
      await refresh();
      return true;
    } catch (err) {
      setJobFeedback((previous) => ({
        ...previous,
        [job.jobNumber]: err instanceof Error ? err.message : "Action failed.",
      }));
      await refresh();
      return false;
    } finally {
      setBusy(null);
    }
  };
  const techMode = data?.user.role === "technician";
  const pending =
    data?.jobs.filter(
      (job) => !job.technicianId && job.status === "Pending Scheduling",
    ) || [];
  const myJobs =
    data?.jobs.filter((job) => job.technicianId === data.technician?.id) || [];
  const visible = techMode ? myJobs : data?.jobs || [];
  const card = (job: Job, available = false) => (
    <article
      key={job.jobNumber}
      data-job-number={job.jobNumber}
      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 min-w-0"
    >
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-mono text-sm font-bold text-indigo-700 break-all">
            {job.jobNumber}
          </h3>
          <p className="text-xs text-slate-500 mt-1 break-all">
            Order {job.orderNumber}
          </p>
        </div>
        <StatusChip status={job.status} />
      </div>
      <p className="text-sm font-semibold mt-3">{job.customerName}</p>
      <p className="text-sm text-slate-600">
        {job.address.line1}, {job.address.city}, {job.address.province}
      </p>
      <p className="text-xs text-slate-600 mt-2">
        {job.scheduledStart ? "Scheduled" : "Preferred"}:{" "}
        {dateTime(job.scheduledStart || job.preferredStart)} –{" "}
        {dateTime(job.scheduledEnd || job.preferredEnd)}
      </p>
      <p className="text-xs mt-2">
        Technician: <strong>{job.technicianName || "Unclaimed"}</strong> ·{" "}
        {job.items.reduce((sum, item) => sum + item.quantity, 0)} unit(s)
      </p>
      {jobFeedback[job.jobNumber] && (
        <p
          role="status"
          className="mt-3 rounded border border-indigo-200 bg-indigo-50 p-3 text-sm"
        >
          {jobFeedback[job.jobNumber]}
        </p>
      )}
      {!techMode && job.releaseHistory?.length ? (
        <p className="text-sm mt-2 text-amber-800">
          Last release: {job.releaseHistory.at(-1)?.reason}
        </p>
      ) : null}
      {available ? (
        <div className="mt-4">
          <button
            disabled={Boolean(busy) || !job.canClaim}
            className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
            onClick={() => void act(job, "claim")}
          >
            {busy === job.jobNumber ? "Claiming…" : "Claim job"}
          </button>
          {!job.canClaim && (
            <p className="text-xs text-amber-800 mt-2">
              {job.claimBlockedReason ||
                "Requires qualifications outside your profile."}
            </p>
          )}
        </div>
      ) : (
        <button
          className="text-sm text-indigo-700 font-semibold mt-3"
          aria-expanded={expanded === job.jobNumber}
          onClick={() =>
            setExpanded(expanded === job.jobNumber ? null : job.jobNumber)
          }
        >
          {expanded === job.jobNumber ? "Hide details" : "View details"}
        </button>
      )}
      {!available && expanded === job.jobNumber && (
        <div className="mt-3">
          <ul className="text-xs space-y-2">
            {job.items.map((item) => (
              <li key={item.sku}>
                {item.sku} · {item.quantity} ordered · {item.loadedQuantity}{" "}
                loaded
              </li>
            ))}
          </ul>
          {job.specialInstructions && (
            <p className="text-xs text-slate-600 mt-3">
              Notes: {job.specialInstructions}
            </p>
          )}
          {!techMode &&
            !job.technicianId &&
            job.status === "Pending Scheduling" && (
              <AssignmentForm
                job={job}
                technicians={data!.technicians}
                onAction={act}
                busy={Boolean(busy)}
              />
            )}
          {techMode && job.status === "Scheduled" && (
            <div className="space-y-3 mt-4 border-t pt-3">
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const reason = String(new FormData(form).get("reason") || "");
                  if (
                    window.confirm(
                      "Return this job to the pending queue? Dispatch and the customer will see the assignment removed.",
                    )
                  )
                    await act(job, "unclaim", { reason });
                }}
              >
                <input
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Reason for unclaiming"
                  aria-label="Reason for unclaiming"
                  className="border rounded p-2 text-sm"
                />
                <button
                  disabled={Boolean(busy)}
                  className="border border-red-300 text-red-800 rounded p-2 text-sm"
                >
                  Unclaim job
                </button>
              </form>
              <h4 className="text-sm font-semibold">
                Hardware loading checklist
              </h4>
              {job.items.map((item) => (
                <label
                  key={item.sku}
                  className="flex gap-2 items-center text-sm"
                >
                  <input
                    type="checkbox"
                    checked={item.loadedQuantity === item.quantity}
                    disabled={Boolean(busy)}
                    onChange={(event) =>
                      void act(job, "loading", {
                        sku: item.sku,
                        loadedQuantity: event.target.checked
                          ? item.quantity
                          : 0,
                      })
                    }
                  />
                  {item.sku} · Confirm {item.quantity} loaded
                </label>
              ))}
              <button
                className="px-4 py-2 bg-indigo-700 text-white text-sm rounded disabled:opacity-40"
                disabled={
                  Boolean(busy) ||
                  job.items.some(
                    (item) => item.loadedQuantity !== item.quantity,
                  )
                }
                onClick={() => void act(job, "start")}
              >
                Start job
              </button>
            </div>
          )}
          {techMode && job.status === "In Progress" && (
            <CompletionForm job={job} onAction={act} busy={Boolean(busy)} />
          )}
        </div>
      )}
    </article>
  );
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {loading && <p role="status">Loading live jobs…</p>}
        {unauthorized && (
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="text-lg font-semibold">Sign in to view live jobs</h2>
            <p className="text-sm text-slate-600 mt-2">
              Technicians can claim pending jobs. Dispatchers and administrators
              can assign unclaimed jobs.
            </p>
            <Link
              href="/login"
              className="inline-block bg-indigo-600 text-white px-4 py-2 rounded mt-4"
            >
              Sign in to System B
            </Link>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="bg-red-50 text-red-800 border border-red-200 p-3 rounded"
          >
            {error}
          </div>
        )}
        {message && (
          <p
            role="status"
            className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded"
          >
            {message}
          </p>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["Pending Scheduling", pending.length],
                [
                  "Scheduled",
                  data.jobs.filter((job) => job.status === "Scheduled").length,
                ],
                [
                  "In Progress",
                  data.jobs.filter((job) => job.status === "In Progress")
                    .length,
                ],
                [
                  techMode ? "My Jobs" : "Active Technicians",
                  techMode ? myJobs.length : data.technicians.length,
                ],
              ].map(([label, count]) => (
                <div key={label} className="bg-white p-4 rounded-xl border">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-lg font-semibold">
                {techMode ? "My assigned jobs" : "Live field jobs"}
              </h2>
              <button
                className="text-sm font-semibold text-indigo-700"
                onClick={() => void refresh()}
              >
                Refresh jobs
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Updates automatically every 3 seconds. Schedules require a
              two-hour gap between jobs.
            </p>
            {!visible.length && (
              <p className="p-5 bg-white rounded border text-sm text-slate-500">
                {techMode
                  ? "No jobs assigned to you yet. Claim a pending job below."
                  : "No installation jobs yet. Checkout with installation in System A to create one."}
              </p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((job) => card(job))}
            </div>
            {techMode && (
              <>
                <h2 className="text-lg font-semibold pt-3">
                  Pending jobs available to claim
                </h2>
                {!pending.length && (
                  <p className="text-sm text-slate-500">
                    All pending jobs have been claimed or assigned.
                  </p>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                  {pending.map((job) => card(job, true))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
