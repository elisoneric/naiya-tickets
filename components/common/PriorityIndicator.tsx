import React from 'react';
import { TicketPriority } from '../../types';
import { AlertCircle } from 'lucide-react';

export const PriorityIndicator: React.FC<{ priority: TicketPriority }> = ({ priority }) => {
  if (priority === 'High') {
    return <AlertCircle size={16} className="text-red-500" />;
  }
  if (priority === 'Medium') {
    return <span className="w-2 h-2 rounded-full bg-yellow-400" />;
  }
  // Low
  return <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />;
};
