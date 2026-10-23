export interface SavedWebmailCredential {
    id: string;
    email: string;
    password: string;
    domain: string;
    resetAt: string; // ISO string
    resetBy?: string;
}

const STORAGE_KEY = 'naiya_saved_webmail_credentials';

export const getLocalSavedCredentials = (): SavedWebmailCredential[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveLocalCredential = (cred: Omit<SavedWebmailCredential, 'id' | 'resetAt'> & { resetAt?: string; id?: string }): SavedWebmailCredential[] => {
    try {
        const existing = getLocalSavedCredentials();
        const cleanEmail = cred.email.trim().toLowerCase();

        const filtered = existing.filter(item => item.email.trim().toLowerCase() !== cleanEmail);
        const newRecord: SavedWebmailCredential = {
            id: cred.id || `wm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            email: cleanEmail,
            password: cred.password,
            domain: cred.domain.toLowerCase(),
            resetAt: cred.resetAt || new Date().toISOString(),
            resetBy: cred.resetBy || 'User'
        };

        const updated = [newRecord, ...filtered].slice(0, 200);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // Background sync to backend
        try {
            const API_URL = (import.meta as any).env?.VITE_API_URL || '/backend/api.php';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const storedUser = localStorage.getItem('app_user');
            if (storedUser) {
                const u = JSON.parse(storedUser);
                if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
            }
            fetch(`${API_URL}?action=save_saved_webmail_credential`, {
                method: 'POST',
                headers,
                body: JSON.stringify(newRecord)
            }).catch(() => {});
        } catch {}

        return updated;
    } catch {
        return [];
    }
};

export const fetchRemoteSavedCredentials = async (): Promise<SavedWebmailCredential[]> => {
    try {
        const API_URL = (import.meta as any).env?.VITE_API_URL || '/backend/api.php';
        const headers: Record<string, string> = {};
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
            const u = JSON.parse(storedUser);
            if (u?.token) headers['Authorization'] = `Bearer ${u.token}`;
        }
        const res = await fetch(`${API_URL}?action=get_saved_webmail_credentials`, { headers });
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.credentials)) {
            const local = getLocalSavedCredentials();
            const emailMap = new Map<string, SavedWebmailCredential>();
            data.credentials.forEach((c: SavedWebmailCredential) => emailMap.set(c.email.toLowerCase(), c));
            local.forEach((c: SavedWebmailCredential) => {
                const existing = emailMap.get(c.email.toLowerCase());
                if (!existing || new Date(c.resetAt).getTime() > new Date(existing.resetAt).getTime()) {
                    emailMap.set(c.email.toLowerCase(), c);
                }
            });
            const merged = Array.from(emailMap.values()).sort((a, b) => new Date(b.resetAt).getTime() - new Date(a.resetAt).getTime());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            return merged;
        }
    } catch {}
    return getLocalSavedCredentials();
};

export const deleteLocalCredential = (email: string): SavedWebmailCredential[] => {
    try {
        const existing = getLocalSavedCredentials();
        const clean = email.trim().toLowerCase();
        const filtered = existing.filter(c => c.email.toLowerCase() !== clean);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return filtered;
    } catch {
        return [];
    }
};
