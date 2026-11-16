'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RotateCw,
  ServerOff,
  ShieldCheck,
  CheckCircle,
  Mail,
  Database,
  ArrowRight,
  AlertCircle,
  Activity,
  Star
} from 'lucide-react';

export default function FsmDemoPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'outbox' | 'feedback' | 'mail'>('jobs');

  const fetchState = async () => {
    try {
      const res = await fetch('/api/demo/state');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load demo state', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleFlag = async (key: string, currentValue: boolean) => {
    try {
      const res = await fetch('/api/demo/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: !currentValue })
      });
      if (res.ok) {
        setActionMsg(`Flag ${key} set to ${!currentValue}`);
        fetchState();
      }
    } catch {
      setActionMsg('Failed to update simulation flag');
    }
  };

  const flags = data?.flags || {};
  const jobs = data?.jobs || [];
  const outbox = data?.outbox || [];
  const feedbacks = data?.feedbacks || [];
  const followups = data?.followups || [];
  const emails = data?.emails || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0e2378] text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-slate-950 text-[10px] uppercase font-black px-2 py-0.5 rounded tracking-wider">
              DEMO MODE
            </span>
            <span className="text-xs text-blue-200">System B Field Operations Control Panel</span>
          </div>
          <h1 className="text-2xl font-black mt-1">FSM Operations & Outbox Console</h1>
          <p className="text-xs text-blue-100">
            Control partner outage simulation, inspect OP-05/OP-06/OP-07/OP-08 outbox webhooks, review low-rating follow-ups, and verify jobs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchState}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="http://localhost:3000/demo"
            className="px-3.5 py-2 bg-white text-[#0e2378] hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            Open System A Demo Panel
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-blue-500 hover:text-blue-700 font-bold">×</button>
        </div>
      )}

      {/* Control Switch Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ServerOff className="w-4 h-4 text-rose-600" />
                Simulate FSM System Outage
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${flags.partner_outage_simulated ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {flags.partner_outage_simulated ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              When active, API requests to System B return 503 SERVICE_UNAVAILABLE to test System A store outbox buffer.
            </p>
          </div>
          <button
            onClick={() => handleToggleFlag('partner_outage_simulated', flags.partner_outage_simulated)}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
              flags.partner_outage_simulated
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            {flags.partner_outage_simulated ? 'Disable Outage' : 'Simulate Outage'}
          </button>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2">
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Low Rating Follow-Up Queue
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Technician ratings ≤ 2 trigger automatic follow-up records with status OPEN (TC-24, D14).
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-bold p-2 bg-slate-50 rounded-lg">
            <span>Open Follow-ups:</span>
            <span className="text-rose-600 font-mono text-sm">{followups.filter((f: any) => f.status === 'open').length}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2">
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" />
              Webhook Outbox Buffer
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              OP-05 (Schedule), OP-06 (Status), OP-07 (Completion), OP-08 (Inventory) messages dispatched to System A.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs font-bold p-2 bg-slate-50 rounded-lg">
            <span>Pending Outbox:</span>
            <span className="text-blue-700 font-mono text-sm">{outbox.length}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'jobs'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Active Jobs ({jobs.length})
        </button>

        <button
          onClick={() => setActiveTab('outbox')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'outbox'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Webhook Outbox Messages ({outbox.length})
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'feedback'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star className="w-4 h-4" />
          Technician Feedback & Follow-ups ({feedbacks.length})
        </button>

        <button
          onClick={() => setActiveTab('mail')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'mail'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          Mail Log ({emails.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'jobs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">System B Jobs Ledger (`jobs`)</h3>
            <span className="text-[11px] text-slate-500">Includes idempotency verification</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Job Number</th>
                  <th className="py-3 px-4">Order Number</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j: any) => (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#0e2378]">{j.jobNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{j.orderNumber}</td>
                    <td className="py-3 px-4">{j.customerName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{j.technicianName || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {j.scheduledStart ? new Date(j.scheduledStart).toLocaleString() : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'outbox' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">Outgoing Webhooks Outbox</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payload Summary</th>
                  <th className="py-3 px-4">Idempotency Key</th>
                  <th className="py-3 px-4">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outbox.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No outgoing webhook messages in buffer.</td>
                  </tr>
                ) : (
                  outbox.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-[#0e2378]">{row.operationId}</td>
                      <td className="py-3 px-4 font-bold text-amber-700 uppercase text-[10px]">{row.status}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {row.operationId === 'OP-08'
                          ? `Adj SKU: ${row.payload.sku} (${row.payload.type} x${row.payload.quantity})`
                          : `Job: ${row.payload.jobNumber || row.payload.orderNumber}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-xs">{row.idempotencyKey}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{new Date(row.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Technician Feedback Records (System B)</h3>
              <p className="text-xs text-slate-500">CL-15 Privacy Boundary: Only technician ratings & tags stored here. No customer contact data.</p>
            </div>
            <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full">
              {feedbacks.length} Reviews
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {feedbacks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No technician feedback recorded yet.</div>
            ) : (
              feedbacks.map((f: any) => (
                <div key={f.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{f.jobNumber} — Customer: {f.customerFirstName}</span>
                    <span className="font-bold text-amber-600 font-mono">{f.rating}/5 Stars</span>
                  </div>
                  {f.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {f.tags.map((t: string) => (
                        <span key={t} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {f.comment && <p className="italic text-slate-600">"{f.comment}"</p>}
                  {f.flaggedForReview && (
                    <div className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded inline-block mt-1">
                      ⚠️ Flagged for review (Rating ≤ 2)
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'mail' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 text-xs">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">Live Mail Log</div>
          {emails.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No email logs in System B.</div>
          ) : (
            emails.map((e: any) => (
              <div key={e.id} className="p-4 space-y-1.5 hover:bg-slate-50">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{e.subject}</span>
                  <span className="text-[10px] font-mono text-slate-400">{new Date(e.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-500 font-mono text-[11px]">To: {e.to} • Provider: {e.sentVia}</div>
                <div className="p-2.5 bg-slate-50 rounded border text-slate-700" dangerouslySetInnerHTML={{ __html: e.bodyHtml }} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
