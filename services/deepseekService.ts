import { getSupportDictionaryPrompt } from './supportDictionary';
import { getAiIntakePrompt, DisabledCategory } from '../config/AiIntakePrompt';
import type { AiProviderConfig } from '../types';

export type { AiProviderConfig };

export interface TestAiResult {
    success: boolean;
    latencyMs: number;
    status: number;
    statusText: string;
    model: string;
    endpoint: string;
    responsePreview?: string;
    errorMessage?: string;
    timestamp: string;
}

/**
 * Normalizes user model names to the exact model identifiers accepted by Indunix AI / DeepSeek gateway.
 */
export const normalizeAiModel = (rawModel: string): string => {
    const m = (rawModel || '').trim();
    if (!m) return 'indunix-1-core';
    const lower = m.toLowerCase();
    if (lower.includes('spark') || lower.includes('flash') || lower.includes('v4.1') || lower.includes('v4-1')) {
        return 'indunix-1-spark';
    }
    if (lower.includes('reason') || lower.includes('pro')) {
        return 'indunix-1-reason';
    }
    if (lower.includes('core') || lower === 'deepseek-chat') {
        return 'indunix-1-core';
    }
    return m;
};
export const normalizeDeepSeekModel = normalizeAiModel;

/**
 * Loads the active AI provider configuration from runtime memory, localStorage, or environment variables.
 */
export const getAiProviderConfig = (): AiProviderConfig => {
    let stored: Partial<AiProviderConfig> | null = null;
    if (typeof window !== 'undefined') {
        if ((window as any).__AI_PROVIDER_CONFIG__) {
            stored = (window as any).__AI_PROVIDER_CONFIG__;
        } else {
            try {
                const raw = localStorage.getItem('ai_provider_config');
                if (raw) stored = JSON.parse(raw);
            } catch {}
        }
    }

    const envIndunixKey = (import.meta.env.VITE_INDUNIX_API_KEY || '').trim();
    const envIndunixUrl = (import.meta.env.VITE_INDUNIX_API_URL || 'https://api.indunixai.com/v1/chat/completions').trim();
    const envIndunixModel = (import.meta.env.VITE_INDUNIX_MODEL || 'indunix-1-core').trim();

    const envDeepseekKey = (import.meta.env.VITE_DEEPSEEK_API_KEY || '').trim();
    const envDeepseekUrl = (import.meta.env.VITE_DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions').trim();
    const envDeepseekModel = (import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat').trim();

    const activeProvider: 'indunix' | 'deepseek' =
        (stored?.activeProvider === 'deepseek' || stored?.activeProvider === 'indunix')
            ? stored.activeProvider
            : (envIndunixKey ? 'indunix' : 'deepseek');

    return {
        activeProvider,
        indunix: {
            apiKey: (stored?.indunix?.apiKey !== undefined ? stored.indunix.apiKey : envIndunixKey).trim(),
            apiUrl: (stored?.indunix?.apiUrl !== undefined ? stored.indunix.apiUrl : envIndunixUrl).trim(),
            model: (stored?.indunix?.model !== undefined ? stored.indunix.model : envIndunixModel).trim(),
        },
        deepseek: {
            apiKey: (stored?.deepseek?.apiKey !== undefined ? stored.deepseek.apiKey : envDeepseekKey).trim(),
            apiUrl: (stored?.deepseek?.apiUrl !== undefined ? stored.deepseek.apiUrl : envDeepseekUrl).trim(),
            model: (stored?.deepseek?.model !== undefined ? stored.deepseek.model : envDeepseekModel).trim(),
        }
    };
};

/**
 * Returns isolated metadata and credentials for the currently active AI provider.
 * When Indunix is selected, only Indunix parameters are used.
 * When DeepSeek is selected, only DeepSeek parameters are used.
 */
export const getActiveProviderInfo = () => {
    const config = getAiProviderConfig();
    return {
        provider: 'indunix' as const,
        providerName: 'Indunix AI Sovereign Gateway',
        apiKey: config.indunix.apiKey || config.deepseek?.apiKey || '',
        apiUrl: config.indunix.apiUrl || config.deepseek?.apiUrl || 'https://api.indunixai.com/v1/chat/completions',
        model: config.indunix.model || config.deepseek?.model || 'indunix-1-core'
    };
};

export const getAiApiKey = (): string => getActiveProviderInfo().apiKey;
export const getDeepSeekKey = (): string => getAiProviderConfig().indunix.apiKey;
export const getIndunixKey = (): string => getAiProviderConfig().indunix.apiKey;

export const getAiModel = (): string => getActiveProviderInfo().model;
export const getDeepSeekModel = (): string => getAiProviderConfig().indunix.model;
export const getIndunixModel = (): string => getAiProviderConfig().indunix.model;

export const getAiApiUrl = (): string => getActiveProviderInfo().apiUrl;
export const getDeepSeekUrl = (): string => getAiProviderConfig().indunix.apiUrl;
export const getIndunixUrl = (): string => getAiProviderConfig().indunix.apiUrl;

/**
 * Executes a live connectivity and completion diagnostic against the target AI endpoint.
 */
export const testAiEndpoint = async (params: {
    provider?: 'indunix' | 'deepseek';
    apiKey: string;
    apiUrl: string;
    model: string;
}): Promise<TestAiResult> => {
    const cleanKey = (params.apiKey || '').trim();
    const cleanUrl = (params.apiUrl || '').trim();
    const cleanModel = (params.model || '').trim();
    const providerLabel = 'Indunix AI Sovereign Gateway';

    if (!cleanKey) {
        return {
            success: false,
            latencyMs: 0,
            status: 0,
            statusText: 'Missing Key',
            model: cleanModel,
            endpoint: cleanUrl,
            errorMessage: `API key is required to test ${providerLabel}.`,
            timestamp: new Date().toLocaleTimeString()
        };
    }

    if (!cleanUrl) {
        return {
            success: false,
            latencyMs: 0,
            status: 0,
            statusText: 'Missing URL',
            model: cleanModel,
            endpoint: cleanUrl,
            errorMessage: 'API Endpoint URL is required.',
            timestamp: new Date().toLocaleTimeString()
        };
    }

    const testCandidates = [cleanUrl];
    if (params.provider === 'indunix' && typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        if (!cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1')) {
            testCandidates.push('http://localhost:8000/v1/chat/completions');
        }
    }

    let lastFailure: TestAiResult | null = null;

    for (const endpoint of testCandidates) {
        const candidateStart = performance.now();
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanKey}`
                },
                body: JSON.stringify({
                    model: cleanModel,
                    messages: [
                        { role: 'user', content: 'Connection diagnostic check. Respond with exactly: Gateway verified.' }
                    ],
                    max_tokens: 30,
                    temperature: 0.1,
                    stream: false
                })
            });

            const latencyMs = Math.round(performance.now() - candidateStart);

            if (res.ok) {
                const data = await res.json();
                const content = data?.choices?.[0]?.message?.content || 'Connection OK';
                const confirmedModel = data?.model || cleanModel;
                return {
                    success: true,
                    latencyMs,
                    status: res.status,
                    statusText: res.statusText || 'OK',
                    model: confirmedModel,
                    endpoint,
                    responsePreview: content.trim(),
                    timestamp: new Date().toLocaleTimeString()
                };
            } else {
                const errorText = await res.text();
                let parsedError = errorText;
                try {
                    const jsonErr = JSON.parse(errorText);
                    if (jsonErr.error?.message) parsedError = jsonErr.error.message;
                    else if (jsonErr.message) parsedError = jsonErr.message;
                    else if (jsonErr.detail) parsedError = jsonErr.detail;
                } catch {}

                lastFailure = {
                    success: false,
                    latencyMs,
                    status: res.status,
                    statusText: res.statusText || 'HTTP Error',
                    model: cleanModel,
                    endpoint,
                    errorMessage: `HTTP ${res.status}: ${parsedError}`,
                    timestamp: new Date().toLocaleTimeString()
                };
            }
        } catch (err: any) {
            const latencyMs = Math.round(performance.now() - candidateStart);
            lastFailure = {
                success: false,
                latencyMs,
                status: 0,
                statusText: 'Network / CORS Error',
                model: cleanModel,
                endpoint,
                errorMessage: err?.message || 'Failed to reach API endpoint. Please check network connectivity and CORS headers.',
                timestamp: new Date().toLocaleTimeString()
            };
        }
    }

    return lastFailure || {
        success: false,
        latencyMs: 0,
        status: 0,
        statusText: 'Failed',
        model: cleanModel,
        endpoint: cleanUrl,
        errorMessage: 'Connection test failed on all attempted endpoints.',
        timestamp: new Date().toLocaleTimeString()
    };
};

/**
 * Executes a chat completion request to the currently selected AI gateway.
 * When Indunix is active, calls only Indunix.
 * When DeepSeek is active, calls only DeepSeek.
 */
export const callAiChat = async (
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature: number = 0.2,
    maxTokens: number = 2500,
    throwOnError: boolean = false
): Promise<string> => {
    const active = getActiveProviderInfo();
    const apiKey = active.apiKey;
    const model = active.model;
    const primaryUrl = active.apiUrl;

    // Validate key
    if (!apiKey || apiKey.includes('your_api_key')) {
        const msg = `${active.providerName} API key is not configured. Please open Admin Settings > AI Gateway to configure your API key.`;
        console.warn(msg);
        if (throwOnError) throw new Error(msg);
        return `The AI Support Assistant is currently unconfigured. Please configure your API key in Admin Settings or contact IT Support.`;
    }

    // Filter out any messages with empty content
    const safeMessages = messages.filter(m => m.content && m.content.trim() !== '');

    // Candidate endpoints strictly for the active provider
    const candidateUrls = [primaryUrl];
    if (active.provider === 'indunix' && typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        if (!primaryUrl.includes('localhost') && !primaryUrl.includes('127.0.0.1')) {
            candidateUrls.push('http://localhost:8000/v1/chat/completions');
        }
    }

    let lastError: any = null;

    for (const apiUrl of candidateUrls) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: safeMessages,
                    temperature,
                    max_tokens: maxTokens,
                    stream: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                const choice = data?.choices?.[0];
                const content = choice?.message?.content;
                if (content && content.trim() !== '') return content.trim();

                if (choice?.finish_reason === 'length') {
                    const lenMsg = `${active.providerName} reached max tokens limit during reasoning. Token limit exceeded.`;
                    console.error(lenMsg, data);
                    if (throwOnError) throw new Error(lenMsg);
                }
                throw new Error(`${active.providerName} returned empty response content.`);
            } else {
                const errorText = await response.text();
                console.error(`${active.providerName} error at ${apiUrl} [HTTP ${response.status}]:`, errorText);
                lastError = new Error(`${active.providerName} error [HTTP ${response.status}]: ${errorText}`);
                if (response.status === 401 || response.status === 403) {
                    if (throwOnError) throw lastError;
                    return `Authentication failed with ${active.providerName}. Please verify your API key in Admin Settings.`;
                }
            }
        } catch (err: any) {
            console.warn(`Attempt to reach ${apiUrl} failed:`, err);
            lastError = err;
        }
    }

    if (throwOnError && lastError) throw lastError;
    return `We encountered a momentary communication error reaching ${active.providerName}. Please try again or open a ticket directly.`;
};

export const callDeepSeekChat = callAiChat;
export const callIndunixChat = callAiChat;

/**
 * Handles conversational support intake using the grounded domain dictionary and DeepSeek.
 */
export const runIntakeConversation = async (
    history: Array<{ role: 'user' | 'model'; text: string }>,
    userMsg: string,
    disabledCategories: DisabledCategory[] = []
): Promise<string> => {
    const basePrompt = getAiIntakePrompt(disabledCategories);
    const dictionaryPrompt = getSupportDictionaryPrompt();

    const systemInstruction = `${basePrompt}

=== STRICT KNOWLEDGE BASE & GROUNDED DICTIONARY (ZERO HALLUCINATION) ===
You must strictly follow the solutions, pre-checks, and instructions in the following verified support dictionary.
Do NOT invent links, forms, or IT procedures outside of this dictionary.

${dictionaryPrompt}

CRITICAL RULES:
1. If the user states a problem (e.g. VPN not connecting, NIMC agent not found, Webmail password), check the matching INTENT from the dictionary.
2. Ask any mandatory pre-checks first (e.g. "Are you on MTN network?", "Caps Lock off?").
3. If the user reports an issue that CANNOT be escalated (e.g. commission inquiry, personal email, physical device issues, form approvals), politely explain the resolution and DO NOT trigger escalation.
4. If a technical issue genuinely requires human IT staff and all pre-checks or required data have been collected, output:
   [SYSTEM: HANDOFF_TRIGGER] [CATEGORY: <category_name>]
   followed by a clean 2-sentence summary of the collected data.
5. If the user explicitly demands a human or clicks 'Escalate' for a technical issue, collect their Name, Phone, and NIN/Email before triggering [SYSTEM: HANDOFF_TRIGGER].
6. STRICT ZERO-TICKET POLICY FOR DEVICES: Under NO circumstances should you trigger [SYSTEM: HANDOFF_TRIGGER] for device, activation, production switch, damage, or form issues. Physical devices and form approvals are not handled by IT support and cannot be fast-tracked; advise them to submit the form (which will be considered in normal processing) and ask in the official enroller community group for peer assistance.`;

    const chatHistoryMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemInstruction }
    ];

    for (const m of history) {
        // Skip any history entries with empty text — these cause a 400 from the DeepSeek API.
        const content = (m.text || '').trim();
        if (!content) continue;
        chatHistoryMessages.push({
            role: m.role === 'model' ? 'assistant' : 'user',
            content
        });
    }

    chatHistoryMessages.push({
        role: 'user',
        content: userMsg
    });

    return await callDeepSeekChat(chatHistoryMessages, 0.1, 2500, false);
};

/**
 * Polishes rough staff notes into an elegant, courteous, professional IT support reply using DeepSeek.
 * Guaranteed to NEVER overwrite staff drafts with error text.
 */
export const cleanStaffReply = async (
    draftText: string,
    ticketContext?: {
        title?: string;
        category?: string;
        userName?: string;
        userEmail?: string;
        ticketNumber?: string;
    }
): Promise<string> => {
    if (!draftText || !draftText.trim()) return draftText;

    const systemPrompt = `You are an expert IT Support Communications Assistant for NA'IYA Technology Solutions.
Your job is to rewrite raw, brief, or shorthand support drafts written by IT staff into polite, polished, professional, and clear customer support replies.

STRICT GUIDELINES:
1. Preserve ALL facts, technical credentials (usernames, passwords, PINs), numbers, links, and system URLs EXACTLY as provided in the draft. Do NOT alter passwords or usernames.
2. Use standard polite enterprise greeting (e.g. "Hello [Name]," or "Good day,") and courteous sign-off ("Best regards, NA'IYA IT Support Team").
3. Format with clean bullet points or bold text if credentials or steps are involved.
4. Maintain a warm, helpful, and reassuring tone.
5. Do NOT add fabricated information or fake links.
6. Return ONLY the polished response text with no explanatory preamble or quotation marks around the entire output.`;

    const userPrompt = `Ticket Context:
- Ticket: #${ticketContext?.ticketNumber || 'N/A'} - ${ticketContext?.title || 'Support Request'}
- Category: ${ticketContext?.category || 'General'}
- Recipient: ${ticketContext?.userName || 'Agent'} (${ticketContext?.userEmail || ''})

Raw Staff Draft to Polish:
"""
${draftText.trim()}
"""`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // Give reasoning model 3000 max_tokens and set throwOnError to true
    return await callDeepSeekChat(messages, 0.3, 3000, true);
};

/**
 * Summarizes a full chat transcript into a concise, structured staff brief.
 * Returns a tightly formatted 3-5 line block that staff can read at a glance.
 * Falls back to a plain version of the transcript excerpt on failure.
 */
export const summarizeForStaff = async (
    chatHistory: Array<{ role: 'user' | 'model'; text: string }>,
    category: string,
    userName: string,
    userEmail: string
): Promise<string> => {
    if (!chatHistory || chatHistory.length === 0) {
        return `User: ${userName} (${userEmail})\nCategory: ${category}\nNo conversation recorded.`;
    }

    const transcriptText = chatHistory
        .filter(m => m.text && m.text.trim())
        .map(m => `[${m.role === 'model' ? 'AI Assistant' : 'User'}]: ${m.text.trim()}`)
        .join('\n');

    const systemPrompt = `You are a precise IT support triage assistant.
Your ONLY job is to read a support conversation and output a structured 4-line brief for an IT staff member.

Output EXACTLY in this format (no preamble, no markdown, just the 4 lines):
ISSUE: [One clear sentence — what the user actually needs]
USER: [Name and Email]
DETAILS: [Any IDs, email addresses, NIN, IMEI, or technical specifics provided]
ACTION NEEDED: [What the staff member should do next — 1 sentence]

Rules:
- Be concise. Each field must be 1 sentence or less.
- DETAILS: If no specific IDs were provided, write "None provided."
- Do not add any other lines or commentary.`;

    const userPrompt = `Category: ${category}
User: ${userName} (${userEmail})

Conversation Transcript:
${transcriptText}`;

    try {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        const result = await callDeepSeekChat(messages, 0.1, 600, false);
        if (result && result.trim() && !result.startsWith('Network') && !result.startsWith('The AI')) {
            return result.trim();
        }
    } catch { /* fall through to fallback */ }

    // Fallback — plain excerpt
    const lastUserMsg = [...chatHistory].reverse().find(m => m.role === 'user');
    return `ISSUE: ${category} support request\nUSER: ${userName} (${userEmail})\nDETAILS: ${lastUserMsg?.text?.slice(0, 100) || 'None provided.'}\nACTION NEEDED: Review transcript and respond to user.`;
};
