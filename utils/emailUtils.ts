export const COMPANY_DOMAINS = [
  'naiyatechnology.org',
  'samuikyglobal.com.ng',
  'naiyatech.com.ng'
] as const;

/**
 * Checks whether an email address belongs to one of the authorized company domains:
 * naiyatechnology.org, samuikyglobal.com.ng, or naiyatech.com.ng.
 */
export const isCompanyEmail = (email?: string | null): boolean => {
  if (!email || typeof email !== 'string') return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return COMPANY_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
};
