import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';

interface PrivacyPolicyModalProps {
    onClose: () => void;
    onAccept?: () => void; // Optional — when shown inline during signup
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ onClose, onAccept }) => {
    const [accepted, setAccepted] = useState(false);
    const UPDATED = 'July 2026';

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

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4 animate-fade-in">
            <div className="bg-surface-0 dark:bg-dark-card w-full max-w-2xl rounded-none sm:rounded-2xl shadow-modal flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] border border-surface-200 dark:border-dark-border animate-scale-in overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-surface-200 dark:border-dark-border flex items-center justify-between bg-surface-900 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white">Privacy Policy & Data Notice</h2>
                        <p className="text-xs text-surface-300 mt-0.5">In compliance with the Nigeria Data Protection Commission (NDPC) Act 2023</p>
                    </div>
                    <button onClick={onClose} className="text-surface-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" title="Close (Esc)">
                        <Icons.Close size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-700 dark:text-gray-300 space-y-6 leading-relaxed">
                    <p className="text-xs text-gray-400 italic">Last Updated: {UPDATED} · Na'iya Technology / Samuiky Global</p>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            Who We Are
                        </h3>
                        <p>This portal is operated by <strong>Na'iya Technology Limited</strong> and its affiliate <strong>Samuiky Global</strong> (collectively "we", "us"). We provide this internal IT support desk to our authorized field agents and staff. Your privacy and the security of your personal data are a priority to us.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            What Data We Collect
                        </h3>
                        <ul className="space-y-1.5 list-inside">
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></span><span><strong>Identity data:</strong> Full name, NIN (National Identification Number), phone number, company email address.</span></li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></span><span><strong>Access credentials:</strong> Hashed passwords and OTP records (stored encrypted — plain text is never retained).</span></li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></span><span><strong>Support ticket content:</strong> Descriptions, messages, and attachments submitted through this portal.</span></li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></span><span><strong>Session data:</strong> Login activity and access timestamps for security auditing.</span></li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            Why We Collect It (Legal Basis)
                        </h3>
                        <ul className="space-y-1.5">
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span><span><strong>Contractual necessity:</strong> To verify your identity and grant access to the support portal in line with your employment/agency agreement.</span></li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span><span><strong>Legitimate interests:</strong> System security, fraud prevention, and audit logging.</span></li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span><span><strong>Consent:</strong> For first-time password setup and email communications where consent is explicitly obtained.</span></li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                            How We Use Your Data
                        </h3>
                        <p>Your data is used exclusively to: (a) authenticate your identity, (b) manage your support tickets, (c) communicate system notifications, and (d) comply with internal audit requirements. We do <strong>not</strong> sell your data, share it with unauthorized third parties, or use it for advertising.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                            Data Retention
                        </h3>
                        <p>Account records are retained for the duration of your engagement with Na'iya Technology / Samuiky Global plus a mandatory 12-month post-termination retention period as required by Nigerian financial regulations. Support tickets are retained for 24 months. After these periods, records are securely deleted.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">6</span>
                            Your Rights (NDPC Act 2023 / GDPR-Equivalent)
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                ['Right to Access', 'Request a copy of all data we hold on you.'],
                                ['Right to Rectification', 'Request correction of inaccurate personal data.'],
                                ['Right to Erasure', 'Request deletion of your data (subject to legal hold obligations).'],
                                ['Right to Portability', 'Receive your data in a machine-readable format.'],
                                ['Right to Object', 'Object to processing based on legitimate interests.'],
                                ['Right to Withdraw Consent', 'Withdraw consent at any time without affecting prior processing.'],
                            ].map(([right, desc]) => (
                                <div key={right} className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 border border-gray-100 dark:border-white/10">
                                    <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">{right}</p>
                                    <p className="text-gray-500 dark:text-gray-400">{desc}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-gray-500">To exercise any of these rights, contact: <strong className="text-blue-600 dark:text-blue-400">ticket@naiyatechnology.org</strong> with the subject line "DATA REQUEST".</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">7</span>
                            Security
                        </h3>
                        <p>All passwords are stored using industry-standard bcrypt hashing. OTPs expire in 10 minutes. Sessions use JWT tokens with expiry limits. All data is transmitted over HTTPS.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">8</span>
                            Regulatory Compliance
                        </h3>
                        <p>This policy is written in compliance with the <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and enforced by the <strong>Nigeria Data Protection Commission (NDPC)</strong>. It also incorporates GDPR-equivalent standards as required for cross-border data handling.</p>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0">
                    {onAccept ? (
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={accepted}
                                    onChange={e => setAccepted(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                    I have read and understood this Privacy Policy. I consent to the processing of my personal data as described above, in accordance with the NDPC Act 2023.
                                </span>
                            </label>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { if (accepted) onAccept(); }}
                                    disabled={!accepted}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold text-sm transition-colors"
                                >
                                    I Accept & Continue
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white/10 text-white font-semibold text-sm hover:bg-slate-800 dark:hover:bg-white/20 transition-colors"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
