'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, MessageSquare, ArrowLeft, ShieldAlert, Award } from 'lucide-react';

interface FeedbackItem {
  id: string;
  jobNumber: string;
  rating: number;
  comment?: string;
  tags: string[];
  customerFirstName: string;
  receivedAt: string;
}

export default function TechnicianFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Default seed review for Tech-001 Arnel Mendoza
  useEffect(() => {
    // Fetch from store or initial sample
    const sampleFeedbacks: FeedbackItem[] = [
      {
        id: 'fb-sample-1',
        jobNumber: 'JOB-20261110-000001',
        rating: 5,
        comment: 'Arnel was very punctual and properly sealed all outdoor conduit junctions. Great work!',
        tags: ['on_time', 'professional', 'clean_work', 'explained_clearly'],
        customerFirstName: 'Juan',
        receivedAt: new Date(Date.now() - 3600000).toISOString()
      }
    ];

    setFeedbacks(sampleFeedbacks);
    setLoading(false);
  }, []);

  const totalReviews = feedbacks.length;
  const averageRating = totalReviews > 0
    ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalReviews).toFixed(1)
    : '5.0';

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 min-h-screen bg-slate-100 pb-16">
      {/* Mobile Header */}
      <div className="bg-[#0e2378] text-white p-4 rounded-xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/technician" className="p-1 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-xs text-blue-200 uppercase font-semibold">Performance & Reviews</span>
            <h1 className="text-lg font-bold">My Feedback</h1>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
          AM
        </div>
      </div>

      {/* Summary Score Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase">Average Rating</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-3xl font-extrabold text-slate-900">{averageRating}</span>
            <div className="flex text-amber-400">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${s <= Number(averageRating) ? 'fill-amber-400' : 'text-slate-200'}`}
                />
              ))}
            </div>
          </div>
          <span className="text-[11px] text-slate-400">Based on {totalReviews} completed verified jobs</span>
        </div>
        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
          <Award className="w-8 h-8" />
        </div>
      </div>

      {/* Privacy Notice Banner (CL-15) */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px] flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Privacy Boundary Enforced:</strong> Only technician-specific reviews are visible. Customer contact details and store ratings are strictly protected.
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Customer Reviews</h2>
        {feedbacks.map((fb) => (
          <div key={fb.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">{fb.customerFirstName}</span>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${s <= fb.rating ? 'fill-amber-400' : 'text-slate-200'}`}
                  />
                ))}
              </div>
            </div>

            <div className="text-xs font-mono text-slate-500 flex items-center justify-between">
              <span>{fb.jobNumber}</span>
              <span>{new Date(fb.receivedAt).toLocaleDateString()}</span>
            </div>

            {fb.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {fb.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium"
                  >
                    #{tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {fb.comment && (
              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                "{fb.comment}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
