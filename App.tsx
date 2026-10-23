import React, { useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TicketProvider } from './contexts/TicketContext';
import { ToastProvider } from './contexts/ToastContext';
import { Icons } from './components/common/Icons';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const EnterpriseAgentDashboard = lazy(() => import('./components/admin/EnterpriseAgentDashboard').then(m => ({ default: m.EnterpriseAgentDashboard })));
const UserDashboard = lazy(() => import('./pages/UserDashboard').then(m => ({ default: m.UserDashboard })));

// Lazy-load Nigeria Independence Banner (Oct 1st)
const IndependenceBanner = lazy(() =>
  import('./components/common/IndependenceBanner').then(m => ({ default: m.IndependenceBanner }))
);

const CURRENT_APP_VERSION = '2026.09.19-vpn-escalate';

if (typeof window !== 'undefined') {
  const lastVersion = localStorage.getItem('naiya_app_version');
  if (lastVersion && lastVersion !== CURRENT_APP_VERSION) {
    localStorage.setItem('naiya_app_version', CURRENT_APP_VERSION);
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  } else if (!lastVersion) {
    localStorage.setItem('naiya_app_version', CURRENT_APP_VERSION);
  }
}

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-surface-0 dark:bg-dark-bg text-brand-600 transition-colors">
    <div className="w-10 h-10 rounded-full border-2 border-brand-200 dark:border-brand-900 border-t-brand-600 animate-spin" />
    <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-3 animate-fade-in">Loading...</p>
  </div>
);

const NetworkDetector = () => {
    const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

    useEffect(() => {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => {
            setIsOffline(false);
            window.dispatchEvent(new CustomEvent('network-recovered'));
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed top-0 left-0 w-full z-[9999] bg-red-600 text-white flex items-center justify-center py-2 px-4 shadow-elevated transition-all duration-300">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Icons.Alert size={16} />
                <span>Network Disconnected. Waiting for connection...</span>
            </div>
        </div>
    );
};

const MaintenanceOverlay = lazy(() =>
  import('./components/common/MaintenanceOverlay').then(m => ({ default: m.MaintenanceOverlay }))
);

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showPasswordWarning, setShowPasswordWarning] = React.useState(false);
  const [siteMaintenanceMode, setSiteMaintenanceMode] = React.useState(false);
  const [siteMaintenanceMessage, setSiteMaintenanceMessage] = React.useState('');

  const checkMaintenance = React.useCallback(async () => {
    try {
      const { getGeneralSettings } = await import('./services/storageService');
      const settings = await getGeneralSettings();
      const isMaint = !!settings.siteMaintenanceMode;
      setSiteMaintenanceMode(isMaint);
      if (settings.siteMaintenanceMessage) {
        setSiteMaintenanceMessage(settings.siteMaintenanceMessage);
      }
      try {
        if (isMaint) {
          localStorage.setItem('site_maintenance_mode', '1');
          if (settings.siteMaintenanceMessage) {
            localStorage.setItem('site_maintenance_msg', settings.siteMaintenanceMessage);
          }
        } else {
          localStorage.removeItem('site_maintenance_mode');
          localStorage.removeItem('site_maintenance_msg');
        }
      } catch {}
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    checkMaintenance();

    // Heartbeat: Check maintenance status every 4 seconds in background so all other logged-in profiles/devices are locked immediately without waiting for a manual reload
    const interval = setInterval(() => {
      checkMaintenance();
    }, 4000);

    const handleMaintEvent = (e: any) => {
      if (e.detail && typeof e.detail.mode === 'boolean') {
        setSiteMaintenanceMode(e.detail.mode);
        if (e.detail.message) {
          setSiteMaintenanceMessage(e.detail.message);
        }
      } else {
        checkMaintenance();
      }
    };

    // Cross-tab synchronization via localStorage
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'site_maintenance_mode') {
        setSiteMaintenanceMode(e.newValue === '1');
      }
      if (e.key === 'site_maintenance_msg' && e.newValue) {
        setSiteMaintenanceMessage(e.newValue);
      }
    };

    window.addEventListener('site-maintenance-updated', handleMaintEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('site-maintenance-updated', handleMaintEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [checkMaintenance]);

  useEffect(() => {
      if (user) {
          if (user.hasPassword || user.role === 'staff' || user.role === 'team_lead') {
              sessionStorage.removeItem('password_warning');
              setShowPasswordWarning(false);
          } else if (sessionStorage.getItem('password_warning') === '1') {
              setShowPasswordWarning(true);
          }
      }
  }, [user]);

  // Support Esc to dismiss warning modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPasswordWarning) {
        sessionStorage.removeItem('password_warning');
        setShowPasswordWarning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPasswordWarning]);

  if (loading) {
    return <LoadingScreen />;
  }

  const isStaffOrLead = user && (user.role === 'staff' || user.role === 'team_lead');

  // Enforce full site maintenance mode: if active and user is not staff/team lead, show full maintenance overlay
  if (siteMaintenanceMode && !isStaffOrLead) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <MaintenanceOverlay
          message={siteMaintenanceMessage}
          onLoginSuccess={() => {
            // Re-check after successful staff authentication
            checkMaintenance();
          }}
        />
      </Suspense>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Staff AND Team Leads use the Outlook-style Dashboard
  return (
    <>
      {siteMaintenanceMode && isStaffOrLead && (
        <div className="bg-red-600 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-between shrink-0 shadow-sm relative z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>FULL SITE MAINTENANCE ACTIVE — Public access and tickets are locked. Management session in progress.</span>
          </div>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/settings');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors"
          >
            Manage in Settings
          </button>
        </div>
      )}
      {showPasswordWarning && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
              <div className="bg-surface-0 dark:bg-dark-card rounded-2xl max-w-md w-full p-6 shadow-modal border border-surface-200 dark:border-dark-border text-center animate-scale-in">
                  <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Icons.Alert size={28} />
                  </div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">Password Setup Required</h2>
                  <p className="text-surface-600 dark:text-surface-300 mb-6 text-sm leading-relaxed">
                      Starting <strong className="text-surface-900 dark:text-white font-semibold">August 30, 2026</strong>, you must have a password to access the portal. Please set it up soon to avoid losing access.
                  </p>
                  <div className="flex gap-3 justify-center">
                      <button onClick={() => {
                          sessionStorage.removeItem('password_warning');
                          setShowPasswordWarning(false);
                      }} className="px-4 py-2.5 rounded-lg font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-dark-hover transition-colors text-sm">
                          Remind Me Later (Esc)
                      </button>
                      <button onClick={() => {
                          sessionStorage.removeItem('password_warning');
                          setShowPasswordWarning(false);
                          
                          // Set flag for Login.tsx to force OTP setup
                          sessionStorage.setItem('force_otp_setup', '1');
                          sessionStorage.setItem('setup_email', user?.email || '');
                          
                          // Clear user to go back to login flow and setup OTP
                          window.localStorage.removeItem('app_user');
                          window.location.reload();
                      }} className="px-5 py-2.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white shadow-sm transition-all text-sm">
                          Set Password Now
                      </button>
                  </div>
              </div>
          </div>
      )}
      {isStaffOrLead ? <EnterpriseAgentDashboard /> : <UserDashboard />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <TicketProvider>
            <NetworkDetector />
            <Suspense fallback={null}>
              <IndependenceBanner />
            </Suspense>
            <Suspense fallback={<LoadingScreen />}>
              <AppContent />
            </Suspense>
          </TicketProvider>
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
};

export default App;