"use client";
import { useEffect, useState } from "react";
export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const load = async () => {
    try {
      const res = await fetch("/api/v1/technicians", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "Could not load technicians");
      setTechnicians(data.technicians);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    void load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-5">
      <div className="rounded-2xl bg-[#0b1c2d] px-6 py-6 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffc400]">
          Dispatch resources
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          Technician directory
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Find qualified technicians by name, branch or skill. Schedules require
          two hours between jobs.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <input
        aria-label="Search technicians"
        placeholder="Search name, branch or qualification"
        className="fsm-input p-3 w-full"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="grid md:grid-cols-2 gap-4">
        {technicians
          .filter((t) =>
            [t.name, t.branch, ...t.qualifications]
              .join(" ")
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((t) => (
            <article key={t.id} className="fsm-card p-5 space-y-3">
              <h2 className="text-lg font-bold">{t.name}</h2>
              <p>
                {t.code} · {t.qualifications.join(", ")}
              </p>
              <a href={"mailto:" + t.email} className="fsm-link text-sm">
                {t.email}
              </a>
              <p>
                Branch: {t.branch || "Not set"} · Phone: {t.phone || "Not set"}
              </p>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  setFeedback((old) => ({ ...old, [t.id]: "Saving…" }));
                  try {
                    const res = await fetch("/api/v1/technicians", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: t.id,
                        phone: values.get("phone"),
                        branch: values.get("branch"),
                      }),
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error?.message);
                    setFeedback((old) => ({
                      ...old,
                      [t.id]: "Contact details saved.",
                    }));
                    await load();
                  } catch (e: any) {
                    setFeedback((old) => ({ ...old, [t.id]: e.message }));
                  }
                }}
              >
                <label className="text-sm">
                  Working branch
                  <input
                    name="branch"
                    maxLength={120}
                    defaultValue={t.branch}
                    className="fsm-input block p-2"
                  />
                </label>
                <label className="text-sm">
                  Contact phone
                  <input
                    name="phone"
                    type="tel"
                    maxLength={30}
                    defaultValue={t.phone}
                    className="fsm-input block p-2"
                  />
                </label>
                <button className="fsm-action px-4 py-2 text-sm">
                  Save details
                </button>
              </form>
              <p role="status">{feedback[t.id]}</p>
              <h3 className="font-semibold">
                Active assignments ({t.jobs.length})
              </h3>
              {t.jobs.map((j: any) => (
                <p key={j.jobNumber} className="text-sm">
                  {j.jobNumber} · {j.area}
                  <br />
                  {new Date(j.start).toLocaleString("en-PH")} –{" "}
                  {new Date(j.end).toLocaleString("en-PH")}
                </p>
              ))}
              {!t.jobs.length && (
                <p className="text-sm text-slate-500">No active assignments.</p>
              )}
            </article>
          ))}
      </div>
    </main>
  );
}
