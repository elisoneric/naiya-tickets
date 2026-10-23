import React from 'react';
import { TicketStatus } from '../../types';

export const StatusBadge: React.FC<{ status: TicketStatus; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const styles: Record<TicketStatus, { bg: string; text: string; dot: string }> = {
    'Open': {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500'
    },
    'In Progress': {
      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500'
    },
    'Closed': {
      bg: 'bg-surface-100 dark:bg-dark-hover border-surface-200 dark:border-dark-border',
      text: 'text-surface-600 dark:text-dark-textMuted',
      dot: 'bg-surface-400 dark:bg-surface-600'
    },
  };

  const current = styles[status] || styles['Open'];
  const sizeClasses = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap shadow-xs ${current.bg} ${current.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />
      <span>{status}</span>
    </span>
  );
};
