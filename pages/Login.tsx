import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Icons } from '../components/common/Icons';
import { useToast } from '../contexts/ToastContext';
import { 
  authenticateAgent, 
  sendAgentOtp, 
  verifyAgentOtpAndSetPassword, 
  updateAgentPassword, 
  getGeneralSettings 
} from '../services/storageService';
import { sendPasswordSetEmail } from '../services/emailService';
import { LoginIntakeAi } from '../components/user/LoginIntakeAi';
import { PrivacyPolicyModal } from '../components/common/PrivacyPolicyModal';
import { User } from '../types';
import { isCompanyEmail } from '../utils/emailUtils';
import { isIndependenceDay } from '../utils/independenceDay';

type LoginStep = 'email' | 'password' | 'otp_setup' | 'otp_forgot' | 'password_reminder' | 'change_password';

export const Login: React.FC = () => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [activeModal, setActiveModal] = useState<'login_assist' | 'privacy' | null>(null);
  const [assistMode, setAssistMode] = useState<'onboarding' | 'company_email_recovery' | 'general_access'>('onboarding');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const [passwordError, setPasswordError] = useState('');
  const [hasConsented, setHasConsented] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Password visibility & OTP resend states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Admin Login States
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const { loginStaff, loginTeamLead, setUser, loading } = useAuth();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem('vpn_banner_dismissed') === '1');
  const [showGuide, setShowGuide] = useState(false);
  const [bannerConfig, setBannerConfig] = useState<{ enabled: boolean; title: string; message: string }>({
    enabled: true,
    title: 'VPN & System Assistance Active',
    message: 'First time signing in? Just enter your email below to start.',
  });

  useEffect(() => {
    getGeneralSettings().then(s => {
      if (s.incidentBanner) setBannerConfig(s.incidentBanner);
    }).catch(() => {});
    
    // Check if coming back from App.tsx password warning modal
    const forceOtp = sessionStorage.getItem('force_otp_setup');
    const setupEmail = sessionStorage.getItem('setup_email');
    if (forceOtp && setupEmail) {
        sessionStorage.removeItem('force_otp_setup');
        sessionStorage.removeItem('setup_email');
        setEmail(setupEmail);
        
        setIsProcessing(true);
        sendAgentOtp(setupEmail).then(res => {
            setIsProcessing(false);
            if (res.status === 'success') {
                setLoginStep('otp_setup');
                setResendCountdown(60);
                showToast(`OTP sent to ${setupEmail} to setup your password.`, 'info');
            } else {
                showToast(res.message || 'Failed to send OTP', 'error');
            }
        }).catch(() => {
            setIsProcessing(false);
            showToast('Connection error. Please try again.', 'error');
        });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAdminLogin) {
          setShowAdminLogin(false);
          return;
        }
        if (activeModal) {
          setActiveModal(null);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminLogin, activeModal]);

  // Handle Resend Countdown Timer
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleResendOtp = async () => {
    if (!email || resendCountdown > 0 || isResending) return;
    setIsResending(true);
    try {
      const res = await sendAgentOtp(email);
      if (res.status === 'success') {
        setResendCountdown(60);
        showToast(`A new 6-digit OTP code has been sent to ${res.sentTo || email}.`, 'success');
      } else {
        showToast(res.message || 'Failed to resend OTP. Please try again.', 'error');
      }
    } catch {
      showToast('Failed to resend OTP code.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const isLenValid = password.length >= 8;
  const isNumValid = /[0-9]/.test(password);
  const isSpecValid = /[^a-zA-Z0-9]/.test(password);
  const isMatchValid = confirmPassword.length > 0 && password === confirmPassword;

  const handleAgentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsProcessing(true);
    setPasswordError('');
    
    try {
        if (loginStep === 'email') {
            const res = await authenticateAgent(email, '');
            if (res.status === 'success' && res.no_password) {
                const agentUser: User = { 
                    email: email.toLowerCase(), 
                    name: email.split('@')[0], 
                    role: 'agent', 
                    teamLeadId: res.agent?.teamLeadId, 
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random`, 
                    token: res.token,
                    hasPassword: false
                };
                sessionStorage.setItem('password_warning', '1');
                setUser(agentUser); 
                localStorage.setItem('app_user', JSON.stringify(agentUser));
            } else if (res.status === 'success') {
                const agentUser: User = { 
                    email: email.toLowerCase(), 
                    name: email.split('@')[0], 
                    role: 'agent', 
                    teamLeadId: res.agent?.teamLeadId, 
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random`, 
                    token: res.token,
                    hasPassword: true
                };
                sessionStorage.removeItem('password_warning');
                setUser(agentUser); 
                localStorage.setItem('app_user', JSON.stringify(agentUser));
            } else if (res.status === 'error' && res.message === 'Invalid credentials') {
                setLoginStep('password');
            } else if (res.status === 'error' && res.message === 'Not found in allowlist') {
                setAssistMode('onboarding');
                setActiveModal('login_assist');
            } else {
                showToast(res.message || 'Not authorized. Please contact IT.', 'error');
            }
        } else if (loginStep === 'password') {
            const res = await authenticateAgent(email, password);
            if (res.status === 'success') {
                const agentUser: User = { 
                    email: email.toLowerCase(), 
                    name: email.split('@')[0], 
                    role: 'agent', 
                    teamLeadId: res.agent?.teamLeadId, 
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random`, 
                    token: res.token,
                    hasPassword: true
                };
                sessionStorage.removeItem('password_warning');
                setUser(agentUser); 
                localStorage.setItem('app_user', JSON.stringify(agentUser));
            } else {
                showToast(res.message || 'Incorrect password. Try again or reset.', 'error');
            }
        } else if (loginStep === 'otp_setup' || loginStep === 'otp_forgot' || loginStep === 'change_password') {
            if (password !== confirmPassword) {
                setPasswordError('Passwords do not match. Please re-type.');
                setIsProcessing(false);
                return;
            }
            if (!isLenValid || !isNumValid || !isSpecValid) {
                setPasswordError('Please meet all password requirements highlighted in green below.');
                setIsProcessing(false);
                return;
            }
            if (loginStep === 'otp_setup' && !hasConsented) {
                setPasswordError('Please accept the Privacy Policy to continue.');
                setIsProcessing(false);
                return;
            }
            
            if (loginStep === 'change_password') {
                const res = await updateAgentPassword(password, pendingUser?.token);
                if (res.status === 'success') {
                    sessionStorage.removeItem('password_warning');
                    sendPasswordSetEmail(pendingUser?.email || email, { isReset: true }).catch(console.error);
                    showToast('Password updated! Confirmation email sent.', 'success');
                    if (pendingUser) {
                        pendingUser.hasPassword = true;
                        localStorage.setItem('app_user', JSON.stringify(pendingUser));
                        setUser(pendingUser);
                    }
                } else {
                    showToast(res.message || 'Failed to update password', 'error');
                }
            } else {
                const res = await verifyAgentOtpAndSetPassword(email, otp, password);
                if (res.status === 'success') {
                    sessionStorage.removeItem('password_warning');
                    sendPasswordSetEmail(email, { isReset: loginStep === 'otp_forgot' }).catch(console.error);
                    const agentUser: User = { 
                        email: email.toLowerCase(), 
                        name: email.split('@')[0], 
                        role: 'agent', 
                        teamLeadId: res.agent?.teamLeadId, 
                        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=random`, 
                        token: res.token,
                        hasPassword: true
                    };
                    setUser(agentUser); 
                    localStorage.setItem('app_user', JSON.stringify(agentUser));
                    showToast('Password created successfully! Confirmation email sent.', 'success');
                } else {
                    showToast(res.message || 'Incorrect or expired OTP code', 'error');
                }
            }
        }
    } catch (err) {
        showToast('Connection error. Please check your internet.', 'error');
    }
    
    setIsProcessing(false);
  };

  const handleForgotPassword = async () => {
      if (!email) {
          showToast('Please enter your email first', 'error');
          return;
      }
      setIsProcessing(true);
      try {
          const res = await sendAgentOtp(email);
          if (res.status === 'success') {
              setLoginStep('otp_forgot');
              setResendCountdown(60);
              const target = res.sentTo || email;
              showToast(`OTP sent to ${target}. Enter it below.`, 'info');
          } else {
              const fallbackMsg = isCompanyEmail(email)
                  ? 'User not found. Try Alternative Recovery below.'
                  : 'User not found. Please contact IT.';
              showToast(res.message || fallbackMsg, 'error');
          }
      } catch (e) {
          showToast('Failed to send OTP code', 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePrivilegedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) return;
    setIsProcessing(true);
    
    // Try Staff first
    const isStaff = await loginStaff(adminEmail, adminPassword);
    if (isStaff) {
        setShowAdminLogin(false);
    } else {
        // Try Team Lead
        const isTL = await loginTeamLead(adminEmail, adminPassword);
        if (isTL) {
            setShowAdminLogin(false);
        } else {
            showToast('Invalid staff credentials.', 'error');
        }
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden bg-slate-950">
      
      {/* Dynamic Mesh Background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-blue-950 to-indigo-950 z-0"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse z-0 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse animation-delay-2000 z-0 pointer-events-none"></div>

      {/* Top Navbar */}
      <div className="absolute top-4 inset-x-4 max-w-4xl mx-auto flex items-center justify-between z-20">
        <div className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 rounded-lg bg-brand-500/30 border border-brand-400/40 flex items-center justify-center text-brand-300 font-black text-sm">
                N
            </div>
            <span className="font-bold text-sm tracking-wide text-white">Naiya Support Desk</span>
            {isIndependenceDay() && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    🇳🇬 Oct 1st
                </span>
            )}
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-white/80">
            <button onClick={() => setActiveModal('privacy')} className="hover:text-white transition-colors flex items-center gap-1">
                <Icons.Shield size={14} /> Privacy
            </button>
            <button 
                onClick={() => { setAssistMode('general_access'); setActiveModal('login_assist'); }} 
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
            >
                Can't access portal?
            </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md z-10 my-16 space-y-4">
        
        {/* Incident Banner */}
        {!bannerDismissed && bannerConfig.enabled && (
            <div className="bg-amber-400/90 backdrop-blur-md text-amber-950 rounded-2xl p-4 shadow-xl border border-amber-300/60 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                    <Icons.AlertCircle className="text-amber-900 shrink-0" size={20} />
                    <div className="min-w-0">
                        <p className="font-bold text-sm leading-tight">{bannerConfig.title}</p>
                        <p className="text-xs opacity-90 leading-tight line-clamp-1 mt-0.5">{bannerConfig.message}</p>
                    </div>
                </div>
                <button
                    onClick={() => { setBannerDismissed(true); sessionStorage.setItem('vpn_banner_dismissed', '1'); }}
                    className="shrink-0 text-amber-950 hover:opacity-70 font-bold text-lg px-2"
                >×</button>
            </div>
        )}

        {/* Step-by-Step Guide toggle */}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-lg">
            <button
                onClick={() => setShowGuide(v => !v)}
                className="w-full flex items-center justify-between p-3.5 text-white/90 text-sm font-medium hover:bg-white/5 transition-all"
            >
                <span className="flex items-center gap-2">
                    <Icons.Help className="text-brand-400" size={16} /> 
                    <span>How to sign in (Simple 3-Step Guide)</span>
                </span>
                <span className="text-white/40 text-xs font-bold">{showGuide ? '▲ Close' : '▼ View'}</span>
            </button>
            {showGuide && (
                <div className="p-4 pt-1 text-xs text-white/80 space-y-2.5 border-t border-white/10 animate-fade-in">
                    <div className="flex gap-2.5 items-start">
                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">1</span>
                        <p><strong>First time?</strong> Just enter your email and click Continue. No password needed yet!</p>
                    </div>
                    <div className="flex gap-2.5 items-start">
                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">2</span>
                        <p><strong>Have a password?</strong> Enter your email, then enter your password on the next screen.</p>
                    </div>
                    <div className="flex gap-2.5 items-start">
                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">3</span>
                        <p><strong>Need help or not registered?</strong> Click "Can't access portal?" at the top to submit an instant request.</p>
                    </div>
                </div>
            )}
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 border border-white/20 shadow-2xl space-y-6">
            
            {/* Header & Step Indicator */}
            <div className="space-y-2 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-brand-500/20 border border-brand-400/30 text-brand-300 shadow-inner mb-1">
                    <Icons.Shield size={32} />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                    {loginStep === 'otp_setup' ? 'Set Your Secret Password' : loginStep === 'otp_forgot' ? 'Reset Your Password' : 'Sign In to Support'}
                </h1>
                <p className="text-xs text-sky-100/70">
                    {loginStep === 'email' && "Step 1 of 2: Enter your work email"}
                    {loginStep === 'password' && "Step 2 of 2: Enter your secret password"}
                    {loginStep === 'otp_setup' && `Create a secure password for ${email}`}
                    {loginStep === 'otp_forgot' && `Enter OTP & create new password for ${email}`}
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAgentLogin} className="space-y-4">
                
                {/* Step 1: Email */}
                {loginStep === 'email' && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/90 flex items-center gap-1.5 uppercase tracking-wider">
                            <Icons.Mail size={14} className="text-brand-300" /> Your Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="e.g. name@naiya.com"
                            className="w-full h-14 px-4 bg-black/30 border border-white/20 focus:border-brand-400 focus:bg-black/50 rounded-2xl outline-none text-white text-base placeholder-white/40 shadow-inner transition-all"
                            required
                            autoFocus
                        />
                    </div>
                )}

                {/* Step 2: Password */}
                {loginStep === 'password' && (
                    <div className="space-y-3 animate-fade-in">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                            <span className="text-xs text-white/90 truncate font-semibold">{email}</span>
                            <button
                                type="button"
                                onClick={() => { setLoginStep('email'); setPassword(''); }}
                                className="text-[11px] text-brand-300 hover:text-white font-bold"
                            >
                                Change
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5 uppercase tracking-wider">
                                <Icons.Shield size={14} className="text-brand-300" /> Your Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="w-full h-14 pl-4 pr-12 bg-black/30 border border-white/20 focus:border-brand-400 focus:bg-black/50 rounded-2xl outline-none text-white text-base placeholder-white/40 shadow-inner transition-all"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                                >
                                    {showPassword ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                            <button
                                type="button"
                                onClick={handleForgotPassword}
                                className="text-brand-300 hover:text-white font-semibold underline transition-colors"
                            >
                                Forgot password?
                            </button>
                            {isCompanyEmail(email) && (
                                <button
                                    type="button"
                                    onClick={() => { setAssistMode('company_email_recovery'); setActiveModal('login_assist'); }}
                                    className="text-white/60 hover:text-white transition-colors"
                                >
                                    Use recovery form →
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* OTP Setup or Reset with Resend & Live Requirements */}
                {(loginStep === 'otp_setup' || loginStep === 'otp_forgot' || loginStep === 'change_password') && (
                    <div className="space-y-4 animate-fade-in">
                        
                        {/* OTP Input with Resend Action */}
                        {(loginStep === 'otp_setup' || loginStep === 'otp_forgot') && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-white/90 uppercase tracking-wider">
                                        6-Digit Verification Code
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resendCountdown > 0 || isResending}
                                        className="text-xs text-brand-300 hover:text-white font-bold transition-colors disabled:opacity-50 disabled:hover:text-brand-300"
                                    >
                                        {isResending ? (
                                            'Sending...'
                                        ) : resendCountdown > 0 ? (
                                            `Resend in ${resendCountdown}s`
                                        ) : (
                                            'Resend OTP Code'
                                        )}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                    placeholder="• • • • • •"
                                    maxLength={6}
                                    className="w-full h-14 px-4 bg-black/30 border border-white/20 focus:border-brand-400 rounded-2xl outline-none text-white text-center font-mono text-2xl tracking-[0.3em] shadow-inner"
                                    required
                                    autoFocus
                                />

                                {/* Official Email Access Check & Recovery Prompt (Only shown for company emails) */}
                                {isCompanyEmail(email) && (
                                    <div className="p-3 bg-amber-500/10 border border-amber-400/20 rounded-2xl flex items-start gap-2.5 mt-2">
                                        <Icons.Mail className="text-amber-300 shrink-0 mt-0.5" size={18} />
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <p className="text-xs font-bold text-amber-200">
                                                Do you have access to open {email}?
                                            </p>
                                            <p className="text-[11px] text-white/70 leading-relaxed">
                                                If you cannot open this official inbox to view your OTP code, tap below to recover using your personal email.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAssistMode('company_email_recovery');
                                                    setActiveModal('login_assist');
                                                }}
                                                className="text-xs text-brand-300 hover:text-white font-bold underline transition-colors pt-0.5 inline-flex items-center gap-1"
                                            >
                                                <span>Can't access company inbox? Recover here →</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* New Password Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white/90 uppercase tracking-wider">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full h-14 pl-4 pr-12 bg-black/30 border border-white/20 focus:border-brand-400 focus:bg-black/50 rounded-2xl outline-none text-white text-base placeholder-white/40 shadow-inner transition-all"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                                >
                                    {showPassword ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white/90 uppercase tracking-wider">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Re-type password"
                                    className="w-full h-14 pl-4 pr-12 bg-black/30 border border-white/20 focus:border-brand-400 focus:bg-black/50 rounded-2xl outline-none text-white text-base placeholder-white/40 shadow-inner transition-all"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                                >
                                    {showConfirmPassword ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Smart Live Requirement Checklist */}
                        <div className="p-3.5 bg-black/20 rounded-2xl border border-white/10 space-y-2 text-xs">
                            <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Password Requirements:
                            </p>
                            
                            <div className="grid grid-cols-1 gap-1.5">
                                <div className={`flex items-center gap-2 transition-colors ${isLenValid ? 'text-emerald-400 font-semibold' : 'text-white/40'}`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isLenValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 border border-white/20'}`}>
                                        {isLenValid ? <Icons.Check size={10} /> : '•'}
                                    </span>
                                    <span>At least 8 characters long</span>
                                </div>

                                <div className={`flex items-center gap-2 transition-colors ${isNumValid ? 'text-emerald-400 font-semibold' : 'text-white/40'}`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isNumValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 border border-white/20'}`}>
                                        {isNumValid ? <Icons.Check size={10} /> : '•'}
                                    </span>
                                    <span>Includes at least one number (0-9)</span>
                                </div>

                                <div className={`flex items-center gap-2 transition-colors ${isSpecValid ? 'text-emerald-400 font-semibold' : 'text-white/40'}`}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isSpecValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 border border-white/20'}`}>
                                        {isSpecValid ? <Icons.Check size={10} /> : '•'}
                                    </span>
                                    <span>Includes a special character (e.g. !@#$%)</span>
                                </div>

                                {confirmPassword.length > 0 && (
                                    <div className={`flex items-center gap-2 transition-colors ${isMatchValid ? 'text-emerald-400 font-semibold' : 'text-rose-400'}`}>
                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isMatchValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                                            {isMatchValid ? <Icons.Check size={10} /> : <Icons.Close size={10} />}
                                        </span>
                                        <span>{isMatchValid ? 'Passwords match' : 'Passwords do not match'}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {loginStep === 'otp_setup' && (
                            <label className="flex items-start gap-2 cursor-pointer pt-1 text-xs text-white/80">
                                <input
                                    type="checkbox"
                                    checked={hasConsented}
                                    onChange={e => setHasConsented(e.target.checked)}
                                    className="mt-0.5 rounded text-brand-500"
                                />
                                <span>I accept the <button type="button" onClick={() => setActiveModal('privacy')} className="text-brand-300 hover:underline">Privacy Policy</button> & Data Processing terms.</span>
                            </label>
                        )}

                        {passwordError && (
                            <p className="text-xs text-red-300 bg-red-950/50 p-2.5 rounded-xl border border-red-800 text-center font-medium animate-shake">
                                {passwordError}
                            </p>
                        )}
                    </div>
                )}

                {/* Submit Action Button */}
                <button
                    type="submit"
                    disabled={isProcessing || loading}
                    className="w-full h-14 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-base rounded-2xl transition-all shadow-lg hover:shadow-brand-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isProcessing ? (
                        <Icons.Refresh className="animate-spin" size={20} />
                    ) : (
                        <span>
                            {loginStep === 'email' ? 'Continue →' : loginStep === 'password' ? 'Sign In Now' : 'Save Password & Continue →'}
                        </span>
                    )}
                </button>

                {loginStep !== 'email' && (
                    <button
                        type="button"
                        onClick={() => { setLoginStep('email'); setPassword(''); setConfirmPassword(''); setOtp(''); setPasswordError(''); }}
                        className="w-full text-center text-xs text-white/60 hover:text-white transition-colors pt-1"
                    >
                        ← Back to email
                    </button>
                )}
            </form>
        </div>

        {/* IT Staff & Manager Discrete Entry */}
        <div className="text-center pt-2">
            <button
                onClick={() => setShowAdminLogin(true)}
                className="text-xs font-bold text-white/50 hover:text-white px-4 py-2 rounded-full border border-white/10 hover:border-white/30 bg-white/5 transition-all inline-flex items-center gap-1.5"
            >
                <Icons.Lock size={12} /> IT Staff / Manager Sign In
            </button>
        </div>

      </div>

      {/* Staff Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-surface-900 border border-surface-700/60 w-full max-w-sm rounded-2xl shadow-modal p-6 sm:p-8 relative animate-scale-in space-y-6">
             <button onClick={() => setShowAdminLogin(false)} className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors">
                <Icons.Close size={20} />
             </button>

             <div>
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-3">
                    <Icons.Shield size={22} />
                </div>
                <h2 className="text-xl font-bold text-white">IT Staff & Managers</h2>
                <p className="text-xs text-white/60">Enter administrative username or email</p>
             </div>

             <form onSubmit={handlePrivilegedLogin} className="space-y-4">
                <input 
                    type="text" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)} 
                    placeholder="Staff Email or Username" 
                    className="w-full h-12 px-4 bg-black/40 border border-white/10 focus:border-brand-400 rounded-xl outline-none text-white text-sm"
                    autoFocus
                    required
                />
                <input 
                    type="password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)} 
                    placeholder="Staff Password" 
                    className="w-full h-12 px-4 bg-black/40 border border-white/10 focus:border-brand-400 rounded-xl outline-none text-white text-sm"
                    required
                />
                <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full h-12 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                    {isProcessing ? 'Verifying...' : 'Access IT Workspace'}
                </button>
             </form>
          </div>
        </div>
      )}

      {/* Onboarding / Alternative Recovery Modal */}
      {activeModal === 'login_assist' && (
          <LoginIntakeAi
              onClose={() => setActiveModal(null)}
              mode={assistMode}
              companyEmail={email}
          />
      )}

      {/* Privacy Policy Modal */}
      {activeModal === 'privacy' && (
          <PrivacyPolicyModal onClose={() => setActiveModal(null)} />
      )}

    </div>
  );
};
