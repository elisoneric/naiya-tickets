/**
 * nameMatchingService.ts
 *
 * Fuzzy name-matching engine used by the Webmail Auto-Reset pipeline.
 * Compares a requester's identity (from their profile / personal email handle)
 * against the corporate email username to determine if an auto-reset is safe.
 */

const VALID_DOMAINS = ['naiyatechnology.org', 'naiyatech.com.ng', 'samuikyglobal.com.ng'];

/**
 * Normalize a string for comparison:
 * Lowercase, remove non-alpha characters, split into tokens.
 */
function tokenize(str: string): string[] {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/[\s._\-0-9]+/)
        .filter(t => t.length > 1);
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

/**
 * Similarity score between two strings (0–1).
 */
function similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    return (maxLen - levenshtein(a, b)) / maxLen;
}

/**
 * Token overlap ratio between two token arrays (Jaccard-like).
 */
function tokenOverlap(tokensA: string[], tokensB: string[]): number {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let matches = 0;
    for (const t of setA) {
        for (const t2 of setB) {
            if (similarity(t, t2) >= 0.80) { matches++; break; }
        }
    }
    return matches / Math.max(setA.size, setB.size);
}

export interface NameMatchResult {
    /** 0–1 confidence score */
    score: number;
    /** true if confidence >= threshold */
    isMatch: boolean;
    /** Short explanation for audit trail */
    reason: string;
    /** The parsed corporate email username */
    corporateUsername: string;
    /** The full corporate email (validated) */
    corporateEmail: string;
}

/**
 * Core name-match check.
 *
 * @param requesterName    Display name from the user's account profile (e.g. "Musa Sani Musa")
 * @param requesterEmail   The personal/login email of the requester (e.g. "musasanimusa26@gmail.com")
 * @param corporateEmail   The corporate email to be reset (e.g. "musasanimusa@naiyatechnology.org")
 * @param threshold        Minimum confidence score for auto-approve (default 0.75)
 */
export function matchName(
    requesterName: string,
    requesterEmail: string,
    corporateEmail: string,
    threshold: number = 0.75
): NameMatchResult {
    const corporateLower = (corporateEmail || '').trim().toLowerCase();
    const atIdx = corporateLower.lastIndexOf('@');

    // Validate corporate email domain
    if (atIdx === -1) {
        return { score: 0, isMatch: false, reason: 'Invalid corporate email format', corporateUsername: '', corporateEmail: corporateLower };
    }
    const corporateDomain = corporateLower.slice(atIdx + 1);
    const corporateUsername = corporateLower.slice(0, atIdx);

    if (!VALID_DOMAINS.includes(corporateDomain)) {
        return { score: 0, isMatch: false, reason: `Domain "${corporateDomain}" is not an authorized company domain`, corporateUsername, corporateEmail: corporateLower };
    }

    // Extract handle from personal email (drop digits, e.g. musasanimusa26 → musasanimusa)
    const personalHandle = (requesterEmail || '').trim().toLowerCase().split('@')[0].replace(/\d+$/g, '');

    // Tokenize all identity signals
    const corpTokens = tokenize(corporateUsername);
    const nameTokens = tokenize(requesterName || '');
    const handleTokens = tokenize(personalHandle);

    // Signal 1: Direct username equality
    const directMatch = corporateUsername === personalHandle.replace(/\d/g, '');
    if (directMatch) {
        return { score: 1.0, isMatch: true, reason: 'Direct handle match', corporateUsername, corporateEmail: corporateLower };
    }

    // Signal 2: Personal email handle vs corporate username (Levenshtein)
    const handleSimilarity = similarity(personalHandle, corporateUsername);

    // Signal 3: Token overlap — requester display name vs corporate username
    const nameVsCorpOverlap = tokenOverlap(nameTokens, corpTokens);

    // Signal 4: Token overlap — personal handle tokens vs corporate username tokens
    const handleVsCorpOverlap = tokenOverlap(handleTokens, corpTokens);

    // Composite weighted score
    const score = Math.min(1.0,
        handleSimilarity * 0.4 +
        nameVsCorpOverlap * 0.4 +
        handleVsCorpOverlap * 0.2
    );

    const isMatch = score >= threshold;

    const reason = isMatch
        ? `Match confidence ${(score * 100).toFixed(0)}%: handle similarity ${(handleSimilarity * 100).toFixed(0)}%, name-corpus overlap ${(nameVsCorpOverlap * 100).toFixed(0)}%`
        : `Low confidence ${(score * 100).toFixed(0)}%: names do not sufficiently correspond. Manual verification required.`;

    return { score, isMatch, reason, corporateUsername, corporateEmail: corporateLower };
}

/**
 * Extract the first valid corporate email from a block of text (e.g. a ticket description).
 */
export function extractCorporateEmail(text: string): string | null {
    if (!text) return null;
    const match = text.match(/[a-zA-Z0-9._%+-]+@(naiyatechnology\.org|naiyatech\.com\.ng|samuikyglobal\.com\.ng)/i);
    return match ? match[0].toLowerCase() : null;
}

/**
 * Checks whether a given email is a personal (non-corporate) email provider.
 */
export function isPersonalEmail(email: string): boolean {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'aol.com', 'ymail.com'];
    const domain = (email || '').toLowerCase().split('@')[1] || '';
    return personalDomains.includes(domain);
}
