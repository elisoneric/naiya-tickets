import { format, toZonedTime } from 'date-fns-tz';

export const LAGOS_TZ = 'Africa/Lagos';

/**
 * Parses any incoming date representation (Date, ISO string, or MySQL datetime string)
 * into a valid JavaScript Date object representing the correct point in time.
 * If a date string has no timezone offset, it is assumed to be in Africa/Lagos (WAT, UTC+1).
 */
export const parseDateWAT = (input: any): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  let str = String(input).trim();
  if (!str) return null;

  // Handle MySQL datetime format 'YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DDTHH:mm:ss' without timezone
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str = str.replace(' ', 'T') + '+01:00';
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a ticket's last update / creation date for compact list panes (e.g. '12:49 PM' if today, else 'MMM d').
 */
export const formatTicketDate = (dateObj: any): string => {
  const d = parseDateWAT(dateObj);
  if (!d) return '';
  const watTime = toZonedTime(d, LAGOS_TZ);
  const today = toZonedTime(new Date(), LAGOS_TZ);
  const isToday = format(watTime, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  if (isToday) return format(watTime, 'h:mm a', { timeZone: LAGOS_TZ });
  return format(watTime, 'MMM d', { timeZone: LAGOS_TZ });
};

/**
 * Formats a message time (e.g. '12:49 PM').
 */
export const formatMessageTime = (dateObj: any): string => {
  const d = parseDateWAT(dateObj);
  if (!d) return '';
  const watTime = toZonedTime(d, LAGOS_TZ);
  return format(watTime, 'h:mm a', { timeZone: LAGOS_TZ });
};

/**
 * Formats a message date group header (e.g. 'Today' or 'MMM d, yyyy').
 */
export const formatMessageDateGroup = (dateObj: any): string => {
  const d = parseDateWAT(dateObj);
  if (!d) return '';
  const watTime = toZonedTime(d, LAGOS_TZ);
  const today = toZonedTime(new Date(), LAGOS_TZ);
  const isToday = format(watTime, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  if (isToday) return 'Today';
  return format(watTime, 'MMM d, yyyy', { timeZone: LAGOS_TZ });
};

/**
 * Formats a full date and time (e.g. 'MMM d, yyyy h:mm a').
 */
export const formatFullDateTimeWAT = (dateObj: any): string => {
  const d = parseDateWAT(dateObj);
  if (!d) return '';
  const watTime = toZonedTime(d, LAGOS_TZ);
  return format(watTime, 'MMM d, yyyy h:mm a', { timeZone: LAGOS_TZ });
};

/**
 * Formats date and time with standard pattern (e.g. 'PP p').
 */
export const formatPatternWAT = (dateObj: any, pattern: string = 'PP p'): string => {
  const d = parseDateWAT(dateObj);
  if (!d) return '';
  const watTime = toZonedTime(d, LAGOS_TZ);
  return format(watTime, pattern, { timeZone: LAGOS_TZ });
};
