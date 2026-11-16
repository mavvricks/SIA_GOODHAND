import React from 'react';
import { Clock, CalendarCheck, Wrench, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { JobStatus } from '@prototype/contract';

interface StatusChipProps {
  status: JobStatus;
  className?: string;
}

const statusConfig: Record<JobStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}> = {
  'Pending Scheduling': {
    label: 'Pending Scheduling',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: Clock
  },
  'Scheduled': {
    label: 'Scheduled',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    icon: CalendarCheck
  },
  'In Progress': {
    label: 'In Progress',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-300',
    icon: Wrench
  },
  'Completed': {
    label: 'Completed',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    icon: CheckCircle2
  },
  'Cancelled': {
    label: 'Cancelled',
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-300',
    icon: XCircle
  },
  'Reschedule Required': {
    label: 'Reschedule Required',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    icon: AlertCircle
  }
};

export function StatusChip({ status, className = '' }: StatusChipProps) {
  const config = statusConfig[status] || {
    label: status,
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    icon: Clock
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <IconComponent className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
