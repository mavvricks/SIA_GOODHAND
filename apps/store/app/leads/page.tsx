'use client';

import React, { useState } from 'react';
import { ShieldCheck, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@prototype/ui';
import { StoreHeader } from '@/components/StoreHeader';

export default function LeadsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('Manila');
  const [serviceNeeded, setServiceNeeded] = useState('cctv');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StoreHeader />

      <main className="max-w-2xl mx-auto px-6 py-12 w-full flex-1">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-[#0e2378] mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Request Commercial Quote & Site Survey</h1>
          <p className="text-xs text-slate-600">
            Specialized perimeter and biometric security system consultations with our field engineers.
          </p>
        </div>

        {submitted ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-emerald-900">Lead Captured Successfully</h3>
            <p className="text-xs text-emerald-700">
              Our dispatch team will review your requirements and reach out to {mobile}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (PH)</label>
              <input
                type="text"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                required
                placeholder="09XXXXXXXXX"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City / Municipality</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">System Needed</label>
                <select
                  value={serviceNeeded}
                  onChange={e => setServiceNeeded(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="cctv">CCTV & IP Surveillance</option>
                  <option value="fence">Electric Wire Fence</option>
                  <option value="locks">Access Control & Smart Locks</option>
                  <option value="alarms">Burglar Alarm Hub</option>
                  <option value="radios">Two-Way Radio Network</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Details / Message (Max 500 chars)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Describe your site, perimeter distance, or number of doors..."
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <Button type="submit" variant="primary" size="md" className="w-full bg-[#0e2378] hover:bg-[#193893] text-sm font-semibold flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              Submit Consultation Request
            </Button>
          </form>
        )}
      </div>
      </main>
    </div>
  );
}
