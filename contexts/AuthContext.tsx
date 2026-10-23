
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authenticateStaff, authenticateTeamLead, authenticateAgent } from '../services/storageService';
import { useToast } from './ToastContext';
import { Icons } from '../components/common/Icons';

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  loginStaff: (email: string, password: string) => Promise<boolean>;
  loginTeamLead: (email: string, password: string) => Promise<boolean>;
  loginUser: (email: string, password?: string) => Promise<any>;
  logout: () => void;
  configError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env?.VITE_API_URL || '/backend/api.php';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const init = async () => {
        // Check for maintenance / DB connection by making a light call
        try {
            const res = await fetch(`${API_URL}?action=get_settings`);
            if (res.status === 503) throw new Error("Maintenance");

            const storedUser = localStorage.getItem('app_user');
            if (storedUser) {
                const parsedUser: User = JSON.parse(storedUser);
                const isRoot = Boolean(
                    parsedUser.isRoot === true ||
                    (parsedUser as any).is_root === 1 ||
                    (parsedUser as any).is_root === '1' ||
                    (parsedUser as any).is_root === true ||
                    parsedUser.email?.toLowerCase() === 'itstaff'
                );
                parsedUser.isRoot = isRoot;
                setUser(parsedUser);
            }
        } catch (e: any) {
            if (e.message === "Maintenance") {
                setConfigError("System Under Maintenance. Database connection failed.");
            }
        } finally {
            setLoading(false);
        }
    };
    init();
  }, []);

  const loginStaff = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const staffAccount = await authenticateStaff(email, password);
      
      if (staffAccount) {
        const isRootUser = Boolean(
          staffAccount.isRoot === true ||
          (staffAccount as any).is_root === 1 ||
          (staffAccount as any).is_root === '1' ||
          (staffAccount as any).is_root === true ||
          staffAccount.email?.toLowerCase() === 'itstaff'
        );
        const staffUser: User = {
          email: staffAccount.email,
          name: staffAccount.name,
          role: 'staff',
          avatar: staffAccount.avatar || 'https://ui-avatars.com/api/?name=' + staffAccount.name,
          isRoot: isRootUser,
          specializedCategories: staffAccount.specializedCategories || [],
          token: (staffAccount as any).token
        };
        setUser(staffUser);
        localStorage.setItem('app_user', JSON.stringify(staffUser));
        showToast(`Welcome back, ${staffUser.name}`, 'success');
        return true;
      } 
      return false;
    } catch (error) {
      console.error(error);
      showToast('Login error (DB connection?)', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginTeamLead = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
        const tl = await authenticateTeamLead(email, password);
        if (tl) {
             const tlUser: User = {
                 email: tl.email,
                 name: tl.name,
                 role: 'team_lead',
                 managedTeamId: tl.id,
                 avatar: tl.avatar || `https://ui-avatars.com/api/?name=${tl.name}&background=7c3aed&color=fff`,
                 token: (tl as any).token
             };
             setUser(tlUser);
             localStorage.setItem('app_user', JSON.stringify(tlUser));
             showToast(`Welcome Team Lead, ${tl.name}`, 'success');
             return true;
        }
        return false;
    } catch (error) {
        showToast('Login error', 'error');
        return false;
    } finally {
        setLoading(false);
    }
  };

  const loginUser = async (email: string, password?: string): Promise<any> => {
    setLoading(true);
    try {
      const normalizedEmail = email.toLowerCase();
      let res = await authenticateAgent(normalizedEmail, password);

      if (res && res.status === 'success') {
        const agentUser: User = {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          role: 'agent',
          teamLeadId: res.agent?.teamLeadId,
          avatar: `https://ui-avatars.com/api/?name=${normalizedEmail}&background=random`,
          token: res.token
        };
        setUser(agentUser);
        localStorage.setItem('app_user', JSON.stringify(agentUser));
        showToast('Login successful', 'success');
        return res;
      } else if (res && res.status === 'setup_required') {
        return res;
      } else {
        showToast(res?.message || 'Login failed', 'error');
        return res || { status: 'error' };
      }
    } catch (error) {
      console.error(error);
      showToast('Error verifying credentials', 'error');
      return { status: 'error' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('app_user');
    showToast('Logged out', 'info');
  };

  if (configError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <div className="max-w-lg w-full bg-white dark:bg-slate-800 p-8 rounded-xl shadow-2xl border-l-4 border-yellow-500">
                <div className="flex items-center gap-3 mb-4 text-yellow-600 dark:text-yellow-400">
                    <Icons.Alert size={32} />
                    <h2 className="text-2xl font-bold">Under Maintenance</h2>
                </div>
                <p className="mb-6 text-gray-600 dark:text-gray-300">
                    The system is currently undergoing database migration or maintenance.
                    <br/><br/>
                    <span className="text-xs font-mono bg-gray-100 dark:bg-black/20 p-1 rounded">Status: {configError}</span>
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <Icons.Refresh size={20} />
                    Retry Connection
                </button>
            </div>
        </div>
      );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loginStaff, loginTeamLead, loginUser, logout, configError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
