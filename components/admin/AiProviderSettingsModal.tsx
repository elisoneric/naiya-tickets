import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';
import { getGeneralSettings, saveGeneralSettings } from '../../services/storageService';
import { 
    type AiProviderConfig, 
    getAiProviderConfig, 
    testAiEndpoint, 
    type TestAiResult 
} from '../../services/deepseekService';

interface AiProviderSettingsModalProps {
    onClose: () => void;
}

export const AiProviderSettingsModal: React.FC<AiProviderSettingsModalProps> = ({ onClose }) => {
    const { showToast } = useToast();

    // Configuration state - Defaults strictly to indunixai.com
    const [apiKey, setApiKey] = useState('');
    const [apiUrl, setApiUrl] = useState('https://api.indunixai.com/v1/chat/completions');
    const [model, setModel] = useState('indunix-1-core');
    const [showKey, setShowKey] = useState(false);
    const [copiedCurl, setCopiedCurl] = useState(false);

    // Testing state
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestAiResult | null>(null);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load current settings from database / memory
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const settings = await getGeneralSettings();
                const config: AiProviderConfig = settings.aiProviderConfig || getAiProviderConfig();

                setApiKey(config.indunix?.apiKey || '');
                setApiUrl(config.indunix?.apiUrl || 'https://api.indunixai.com/v1/chat/completions');
                setModel(config.indunix?.model || 'indunix-1-core');
            } catch (err) {
                console.warn('Failed to load AI provider settings from server, using local defaults', err);
                const local = getAiProviderConfig();
                setApiKey(local.indunix.apiKey || '');
                setApiUrl(local.indunix.apiUrl || 'https://api.indunixai.com/v1/chat/completions');
                setModel(local.indunix.model || 'indunix-1-core');
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, []);

    // Esc key handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving && !isTesting) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, isSaving, isTesting]);

    // Live connection tester
    const handleRunTest = async () => {
        setIsTesting(true);
        setTestResult(null);

        const params = {
            provider: 'indunix' as const,
            apiKey: apiKey.trim(),
            apiUrl: apiUrl.trim() || 'https://api.indunixai.com/v1/chat/completions',
            model: model.trim() || 'indunix-1-core',
        };

        try {
            const res = await testAiEndpoint(params);
            setTestResult(res);
            if (res.success) {
                showToast(`Gateway connection verified (${res.latencyMs}ms)`, 'success');
            } else {
                showToast(`Connection test failed: ${res.statusText}`, 'error');
            }
        } catch (err: any) {
            setTestResult({
                success: false,
                latencyMs: 0,
                status: 0,
                statusText: 'Execution Error',
                model: params.model,
                endpoint: params.apiUrl,
                errorMessage: err?.message || 'Unexpected test failure',
                timestamp: new Date().toLocaleTimeString(),
            });
            showToast('Connection test error', 'error');
        } finally {
            setIsTesting(false);
        }
    };

    // Save configuration
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const cleanKey = apiKey.trim();
            const cleanUrl = apiUrl.trim() || 'https://api.indunixai.com/v1/chat/completions';
            const cleanModel = model.trim() || 'indunix-1-core';

            const newConfig: AiProviderConfig = {
                activeProvider: 'indunix',
                indunix: {
                    apiKey: cleanKey,
                    apiUrl: cleanUrl,
                    model: cleanModel,
                },
                deepseek: {
                    apiKey: cleanKey,
                    apiUrl: cleanUrl,
                    model: cleanModel,
                },
            };

            // 1. Update runtime window & localStorage immediately
            if (typeof window !== 'undefined') {
                (window as any).__AI_PROVIDER_CONFIG__ = newConfig;
                try {
                    localStorage.setItem('ai_provider_config', JSON.stringify(newConfig));
                } catch {}
            }

            // 2. Persist to server general settings
            const currentSettings = await getGeneralSettings();
            currentSettings.aiProviderConfig = newConfig;
            await saveGeneralSettings(currentSettings);

            showToast('AI Gateway settings saved. Routing via api.indunixai.com.', 'success');
            onClose();
        } catch (err: any) {
            console.error('Failed to save AI provider configuration', err);
            showToast('Failed to save settings: ' + (err?.message || 'Server error'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Construct curl command string
    const curlCommand = `curl ${apiUrl.trim() || 'https://api.indunixai.com/v1/chat/completions'} \\
  -H "Authorization: Bearer ${apiKey.trim() || '$INDUNIX_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.trim() || 'indunix-1-core'}",
    "messages": [
      {"role": "user", "content": "Analyze our operational performance"}
    ],
    "stream": true
  }'`;

    const handleCopyCurl = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(curlCommand);
            setCopiedCurl(true);
            showToast('cURL command copied to clipboard', 'success');
            setTimeout(() => setCopiedCurl(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto font-sans">
            <div className="bg-surface-0 dark:bg-dark-card rounded-2xl shadow-modal border border-surface-200 dark:border-dark-border w-full max-w-2xl overflow-hidden animate-scale-in flex flex-col my-auto max-h-[92vh]">
                
                {/* Header */}
                <div className="p-5 md:p-6 pb-4 border-b border-surface-100 dark:border-dark-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
                            <Icons.Sparkles size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base md:text-lg font-bold text-surface-900 dark:text-white">
                                    Indunix AI Gateway Settings
                                </h2>
                                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300">
                                    api.indunixai.com
                                </span>
                            </div>
                            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                                Enterprise sovereign intelligence engine, API authentication, and endpoint routing.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={isSaving || isTesting}
                        className="p-1.5 hover:bg-surface-100 dark:hover:bg-dark-hover rounded-lg text-surface-400 hover:text-surface-600 transition-colors"
                        title="Close (Esc)"
                    >
                        <Icons.Close size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 md:p-6 space-y-5 overflow-y-auto">

                    {/* Active Engine Card */}
                    <div className="p-4 rounded-xl border border-brand-500/40 bg-brand-50/40 dark:bg-brand-950/20 shadow-xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950" />
                                <span className="text-xs font-bold text-surface-900 dark:text-white">
                                    Indunix AI Sovereign Infrastructure
                                </span>
                            </div>
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
                                DEFAULT GATEWAY
                            </span>
                        </div>
                        <p className="text-2xs text-surface-600 dark:text-surface-400 leading-relaxed">
                            All support intake conversations, ticket briefs, and staff reply polishing route through your sovereign corporate AI gateway.
                        </p>
                    </div>

                    {/* Parameters Configuration Form */}
                    <div className="border border-surface-200 dark:border-dark-border rounded-xl p-4 bg-surface-50/60 dark:bg-dark-surface/30 space-y-4">
                        
                        {/* API Key */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                                    Indunix API Key
                                </label>
                                <span className="text-2xs text-surface-400 font-mono">indunix-live-sk-...</span>
                            </div>
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder="Enter your live API Key"
                                    className="w-full pr-10 pl-3 py-2 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-card text-surface-900 dark:text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(v => !v)}
                                    className="absolute right-2 top-2 p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
                                    title={showKey ? 'Hide key' : 'Show key'}
                                >
                                    {showKey ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Endpoint URL */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                                    Gateway Endpoint URL
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setApiUrl('https://api.indunixai.com/v1/chat/completions')}
                                    className="text-2xs text-brand-600 dark:text-brand-400 hover:underline"
                                >
                                    Reset Default
                                </button>
                            </div>
                            <input
                                type="text"
                                value={apiUrl}
                                onChange={e => setApiUrl(e.target.value)}
                                placeholder="https://api.indunixai.com/v1/chat/completions"
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-card text-surface-900 dark:text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                            />
                        </div>

                        {/* Model Identifier */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                                    Model Identifier
                                </label>
                                <span className="text-2xs text-surface-400">Select model or specify identifier</span>
                            </div>
                            <input
                                type="text"
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                placeholder="indunix-1-core"
                                className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-0 dark:bg-dark-card text-surface-900 dark:text-white text-xs font-mono focus:outline-none focus:border-brand-500 mb-2"
                            />
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {[
                                    { id: 'indunix-1-core', label: 'indunix-1-core (Flagship Intelligence)' },
                                    { id: 'indunix-1-spark', label: 'indunix-1-spark (Sub-second Latency)' },
                                    { id: 'indunix-1-reason', label: 'indunix-1-reason (Extended Reasoning)' },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setModel(m.id)}
                                        className={`text-2xs px-2.5 py-1 rounded-md border transition-colors ${
                                            model === m.id
                                                ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-400 text-brand-700 dark:text-brand-300 font-semibold'
                                                : 'bg-surface-0 dark:bg-dark-card border-surface-200 dark:border-dark-border text-surface-600 dark:text-surface-400 hover:border-surface-300'
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Standard cURL Command Example */}
                    <div className="border border-surface-200 dark:border-dark-border rounded-xl p-4 bg-surface-0 dark:bg-dark-card">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-xs font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                                    <Icons.Send size={13} className="text-brand-600 dark:text-brand-400" />
                                    Terminal cURL Request
                                </h3>
                                <p className="text-2xs text-surface-500 dark:text-surface-400 mt-0.5">
                                    Standard HTTP command to verify completions against the Indunix AI gateway.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyCurl}
                                className="px-3 py-1 rounded-lg border border-surface-200 dark:border-dark-border hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-700 dark:text-surface-300 text-2xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                                {copiedCurl ? <Icons.Check size={12} className="text-emerald-500" /> : <Icons.Document size={12} />}
                                <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
                            </button>
                        </div>
                        <pre className="p-3 bg-surface-950 text-surface-100 rounded-lg text-2xs font-mono overflow-x-auto leading-relaxed border border-surface-800">
                            {curlCommand}
                        </pre>
                    </div>

                    {/* Live Connection Tester */}
                    <div className="border border-surface-200 dark:border-dark-border rounded-xl p-4 bg-surface-0 dark:bg-dark-card">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-xs font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                                    <Icons.Refresh size={14} className={isTesting ? 'animate-spin text-brand-600' : 'text-surface-500'} />
                                    Live Gateway Diagnostic
                                </h3>
                                <p className="text-2xs text-surface-500 dark:text-surface-400 mt-0.5">
                                    Sends a verification ping to confirm authentication, network latency, and model output.
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={isTesting || isLoading}
                                onClick={handleRunTest}
                                className="px-3.5 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 dark:bg-dark-border dark:hover:bg-dark-hover text-surface-800 dark:text-surface-200 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isTesting ? (
                                    <>
                                        <Icons.Refresh size={13} className="animate-spin" />
                                        <span>Testing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icons.Send size={13} />
                                        <span>Test Gateway</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Test Result Display Box */}
                        {testResult && (
                            <div className={`rounded-xl p-3.5 border transition-all animate-fade-in ${
                                testResult.success
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                                    : 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-800/60'
                            }`}>
                                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${testResult.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className={`text-xs font-bold ${
                                            testResult.success ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'
                                        }`}>
                                            {testResult.success ? 'Gateway Verified' : 'Connection Failed'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-surface-0/80 dark:bg-dark-card border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-300">
                                            Status: {testResult.status || testResult.statusText}
                                        </span>
                                        <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-surface-0/80 dark:bg-dark-card border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-300">
                                            Latency: {testResult.latencyMs}ms
                                        </span>
                                        <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-surface-0/80 dark:bg-dark-card border border-surface-200 dark:border-dark-border text-surface-700 dark:text-surface-300">
                                            Model: {testResult.model}
                                        </span>
                                    </div>
                                </div>

                                {testResult.success ? (
                                    <div className="text-2xs text-emerald-900 dark:text-emerald-200 bg-white/70 dark:bg-black/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                                        <span className="font-semibold block mb-0.5">Response Preview:</span>
                                        <span className="font-mono">{testResult.responsePreview || 'Connection OK'}</span>
                                    </div>
                                ) : (
                                    <div className="text-2xs text-red-900 dark:text-red-200 bg-white/70 dark:bg-black/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/40">
                                        <span className="font-semibold block mb-0.5">Diagnostic Details:</span>
                                        <span className="font-mono">{testResult.errorMessage}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-5 border-t border-surface-100 dark:border-dark-border bg-surface-50 dark:bg-dark-surface/50 flex items-center justify-between shrink-0">
                    <div className="text-2xs text-surface-500 dark:text-surface-400">
                        Default Engine: <strong className="text-surface-900 dark:text-white">Indunix AI (api.indunixai.com)</strong>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-lg border border-surface-200 dark:border-dark-border text-surface-600 dark:text-surface-300 text-xs font-semibold hover:bg-surface-100 dark:hover:bg-dark-hover transition-colors"
                        >
                            Cancel (Esc)
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Icons.Refresh size={14} className="animate-spin" />
                                    <span>Saving Settings...</span>
                                </>
                            ) : (
                                <>
                                    <Icons.Check size={14} />
                                    <span>Save & Apply Settings</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
