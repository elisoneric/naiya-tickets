import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useAuth } from '../../contexts/AuthContext';

export const AgentOnboardingGuide: React.FC = () => {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        const hasSeenGuide = localStorage.getItem('agent_guide_seen');
        if (!hasSeenGuide) {
            setTimeout(() => setVisible(true), 800);
        }

        const handleOpen = () => {
            setStep(0);
            setVisible(true);
        };
        window.addEventListener('open-agent-guide', handleOpen);
        return () => window.removeEventListener('open-agent-guide', handleOpen);
    }, []);

    useEffect(() => {
        if (!visible) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                skipGuide();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                nextStep();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setStep(s => Math.max(0, s - 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, step]);

    const skipGuide = () => {
        localStorage.setItem('agent_guide_seen', 'true');
        setVisible(false);
    };

    const nextStep = () => {
        if (step >= 2) {
            skipGuide();
        } else {
            setStep(s => s + 1);
        }
    };

    if (!visible || user?.role === 'staff' || user?.role === 'team_lead') return null;

    const tourSteps = [
        {
            icon: Icons.User,
            title: `Welcome, ${user?.name?.split(' ')[0] || 'Partner'}!`,
            desc: "Welcome to Naiya Support Desk. We've redesigned everything so you can get help quickly and easily without confusion.",
            tip: "Tip: You can access this portal on your phone or computer anytime."
        },
        {
            icon: Icons.Shield,
            title: 'Fix Common Problems in Seconds',
            desc: 'Tap the big cards on the screen for VPN connectivity, NIMC login reset, or Webmail errors. The system will guide you step by step.',
            tip: 'Tip: Everything is automated so you don’t have to wait for staff for simple fixes!'
        },
        {
            icon: Icons.Chat,
            title: 'Live Chat & Support Requests',
            desc: 'Have a different problem? Click "New Request / Chat with AI" to talk to our smart assistant or submit an issue directly to IT staff.',
            tip: 'Tip: Check "My Support Tickets" to see live replies and chat with our team.'
        }
    ];

    const currentTour = tourSteps[step];
    const TourIcon = currentTour.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={skipGuide} />

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden w-full max-w-md relative z-10 flex flex-col animate-slide-in-up border border-gray-100 dark:border-white/10">
                <button 
                    onClick={skipGuide} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                    <Icons.Close size={20} />
                </button>

                <div className="p-8 pb-6 text-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto shadow-inner border border-brand-200/50 dark:border-brand-700/50">
                        <TourIcon size={36} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{currentTour.title}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            {currentTour.desc}
                        </p>
                    </div>

                    <div className="p-3 bg-brand-50/80 dark:bg-brand-900/20 rounded-2xl text-xs text-brand-800 dark:text-brand-300 font-medium text-left border border-brand-200/50 dark:border-brand-800/50">
                        {currentTour.tip}
                    </div>

                    {/* Stepper Dots */}
                    <div className="flex justify-center gap-2 pt-2">
                        {tourSteps.map((_, i) => (
                            <div 
                                key={i} 
                                className={`h-2 rounded-full transition-all ${step === i ? 'w-8 bg-brand-600' : 'w-2 bg-gray-200 dark:bg-slate-700'}`} 
                            />
                        ))}
                    </div>
                </div>

                <div className="px-8 py-5 bg-gray-50 dark:bg-slate-800/60 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                    <button 
                        onClick={skipGuide} 
                        className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider"
                    >
                        Skip Tour
                    </button>
                    <button 
                        onClick={nextStep} 
                        className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-brand-500/30 transition-all"
                    >
                        {step === 2 ? "Let's Get Started →" : "Next Step →"}
                    </button>
                </div>
            </div>
        </div>
    );
};
