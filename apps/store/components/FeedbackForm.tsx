'use client';

import React, { useState } from 'react';
import { Star, CheckCircle, MessageSquare } from 'lucide-react';

interface FeedbackFormProps {
  orderNumber: string;
  technicianName?: string;
  isCompleted: boolean;
}

const TECHNICIAN_TAGS = [
  { id: 'on_time', label: 'On Time' },
  { id: 'late', label: 'Late' },
  { id: 'professional', label: 'Professional' },
  { id: 'unprofessional', label: 'Unprofessional' },
  { id: 'clean_work', label: 'Clean Work' },
  { id: 'messy_work', label: 'Messy Work' },
  { id: 'explained_clearly', label: 'Explained Clearly' }
];

const STORE_TAGS = [
  { id: 'product_quality', label: 'Product Quality' },
  { id: 'product_issue', label: 'Product Issue' },
  { id: 'easy_checkout', label: 'Easy Checkout' },
  { id: 'checkout_problem', label: 'Checkout Problem' },
  { id: 'good_communication', label: 'Good Communication' },
  { id: 'poor_communication', label: 'Poor Communication' }
];

export function FeedbackForm({ orderNumber, technicianName, isCompleted }: FeedbackFormProps) {
  const [techRating, setTechRating] = useState<number | null>(null);
  const [techComment, setTechComment] = useState('');
  const [selectedTechTags, setSelectedTechTags] = useState<string[]>([]);

  const [storeRating, setStoreRating] = useState<number | null>(null);
  const [storeComment, setStoreComment] = useState('');
  const [selectedStoreTags, setSelectedStoreTags] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleTechTag = (tag: string) => {
    setSelectedTechTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleStoreTag = (tag: string) => {
    setSelectedStoreTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (techRating === null && storeRating === null) {
      setErrorMsg('Please provide a rating for either the technician or your store shopping experience.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          technicianRating: techRating !== null ? techRating : undefined,
          technicianComment: techComment || undefined,
          technicianTags: selectedTechTags.length > 0 ? selectedTechTags : undefined,
          storeRating: storeRating !== null ? storeRating : undefined,
          storeComment: storeComment || undefined,
          storeTags: selectedStoreTags.length > 0 ? selectedStoreTags : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while submitting feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isCompleted) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">
        Feedback will be available once your installation is completed by the field technician.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-2">
        <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
        <h3 className="font-bold text-base text-emerald-900">Thank you for your feedback!</h3>
        <p className="text-xs text-emerald-700 max-w-md mx-auto">
          Your installation review has been securely routed to field operations. You have a 7-day window to update your review if needed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="border-b pb-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#0e2378]" />
          Rate Your Experience
        </h2>
        <p className="text-xs text-slate-500">
          Share your feedback to help us maintain top quality security service.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Section 1: Technician & Installation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            1. Your Installation & Technician ({technicianName || 'Field Technician'})
          </h3>
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
            Transmitted to System B (OP-10)
          </span>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Technician Rating</label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setTechRating(star)}
                className="focus:outline-none focus:ring-2 focus:ring-[#0e2378] rounded p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 ${
                    techRating !== null && star <= techRating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
            {techRating && (
              <span className="text-xs font-bold text-slate-700 ml-2">{techRating} of 5 stars</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1.5 font-medium">Technician Highlights (select applicable):</label>
          <div className="flex flex-wrap gap-1.5">
            {TECHNICIAN_TAGS.map(tag => {
              const active = selectedTechTags.includes(tag.id);
              return (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => toggleTechTag(tag.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-600 font-medium">Technician Comments (Optional)</label>
            <span className="text-[11px] text-slate-400">{techComment.length}/1000</span>
          </div>
          <textarea
            value={techComment}
            onChange={(e) => setTechComment(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Tell us about the technician's professionalism, cleanliness, or punctuality..."
            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e2378] focus:border-transparent outline-none"
          />
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Section 2: Store Experience */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            2. Your Shopping & Store Experience
          </h3>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
            Kept strictly in System A (CL-15 Privacy Boundary)
          </span>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Store Rating</label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setStoreRating(star)}
                className="focus:outline-none focus:ring-2 focus:ring-[#0e2378] rounded p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-6 h-6 ${
                    storeRating !== null && star <= storeRating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
            {storeRating && (
              <span className="text-xs font-bold text-slate-700 ml-2">{storeRating} of 5 stars</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1.5 font-medium">Store Highlights (select applicable):</label>
          <div className="flex flex-wrap gap-1.5">
            {STORE_TAGS.map(tag => {
              const active = selectedStoreTags.includes(tag.id);
              return (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => toggleStoreTag(tag.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-600 font-medium">Store Comments (Optional)</label>
            <span className="text-[11px] text-slate-400">{storeComment.length}/1000</span>
          </div>
          <textarea
            value={storeComment}
            onChange={(e) => setStoreComment(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Tell us about the website ordering, pricing, or product selection..."
            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e2378] focus:border-transparent outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-[#0e2378] text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
      >
        {submitting ? 'Submitting Review...' : 'Submit Feedback'}
      </button>
    </form>
  );
}
