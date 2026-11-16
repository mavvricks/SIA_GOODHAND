import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function FsmPrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <Link href="/" className="text-xs font-bold text-[#0e2378] hover:underline flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to FSM Console
      </Link>

      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 flex items-start gap-4">
        <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-amber-950">Academic Prototype Disclaimer (System B)</h1>
          <p className="text-xs text-amber-800 leading-relaxed">
            This Field Service Management portal is an academic engineering prototype. It is not connected
            to real field technicians, dispatch centers, or physical fleet monitoring equipment. All technician
            profiles and job dispatches are synthetic.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 text-slate-700 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-slate-900 border-b pb-3">Field Service Privacy & Isolation</h2>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">1. Customer Data Masking (CL-15)</h3>
          <p className="text-xs text-slate-600">
            System B feedback tables never store a customer's email, telephone number, or postal address.
            Only the customer's first name and technical performance ratings are recorded to respect customer privacy.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">2. Role-Based Data Isolation (TC-28)</h3>
          <p className="text-xs text-slate-600">
            Technicians are strictly isolated to their own assigned appointments, loading checklists, and feedback scores.
            Direct object reference requests to access another technician's performance return 404 Not Found.
          </p>
        </section>
      </div>
    </div>
  );
}
