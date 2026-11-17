"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "./Button";

type Message = {
  id: string;
  operationId: string;
  orderNumber?: string;
  jobNumber?: string;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
  finalError?: string;
};
type Failed = {
  id: string;
  operationId: string;
  orderNumber?: string;
  finalError?: string;
  createdAt: string;
};
type Unassigned = {
  jobNumber: string;
  orderNumber: string;
  area: string;
  preferredStart: string;
};
export function OperationsConsole({ system }: { system: "store" | "fsm" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [unassigned, setUnassigned] = useState<Unassigned[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          "Unable to load operations. Sign in with a staff account.",
        );
      const data = await response.json();
      setMessages(data.messages || []);
      setFailed(data.failed || []);
      setUnassigned(data.unassigned || []);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load operations.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  const retry = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error?.message || "Retry failed.",
        );
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Retry failed.");
    } finally {
      setBusy("");
    }
  };
  const failures =
    system === "store"
      ? failed
      : messages.filter((row) => row.status === "failed");
  const active = messages.filter((row) => row.status === "pending");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Operations queue</h1>
          <p className="text-sm text-slate-600">
            Pending integration work and delivery history. Refreshes every 10
            seconds.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-red-800"
        >
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border bg-white p-4">
          <strong className="text-2xl">{active.length}</strong>
          <p>Pending events</p>
        </div>
        <div className="rounded border bg-white p-4">
          <strong className="text-2xl">{failures.length}</strong>
          <p>Failed deliveries</p>
        </div>
        <div className="rounded border bg-white p-4">
          <strong className="text-2xl">{unassigned.length}</strong>
          <p>Unassigned jobs</p>
        </div>
      </div>
      <section className="rounded border bg-white p-4 space-y-3">
        <h2 className="text-lg font-bold">Failed events</h2>
        {failures.length === 0 ? (
          <p className="text-sm text-slate-500">No failed events.</p>
        ) : (
          <div className="space-y-2">
            {failures.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm"
              >
                <div>
                  <strong>{row.operationId}</strong> ·{" "}
                  {row.orderNumber || "Order unknown"}
                  <p className="text-slate-500">
                    {row.finalError || "Delivery failed"} ·{" "}
                    {new Date(row.createdAt).toLocaleString("en-PH")}
                  </p>
                </div>
                <Button
                  size="sm"
                  isLoading={busy === row.id}
                  onClick={() => void retry(row.id)}
                >
                  Replay safely
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded border bg-white p-4 space-y-3">
        <h2 className="text-lg font-bold">Event delivery log</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Operation</th>
                  <th className="p-2">Order</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {messages
                  .slice()
                  .reverse()
                  .slice(0, 100)
                  .map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{row.operationId}</td>
                      <td className="p-2">{row.orderNumber || "—"}</td>
                      <td className="p-2">{row.status}</td>
                      <td className="p-2">{row.attempts}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {system === "fsm" && (
        <section className="rounded border bg-white p-4 space-y-3">
          <h2 className="text-lg font-bold">Unassigned installation jobs</h2>
          {unassigned.length === 0 ? (
            <p className="text-sm text-slate-500">No unassigned jobs.</p>
          ) : (
            unassigned.map((job) => (
              <div
                key={job.jobNumber}
                className="flex flex-wrap items-center justify-between gap-3 border-t p-2 text-sm"
              >
                <div>
                  <strong>{job.jobNumber}</strong> · {job.area}
                  <p className="text-slate-500">
                    {job.orderNumber} ·{" "}
                    {new Date(job.preferredStart).toLocaleString("en-PH")}
                  </p>
                </div>
                <a href="/" className="font-semibold text-blue-800 underline">
                  Assign in Jobs Queue
                </a>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
