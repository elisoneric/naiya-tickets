/**
 * Returns true if today is October 1st (WAT — Nigeria timezone).
 * Automatically dormant for the rest of the year.
 */
export const isIndependenceDay = (): boolean => {
    const now = new Date();
    // Use WAT (UTC+1) to match Nigeria time
    const watOffset = 1; // hours
    const watDate = new Date(now.getTime() + watOffset * 60 * 60 * 1000);
    return watDate.getUTCMonth() === 9 && watDate.getUTCDate() === 1; // October = 9 (0-indexed)
};

/**
 * Current year for the celebration message.
 */
export const getIndependenceYear = (): number => {
    return new Date().getFullYear();
};

/**
 * Years since independence (October 1, 1960).
 */
export const getIndependenceAge = (): number => {
    return new Date().getFullYear() - 1960;
};
