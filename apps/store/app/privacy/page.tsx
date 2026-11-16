import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function StorePrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <Link href="/" className="text-xs font-bold text-[#0e2378] hover:underline flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Store Home
      </Link>

      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 flex items-start gap-4">
        <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-amber-950">Academic Prototype Disclaimer</h1>
          <p className="text-xs text-amber-800 leading-relaxed">
            This web application is a university integration prototype created exclusively for academic research,
            architectural demonstration, and technical assessment. It is <strong>not</strong> an official commercial
            service of GoodHand Security Products. All brand names, trade marks, product specifications, and imagery
            are used strictly for educational prototype evaluation under fair use.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 text-slate-700 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-slate-900 border-b pb-3">Privacy & Data Handling Policy</h2>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">1. Nature of Stored Data</h3>
          <p className="text-xs text-slate-600">
            All user profiles, customer names, contact phone numbers, delivery addresses, and installation logs
            stored in this database are synthetic and simulated. Do not input real personal confidential information,
            banking details, credit cards, or actual security credentials into this system.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">2. System Isolation & Privacy Boundary (CL-15)</h3>
          <p className="text-xs text-slate-600">
            In accordance with architectural clause CL-15, customer feedback submitted regarding store shopping
            experience remains strictly private within System A. Only verified technician evaluation scores,
            technician category tags, and customer first names are routed to the Field Service Management platform
            (System B). Full customer contact details are never transmitted or stored in feedback repositories.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">3. Data Retention & Demo Resets</h3>
          <p className="text-xs text-slate-600">
            All session records, cart entries, outbox messages, and orders are subject to programmatic baseline
            resets via the administrator demo panel (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">/demo</code>)
            or periodic migration purges.
          </p>
        </section>
      </div>
    </div>
  );
}
