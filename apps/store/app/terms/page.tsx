import React from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, AlertCircle } from 'lucide-react';

export default function StoreTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <Link href="/" className="text-xs font-bold text-[#0e2378] hover:underline flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Store Home
      </Link>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 flex items-start gap-4">
        <FileText className="w-8 h-8 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-blue-950">Terms of Demonstration</h1>
          <p className="text-xs text-blue-800 leading-relaxed">
            By accessing or interacting with this demonstration prototype, you acknowledge that no commercial
            transactions, binding hardware contracts, physical product shipments, or actual field dispatches will occur.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 text-slate-700 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-slate-900 border-b pb-3">Prototype Evaluation Rules</h2>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">1. Simulated Payments & Ordering</h3>
          <p className="text-xs text-slate-600">
            Payment transactions executed during checkout are entirely simulated. No real credit card, e-wallet,
            or banking APIs are invoked. Currency figures in Philippine Peso (PHP) represent simulated catalog prices
            for testing system accounting and inventory movement calculations.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">2. Installation Warranties & Hardware</h3>
          <p className="text-xs text-slate-600">
            The 12-month hardware warranty activations displayed on the customer dashboard are architectural
            demonstrations generated upon simulated job completion (OP-07) and hold no commercial or legal warranty
            obligation in the physical world.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">3. Safe Harbor & Fair Use</h3>
          <p className="text-xs text-slate-600">
            This prototype is designed in accordance with academic fair use standards to study distributed transactions,
            idempotency, exclusion-constraint scheduling, and transactional outbox patterns.
          </p>
        </section>
      </div>
    </div>
  );
}
