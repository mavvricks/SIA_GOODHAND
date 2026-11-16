import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export default function FsmTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <Link href="/" className="text-xs font-bold text-[#0e2378] hover:underline flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to FSM Console
      </Link>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 flex items-start gap-4">
        <FileText className="w-8 h-8 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-blue-950">Field Operations Terms of Evaluation</h1>
          <p className="text-xs text-blue-800 leading-relaxed">
            This platform demonstrates PostgreSQL exclusion-constraint appointment scheduling, mobile-first
            hardware loading gates, and idempotent completion webhooks.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 text-slate-700 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-slate-900 border-b pb-3">Operational Scope</h2>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">1. Double-Booking Constraint Guard</h3>
          <p className="text-xs text-slate-600">
            Field appointments are protected against double-booking via PostgreSQL GiST exclusion constraints
            on active technician appointments (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">EXCLUDE USING gist (technician_id WITH =, period WITH &&)</code>).
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">2. Loading Gate Enforcement</h3>
          <p className="text-xs text-slate-600">
            Jobs cannot transition from Scheduled to In Progress until all required physical hardware units
            have been verified and confirmed loaded by the assigned technician.
          </p>
        </section>
      </div>
    </div>
  );
}
