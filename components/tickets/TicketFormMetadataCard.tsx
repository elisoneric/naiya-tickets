import React, { useState } from 'react';
import { Ticket } from '../../types';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';

export interface ExtractedTicketMetadata {
  nin?: string;
  phone?: string;
  email?: string;
  fullName?: string;
  fep?: string;
  requestType?: string;
}

export function cleanDigits(val: string): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

export function cleanPhoneNumber(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  // Strip non-digit characters except leading plus
  let cleaned = str.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+234')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('234') && cleaned.length >= 13) {
    cleaned = '0' + cleaned.slice(3);
  }
  // Return only pure digits (e.g. 08012341234)
  return cleaned.replace(/\D/g, '');
}

export function extractTicketMetadata(
  description: string = '',
  title: string = '',
  createdByEmail: string = '',
  createdByName: string = '',
  project: string = ''
): ExtractedTicketMetadata {
  const result: ExtractedTicketMetadata = {};
  const text = `${title || ''}\n${description || ''}`;

  // 1. NIN extraction (explicit label first)
  const ninMatch = text.match(/(?:Agent\s+)?NIN(?:\s*Number|\s*Login)?\s*[:=\-]\s*([0-9\s]{10,13})/i);
  if (ninMatch) {
    const digits = cleanDigits(ninMatch[1]);
    if (digits.length >= 10 && digits.length <= 11) {
      result.nin = digits;
    }
  }
  if (!result.nin) {
    // Standalone 11 digits
    const standaloneNin = text.match(/\b([0-9]{11})\b/);
    if (standaloneNin) {
      result.nin = standaloneNin[1];
    }
  }

  // 2. Phone extraction (explicit label first)
  const phoneMatch = text.match(/(?:Agent\s+)?Phone(?:\s*Number|\s*No\.?)?\s*[:=\-]\s*([+0-9\s\-()]{10,20})/i);
  if (phoneMatch) {
    const cleaned = cleanPhoneNumber(phoneMatch[1]);
    if (cleaned.length >= 10 && cleaned.length <= 14) {
      result.phone = cleaned;
    }
  }
  if (!result.phone) {
    // Standalone Nigerian mobile number
    const standalonePhone = text.match(/\b(0[789][01]\d{8})\b/);
    if (standalonePhone) {
      result.phone = standalonePhone[1];
    }
  }

  // 3. Email extraction
  const emailMatch = text.match(/(?:Agent\s+)?Email(?:\s*Address)?\s*[:=\-]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    result.email = emailMatch[1].trim();
  } else if (
    createdByEmail &&
    createdByEmail.includes('@') &&
    !createdByEmail.includes('unknown') &&
    !createdByEmail.includes('guest') &&
    !createdByEmail.includes('system')
  ) {
    result.email = createdByEmail.trim();
  }

  // 4. Full Name extraction
  const nameMatch = text.match(/(?:Agent\s+)?Full\s*Name\s*[:=\-]\s*([^\n\r]+)/i);
  if (nameMatch) {
    const rawName = nameMatch[1].trim();
    if (rawName && rawName.length > 1 && !rawName.toLowerCase().startsWith('agent (')) {
      result.fullName = rawName;
    }
  } else if (
    createdByName &&
    createdByName !== 'User' &&
    !createdByName.toLowerCase().includes('guest') &&
    !createdByName.toLowerCase().startsWith('agent (')
  ) {
    result.fullName = createdByName.trim();
  }

  // 5. FEP extraction
  const fepMatch = text.match(/FEP\s*[:=\-]\s*([^\n\r]+)/i);
  if (fepMatch) {
    const rawFep = fepMatch[1].trim().toUpperCase();
    if (rawFep.includes('NAIYA') || rawFep.includes("NA'IYA")) {
      result.fep = "NA'IYA";
    } else if (rawFep.includes('SAMUIKY')) {
      result.fep = 'SAMUIKY';
    } else {
      result.fep = fepMatch[1].trim();
    }
  } else if (project) {
    const pUpper = project.toUpperCase();
    if (pUpper.includes('NAIYA')) result.fep = "NA'IYA";
    else if (pUpper.includes('SAMUIKY')) result.fep = 'SAMUIKY';
  }

  // 6. Request Type
  const typeMatch = text.match(/Request\s*Type\s*[:=\-]\s*([^\n\r]+)/i);
  if (typeMatch) {
    result.requestType = typeMatch[1].trim();
  } else if (title) {
    result.requestType = title.trim();
  }

  return result;
}

interface TicketFormMetadataCardProps {
  ticket: Ticket;
  compact?: boolean;
}

export const TicketFormMetadataCard: React.FC<TicketFormMetadataCardProps> = ({ ticket, compact = false }) => {
  const { showToast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const meta = extractTicketMetadata(
    ticket.description,
    ticket.title,
    ticket.createdByEmail,
    ticket.createdByName,
    ticket.project
  );

  // If no primary form fields were extracted, do not render
  if (!meta.nin && !meta.phone && !meta.email && !meta.fullName) {
    return null;
  }

  const handleCopy = (key: string, value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    showToast(`${label} copied to clipboard: ${value}`, 'success');
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 2000);
  };

  const handleCopyAll = () => {
    const parts: string[] = [];
    if (meta.fullName) parts.push(`Name: ${meta.fullName}`);
    if (meta.nin) parts.push(`NIN: ${meta.nin}`);
    if (meta.phone) parts.push(`Phone: ${meta.phone}`);
    if (meta.email) parts.push(`Email: ${meta.email}`);
    if (meta.fep) parts.push(`FEP: ${meta.fep}`);
    if (meta.requestType) parts.push(`Type: ${meta.requestType}`);

    const allStr = parts.join(' | ');
    navigator.clipboard.writeText(allStr);
    setCopiedKey('all');
    showToast('All form details copied to clipboard', 'success');
    setTimeout(() => {
      setCopiedKey(prev => (prev === 'all' ? null : prev));
    }, 2000);
  };

  return (
    <div className="w-full bg-surface-0 dark:bg-dark-card border border-brand-200 dark:border-brand-900/50 rounded-xl p-3 md:p-3.5 shadow-xs mb-3">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-surface-100 dark:border-dark-border">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
          <span className="text-2xs uppercase font-bold tracking-wider text-brand-700 dark:text-brand-400">
            Form Submission Details (Click to Copy)
          </span>
          {meta.requestType && (
            <span className="hidden sm:inline text-2xs text-surface-400 font-medium truncate max-w-[200px]">
              - {meta.requestType}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-2xs font-semibold px-2 py-1 bg-surface-100 dark:bg-dark-hover hover:bg-brand-50 dark:hover:bg-brand-950/30 text-surface-600 dark:text-surface-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-md transition-colors border border-surface-200 dark:border-dark-border flex items-center gap-1"
          title="Copy all extracted form details"
        >
          {copiedKey === 'all' ? (
            <>
              <Icons.Check size={11} className="text-emerald-600" />
              <span>Copied All</span>
            </>
          ) : (
            <>
              <Icons.Copy size={11} />
              <span>Copy All</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        {/* NIN Pill */}
        {meta.nin && (
          <button
            type="button"
            onClick={() => handleCopy('nin', meta.nin!, 'NIN')}
            className={`group px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 select-none ${
              copiedKey === 'nin'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-surface-50 dark:bg-dark-hover border-surface-200 dark:border-dark-border text-surface-800 dark:text-surface-200 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20'
            }`}
            title="Click to copy NIN number only"
          >
            <span className="text-2xs uppercase font-sans font-bold text-surface-400 dark:text-surface-500">NIN:</span>
            <span>{meta.nin}</span>
            {copiedKey === 'nin' ? (
              <Icons.Check size={12} className="text-emerald-600" />
            ) : (
              <Icons.Copy size={12} className="text-surface-400 group-hover:text-brand-600 transition-colors" />
            )}
          </button>
        )}

        {/* Phone Number Pill */}
        {meta.phone && (
          <button
            type="button"
            onClick={() => handleCopy('phone', meta.phone!, 'Phone')}
            className={`group px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 select-none ${
              copiedKey === 'phone'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-surface-50 dark:bg-dark-hover border-surface-200 dark:border-dark-border text-surface-800 dark:text-surface-200 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20'
            }`}
            title="Click to copy phone number only"
          >
            <span className="text-2xs uppercase font-sans font-bold text-surface-400 dark:text-surface-500">Phone:</span>
            <span>{meta.phone}</span>
            {copiedKey === 'phone' ? (
              <Icons.Check size={12} className="text-emerald-600" />
            ) : (
              <Icons.Copy size={12} className="text-surface-400 group-hover:text-brand-600 transition-colors" />
            )}
          </button>
        )}

        {/* Email Pill */}
        {meta.email && (
          <button
            type="button"
            onClick={() => handleCopy('email', meta.email!, 'Email')}
            className={`group px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 select-none ${
              copiedKey === 'email'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-surface-50 dark:bg-dark-hover border-surface-200 dark:border-dark-border text-surface-800 dark:text-surface-200 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20'
            }`}
            title="Click to copy email address only"
          >
            <span className="text-2xs uppercase font-bold text-surface-400 dark:text-surface-500">Email:</span>
            <span className="font-mono text-2xs md:text-xs truncate max-w-[160px] md:max-w-[220px]">{meta.email}</span>
            {copiedKey === 'email' ? (
              <Icons.Check size={12} className="text-emerald-600" />
            ) : (
              <Icons.Copy size={12} className="text-surface-400 group-hover:text-brand-600 transition-colors" />
            )}
          </button>
        )}

        {/* Full Name Pill */}
        {meta.fullName && (
          <button
            type="button"
            onClick={() => handleCopy('fullName', meta.fullName!, 'Full Name')}
            className={`group px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 select-none ${
              copiedKey === 'fullName'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-surface-50 dark:bg-dark-hover border-surface-200 dark:border-dark-border text-surface-800 dark:text-surface-200 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20'
            }`}
            title="Click to copy agent name only"
          >
            <span className="text-2xs uppercase font-bold text-surface-400 dark:text-surface-500">Name:</span>
            <span>{meta.fullName}</span>
            {copiedKey === 'fullName' ? (
              <Icons.Check size={12} className="text-emerald-600" />
            ) : (
              <Icons.Copy size={12} className="text-surface-400 group-hover:text-brand-600 transition-colors" />
            )}
          </button>
        )}

        {/* FEP Pill */}
        {meta.fep && (
          <button
            type="button"
            onClick={() => handleCopy('fep', meta.fep!, 'FEP')}
            className={`group px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 select-none ${
              copiedKey === 'fep'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-surface-50 dark:bg-dark-hover border-surface-200 dark:border-dark-border text-surface-800 dark:text-surface-200 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20'
            }`}
            title="Click to copy FEP category"
          >
            <span className="text-2xs uppercase font-bold text-surface-400 dark:text-surface-500">FEP:</span>
            <span>{meta.fep}</span>
            {copiedKey === 'fep' ? (
              <Icons.Check size={12} className="text-emerald-600" />
            ) : (
              <Icons.Copy size={12} className="text-surface-400 group-hover:text-brand-600 transition-colors" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
