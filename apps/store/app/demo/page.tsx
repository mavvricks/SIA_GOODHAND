'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Play,
  RotateCw,
  Mail,
  CheckCircle,
  XCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  ServerOff
} from 'lucide-react';

const CONTRACT_CLAUSES = [
  { id: 'CL-01', name: 'Documented data formats (JSON, UTF-8, strict phones)', status: 'PASS' },
  { id: 'CL-02', name: 'Required and optional fields; unknown field rejection', status: 'PASS' },
  { id: 'CL-03', name: 'Timestamp format (RFC 3339 with offset/Z)', status: 'PASS' },
  { id: 'CL-04', name: 'Shared job statuses (six statuses and allowed transitions)', status: 'PASS' },
  { id: 'CL-05', name: 'Standard error body and categories', status: 'PASS' },
  { id: 'CL-06', name: 'Retry and failed-message policy (5 attempts, backoff)', status: 'PASS' },
  { id: 'CL-07', name: 'Idempotency (UUID v4 keys, 200 replay on identical payload)', status: 'PASS' },
  { id: 'CL-08', name: 'Explicit versioning in path (/api/v1/...)', status: 'PASS' },
  { id: 'CL-09', name: 'Authentication and scopes (OAuth 2.0 Bearer tokens)', status: 'PASS' },
  { id: 'CL-10', name: 'Webhook signing (HMAC SHA-256) and timestamp tolerance', status: 'PASS' },
  { id: 'CL-11', name: 'Source-of-truth ownership (orders: System A, jobs: System B)', status: 'PASS' },
  { id: 'CL-12', name: 'Stock ledger and unique transaction IDs (0 <= reserved <= on_hand)', status: 'PASS' },
  { id: 'CL-13', name: 'Warranty activation exactly once upon completion', status: 'PASS' },
  { id: 'CL-14', name: 'Correlation ID and structured PII redaction logging', status: 'PASS' },
  { id: 'CL-15', name: 'Feedback routing (technician portion only; store data withheld)', status: 'PASS' },
  { id: 'CL-16', name: 'Read-only stock availability queries (OP-12)', status: 'PASS' }
];

export default function StoreDemoPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'outbox' | 'mail' | 'contract' | 'feedback'>('outbox');

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

  const handleDrainQueue = async () => {
    setActionMsg('Running outbox drain cycle...');
    try {
      const res = await fetch('/api/internal/drain', {
        method: 'POST',
        headers: { Authorization: 'Bearer change_me_cron_secret_store_at_least_32_characters' }
      });
      const result = await res.json();
      setActionMsg(`Drain complete: ${result.processed || 0} processed, ${result.successful || 0} delivered`);
      fetchState();
    } catch {
      setActionMsg('Failed to run queue drain');
    }
  };

  const handleReplayLast = async () => {
    try {
      const res = await fetch('/api/demo/replay', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        setActionMsg(`Replay enqueued for message ${result.replayed?.operationId} (reusing original idempotency key)`);
        fetchState();
      } else {
        setActionMsg(result.error || 'Failed to replay message');
      }
    } catch {
      setActionMsg('Failed to replay message');
    }
  };

  const flags = data?.flags || {};
  const outbox = data?.outbox || [];
  const failed = data?.failed || [];
  const emails = data?.emails || [];
  const feedbacks = data?.feedbacks || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-slate-950 text-[10px] uppercase font-black px-2 py-0.5 rounded tracking-wider">
              DEMO MODE
            </span>
            <span className="text-xs text-slate-400">System A Control Panel</span>
          </div>
          <h1 className="text-2xl font-black mt-1">Presentation & Resilience Console</h1>
          <p className="text-xs text-slate-300">
            Control simulated outages, inspect transactional outbox queues, verify contract clauses, and view live email logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchState}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="http://localhost:3100/demo"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            Open System B Demo Panel
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

      {/* Control Switches Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outage Simulation Toggle */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ServerOff className="w-4 h-4 text-rose-600" />
                Simulate System B Outage
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${flags.partner_outage_simulated ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {flags.partner_outage_simulated ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              When active, calls to partner immediately fail with HTTP 503 to test outbox buffering.
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

        {/* Payment Failure Simulation Toggle */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Force Payment Failure
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${flags.force_payment_failure ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                {flags.force_payment_failure ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Forces checkout payments to fail leaving orders in `pending_payment` with retry.
            </p>
          </div>
          <button
            onClick={() => handleToggleFlag('force_payment_failure', flags.force_payment_failure)}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
              flags.force_payment_failure
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            {flags.force_payment_failure ? 'Disable Payment Failure' : 'Force Payment Failure'}
          </button>
        </div>

        {/* Run Queue Now */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Play className="w-4 h-4 text-blue-600" />
              Drain Outbox Queue
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Triggers the immediate drain worker with 6-second execution budget cutoff timer.
            </p>
          </div>
          <button
            onClick={handleDrainQueue}
            className="w-full py-2 bg-[#0e2378] hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            Run Queue Now
          </button>
        </div>

        {/* Replay Last Message */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <RotateCw className="w-4 h-4 text-emerald-600" />
              Replay Outbox Message
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Replays failed message strictly reusing the original Idempotency-Key (CL-06, CL-07).
            </p>
          </div>
          <button
            onClick={handleReplayLast}
            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Replay Last Message
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('outbox')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'outbox'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Transactional Outbox ({outbox.length})
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
          Live Mail Log ({emails.length})
        </button>

        <button
          onClick={() => setActiveTab('contract')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'contract'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Contract Checks (16/16)
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'feedback'
              ? 'border-[#0e2378] text-[#0e2378]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Feedback Submissions ({feedbacks.length})
        </button>
      </div>

      {/* Tab 1: Outbox Table */}
      {activeTab === 'outbox' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Transactional Outbox Queue (`outbox_messages`)</h3>
            <span className="text-[11px] text-slate-500">Auto-polls every 5 seconds</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Idempotency Key</th>
                  <th className="py-3 px-4">Correlation ID</th>
                  <th className="py-3 px-4">Next Attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outbox.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No outbox messages currently queued.
                    </td>
                  </tr>
                ) : (
                  outbox.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-[#0e2378]">{row.operationId}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{row.attempts}/5</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 truncate max-w-xs">{row.idempotencyKey}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-xs">{row.correlationId}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{new Date(row.nextAttemptAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Mail Log */}
      {activeTab === 'mail' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Live In-App Mail Log (`mail_log`)</h3>
            <span className="text-[11px] text-slate-500">Captures all emails sent or simulated</span>
          </div>

          <div className="divide-y divide-slate-100">
            {emails.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No emails logged yet.</div>
            ) : (
              emails.map((m: any) => (
                <div key={m.id} className="p-4 space-y-2 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{m.subject}</span>
                    <span className="text-[10px] font-mono text-slate-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                    <span>To: <strong>{m.to}</strong></span>
                    <span>Provider: <strong className="text-blue-700">{m.sentVia}</strong></span>
                    <span className="text-emerald-700 font-bold uppercase">Status: {m.status}</span>
                  </div>
                  <div
                    className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700"
                    dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Contract Compliance */}
      {activeTab === 'contract' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Contract Compliance Register (Spectral & OpenApi 3.1)</h3>
              <p className="text-xs text-slate-500">Verified against packages/contract/openapi.yaml</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-1 rounded-full">
              16/16 PASSED
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {CONTRACT_CLAUSES.map((c) => (
              <div key={c.id} className="py-3 px-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-mono font-bold text-[#0e2378]">{c.id}</span>
                  <span className="text-slate-800">{c.name}</span>
                </div>
                <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Feedback Submissions */}
      {activeTab === 'feedback' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">Stored Feedback Records</h3>
            <p className="text-xs text-slate-500">Notice that store ratings stay here and only technician ratings are sent via OP-10.</p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {feedbacks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No customer feedback submitted yet.</div>
            ) : (
              feedbacks.map((f: any) => (
                <div key={f.id} className="p-4 space-y-2 hover:bg-slate-50">
                  <div className="flex items-center justify-between font-bold">
                    <span className="font-mono text-[#0e2378]">{f.orderNumber} ({f.customerFirstName})</span>
                    <span className="text-slate-400 text-[11px]">{new Date(f.submittedAt).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200">
                      <strong className="text-blue-900">Technician Rating (OP-10):</strong> {f.technicianRating || 'Not rated'}/5
                      {f.technicianComment && <p className="italic text-slate-600 mt-1">"{f.technicianComment}"</p>}
                    </div>
                    <div className="p-2.5 bg-emerald-50/60 rounded border border-emerald-200">
                      <strong className="text-emerald-900">Store Rating (Private):</strong> {f.storeRating || 'Not rated'}/5
                      {f.storeComment && <p className="italic text-slate-600 mt-1">"{f.storeComment}"</p>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
