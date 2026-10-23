import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useToast } from '../../contexts/ToastContext';
import { saveSystemFeedback } from '../../services/storageService';
import { sendEmailRecoveryNotification } from '../../services/emailService';
import { isCompanyEmail, COMPANY_DOMAINS } from '../../utils/emailUtils';

interface LoginIntakeAiProps {
    onClose: () => void;
    mode?: 'general_access' | 'company_email_recovery' | 'onboarding';
    companyEmail?: string;
}

const PROOF_HINT = 'Accepted: proof of payment to the company, employment certificate, or ID card with your name on it.';

export const LoginIntakeAi: React.FC<LoginIntakeAiProps> = ({ onClose, mode = 'general_access', companyEmail = '' }) => {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState(1);
    const [fullName, setFullName] = useState('');
    const [altEmail, setAltEmail] = useState('');
    const [currentEmail, setCurrentEmail] = useState('');
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [proofFileName, setProofFileName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // How many steps this mode has
    const totalSteps = mode === 'onboarding' ? 1 : 2;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setProofFileName(file.name);
        const reader = new FileReader();
        reader.onload = ev => {
            if (ev.target?.result) setProofImage(ev.target.result as string);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleSubmit = async () => {
        const resolvedCurrentEmail = mode === 'onboarding' || mode === 'company_email_recovery'
            ? companyEmail
            : currentEmail;
        const resolvedAltEmail = mode === 'onboarding' ? companyEmail : altEmail;

        if (!proofImage) {
            showToast('Please upload a supporting document.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await saveSystemFeedback({
                type: mode === 'company_email_recovery' ? 'company_email_recovery'
                    : mode === 'onboarding' ? 'agent_onboarding'
                    : 'email_recovery',
                email: resolvedCurrentEmail || 'unknown',
                name: mode === 'onboarding' ? (fullName || resolvedCurrentEmail || 'unknown') : (resolvedAltEmail || resolvedCurrentEmail || 'unknown'),
                content: mode === 'onboarding'
                    ? `Onboarding request.\nName: ${fullName}\nEmail: ${resolvedCurrentEmail}`
                    : `Access recovery request.\nCurrent Email: ${resolvedCurrentEmail}\nAlternative Email: ${resolvedAltEmail}`,
                proofImage,
            });
            await sendEmailRecoveryNotification(resolvedCurrentEmail || 'unknown', resolvedAltEmail || resolvedCurrentEmail || 'unknown');
            setDone(true);
        } catch {
            showToast('Failed to submit. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Success screen ──────────────────────────────────────────────
    if (done) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 font-segoe">
                <div className="bg-white dark:bg-dark-surface w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center animate-slide-in-up">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
                        <Icons.Check size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Request Submitted</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        {mode === 'onboarding'
                            ? 'Our team will review your document and reach out to you shortly.'
                            : `We'll verify your document and send your credentials to ${altEmail || companyEmail}.`}
                    </p>
                    <button onClick={onClose} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // ── Step indicator ──────────────────────────────────────────────
    const StepDots = () => totalSteps > 1 ? (
        <div className="flex items-center justify-center gap-2 mb-6">
            {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all ${step === i + 1 ? 'w-6 bg-brand-600' : 'w-2 bg-gray-200 dark:bg-white/20'}`} />
            ))}
        </div>
    ) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 font-sans animate-fade-in">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border w-full max-w-md rounded-none sm:rounded-2xl shadow-modal overflow-hidden animate-scale-in flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 text-white p-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white text-brand-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm border-2 border-brand-400">N</div>
                        <div>
                            <h3 className="font-bold text-lg tracking-tight">
                                {mode === 'onboarding' ? 'New Agent Access' : 'Account Recovery'}
                            </h3>
                            <p className="text-xs text-brand-50/80">
                                {totalSteps > 1 ? `Step ${step} of ${totalSteps}` : 'Identity Verification'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <Icons.Close size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <StepDots />

                    {/* ── ONBOARDING: single step — email + proof ── */}
                    {mode === 'onboarding' && (
                        <div className="space-y-5">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white mb-1">Your email is not on our system</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    To get you registered, upload one document below so we can confirm your identity.
                                </p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 text-sm text-blue-800 dark:text-blue-300 font-medium">
                                Requesting access for: <span className="font-bold">{companyEmail}</span>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>

                            <ProofUpload
                                proofImage={proofImage}
                                proofFileName={proofFileName}
                                onClear={() => { setProofImage(null); setProofFileName(''); }}
                                onPick={() => fileInputRef.current?.click()}
                            />
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />

                            <button
                                onClick={handleSubmit}
                                disabled={!proofImage || !fullName.trim() || isSubmitting}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <><Icons.Refresh className="animate-spin" size={18} /> Submitting...</> : 'Submit Request'}
                            </button>
                        </div>
                    )}

                    {/* ── COMPANY EMAIL RECOVERY: non-company email restriction ── */}
                    {mode === 'company_email_recovery' && companyEmail && !isCompanyEmail(companyEmail) && (
                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-2xl text-amber-900 dark:text-amber-200 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-sm">
                                    <Icons.Alert size={16} className="text-amber-600 dark:text-amber-400" /> Recovery Unavailable for Personal Emails
                                </div>
                                <p className="text-xs leading-relaxed opacity-90">
                                    Official email recovery can only be performed for company-managed mailboxes ending in:
                                </p>
                                <ul className="text-xs font-mono font-bold space-y-0.5 pl-4 list-disc opacity-90">
                                    {COMPANY_DOMAINS.map(domain => (
                                        <li key={domain}>@{domain}</li>
                                    ))}
                                </ul>
                                <p className="text-xs leading-relaxed opacity-90">
                                    Since <strong>{companyEmail}</strong> is a personal email address, IT support cannot reset or recover external mailboxes. Please use your email provider's recovery service.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {/* ── COMPANY EMAIL RECOVERY: step 1 — alt email ── */}
                    {mode === 'company_email_recovery' && (!companyEmail || isCompanyEmail(companyEmail)) && step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white mb-1">Can't access your company email?</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Provide a personal email where we can send your new credentials.
                                </p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
                                Company email: <span className="font-bold">{companyEmail}</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                    Personal / alternative email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={altEmail}
                                    onChange={e => setAltEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                                    placeholder="yourpersonal@gmail.com"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-400 mt-1">Your new credentials will be sent here.</p>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!altEmail.includes('@')}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all"
                            >
                                Continue →
                            </button>
                        </div>
                    )}

                    {/* ── COMPANY EMAIL RECOVERY: step 2 — proof ── */}
                    {mode === 'company_email_recovery' && (!companyEmail || isCompanyEmail(companyEmail)) && step === 2 && (
                        <div className="space-y-5">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white mb-1">Upload proof of identity</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    We need to verify you work with us before resetting access.
                                </p>
                            </div>

                            <ProofUpload
                                proofImage={proofImage}
                                proofFileName={proofFileName}
                                onClear={() => { setProofImage(null); setProofFileName(''); }}
                                onPick={() => fileInputRef.current?.click()}
                            />
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!proofImage || isSubmitting}
                                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <><Icons.Refresh className="animate-spin" size={18} /> Submitting...</> : 'Submit'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── GENERAL ACCESS: step 1 — emails ── */}
                    {mode === 'general_access' && step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white mb-1">Let's find your account</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Provide both emails so we can locate and recover your access.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                    Your work / portal email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={currentEmail}
                                    onChange={e => setCurrentEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                                    placeholder="you@naiyatechnology.org"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                                    Alternative / personal email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={altEmail}
                                    onChange={e => setAltEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                                    placeholder="yourpersonal@gmail.com"
                                />
                                <p className="text-xs text-gray-400 mt-1">We'll use this to contact you.</p>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!currentEmail.includes('@') || !altEmail.includes('@')}
                                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all"
                            >
                                Continue →
                            </button>
                        </div>
                    )}

                    {/* ── GENERAL ACCESS: step 2 — proof ── */}
                    {mode === 'general_access' && step === 2 && (
                        <div className="space-y-5">
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white mb-1">Upload proof of identity</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">One document is enough.</p>
                            </div>

                            <ProofUpload
                                proofImage={proofImage}
                                proofFileName={proofFileName}
                                onClear={() => { setProofImage(null); setProofFileName(''); }}
                                onPick={() => fileInputRef.current?.click()}
                            />
                            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!proofImage || isSubmitting}
                                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <><Icons.Refresh className="animate-spin" size={18} /> Submitting...</> : 'Submit'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Shared proof upload widget ────────────────────────────────────
const ProofUpload: React.FC<{
    proofImage: string | null;
    proofFileName: string;
    onClear: () => void;
    onPick: () => void;
}> = ({ proofImage, proofFileName, onClear, onPick }) => (
    <div>
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Supporting document <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{`Accepted: proof of payment to the company, employment certificate, or ID card with your name on it.`}</p>

        {proofImage ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-green-200 dark:border-green-700 shrink-0">
                    <img src={proofImage} alt="proof" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Document uploaded</p>
                    <p className="text-xs text-green-600 dark:text-green-400 truncate">{proofFileName}</p>
                </div>
                <button onClick={onClear} className="text-green-600 hover:text-red-500 transition-colors p-1">
                    <span className="text-lg leading-none">×</span>
                </button>
            </div>
        ) : (
            <button
                type="button"
                onClick={onPick}
                className="w-full py-8 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-xl flex flex-col items-center gap-2 text-gray-400 hover:border-brand-400 hover:text-brand-500 dark:hover:border-brand-500 transition-all"
            >
                <Icons.Attachment size={28} className="text-gray-400" />
                <span className="text-sm font-semibold">Tap to upload document</span>
                <span className="text-xs">Photo or scanned image</span>
            </button>
        )}
    </div>
);
