import React, { useState, useEffect } from 'react';
import { isIndependenceDay, getIndependenceAge } from '../../utils/independenceDay';

export const IndependenceBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Only show on October 1st, and only if user hasn't dismissed today
        const isDismissed = sessionStorage.getItem('independence_dismissed');
        if (isIndependenceDay() && !isDismissed) {
            setVisible(true);
        }
    }, []);

    // Also allow Esc key to dismiss the banner if active
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && visible && !dismissed) {
                setDismissed(true);
                sessionStorage.setItem('independence_dismissed', '1');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, dismissed]);

    if (!visible || dismissed) return null;

    const age = getIndependenceAge();

    return (
        <aside aria-label="Independence Day Celebration" className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-white to-emerald-600 text-emerald-950 shrink-0 z-40 shadow-xs border-b border-emerald-500/20">
            {/* Confetti particles (CSS-only) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full animate-confetti"
                        style={{
                            left: `${(i * 4.2 + (i % 2 === 0 ? 1 : 2.5)) % 100}%`,
                            backgroundColor: i % 3 === 0 ? '#008751' : i % 3 === 1 ? '#ffffff' : '#047857',
                            animationDelay: `${(i * 0.15) % 2.5}s`,
                            animationDuration: `${2.2 + ((i * 0.3) % 2)}s`,
                        }}
                    />
                ))}
            </div>

            <div className="relative flex items-center justify-center gap-3 py-2 px-4 max-w-7xl mx-auto">
                <span className="text-xl md:text-2xl select-none" role="img" aria-label="Nigeria flag">🇳🇬</span>
                <div className="text-center">
                    <p className="text-xs md:text-sm font-bold tracking-tight text-emerald-950">
                        Happy {age}th Independence Day, Nigeria! 🎉
                    </p>
                    <p className="text-[11px] md:text-xs font-medium text-emerald-900/90 hidden sm:block">
                        October 1st — Celebrating unity, strength, and progress
                    </p>
                </div>
                <span className="text-xl md:text-2xl select-none" role="img" aria-label="Nigeria flag">🇳🇬</span>

                <button
                    onClick={() => {
                        setDismissed(true);
                        sessionStorage.setItem('independence_dismissed', '1');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-emerald-500/20 active:scale-95 rounded-lg text-emerald-900/70 hover:text-emerald-950 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    title="Dismiss (Esc)"
                    aria-label="Dismiss banner"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </aside>
    );
};
