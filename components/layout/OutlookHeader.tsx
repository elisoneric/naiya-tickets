import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../common/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTickets } from '../../contexts/TicketContext';
import { isIndependenceDay } from '../../utils/independenceDay';

interface OutlookHeaderProps {
  toggleMobileMenu?: () => void;
}

export const OutlookHeader: React.FC<OutlookHeaderProps> = ({ toggleMobileMenu }) => {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { searchQuery, setSearchQuery, loading: ticketsLoading, tickets, activeTicketId } = useTickets();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isNigeriaDay = isIndependenceDay();

  // Check if detail is loading for active ticket
  const isDetailLoading = activeTicketId && !tickets.find(t => t.id === activeTicketId)?.detailsLoaded;
  const isLoading = authLoading || ticketsLoading || isDetailLoading;

  // Global keyboard shortcuts: "/" or "Ctrl+K" to focus search; "Esc" to clear/blur or close dropdown
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;

      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (e.key === 'Escape') {
        if (dropdownOpen) {
          setDropdownOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [dropdownOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <header className={`h-11 flex items-center justify-between px-3 md:px-4 shrink-0 z-30 relative select-none border-b transition-colors ${
      isNigeriaDay
        ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 text-white border-emerald-900 shadow-xs'
        : 'bg-surface-0 dark:bg-dark-surface text-surface-700 dark:text-surface-300 border-surface-200 dark:border-dark-border shadow-xs'
    }`}>
      {/* Global Loading Bar */}
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-brand-100 dark:bg-dark-card overflow-hidden z-50">
          <div className="h-full bg-brand-500 animate-[progress-indeterminate_1s_infinite_linear] w-full origin-left"></div>
        </div>
      )}

      {/* Left: Brand */}
      <div className="flex items-center gap-2 w-auto md:w-1/4">
        {toggleMobileMenu && (
          <button 
            onClick={toggleMobileMenu}
            className={`md:hidden p-1.5 rounded-lg transition-colors ${
              isNigeriaDay
                ? 'hover:bg-white/10 text-white'
                : 'hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300'
            }`}
            aria-label="Toggle menu"
          >
            <Icons.Menu size={18} />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs ${
            isNigeriaDay ? 'bg-white text-emerald-800' : 'bg-brand-600 text-white'
          }`}>
            N
          </div>
          <span className={`font-bold text-[14px] md:text-[15px] tracking-tight hidden sm:block whitespace-nowrap ${
            isNigeriaDay ? 'text-white' : 'text-surface-900 dark:text-white'
          }`}>
            NAIYA TECHNOLOGY
          </span>
          <span className={`font-bold text-[14px] tracking-tight sm:hidden ${
            isNigeriaDay ? 'text-white' : 'text-surface-900 dark:text-white'
          }`}>
            NAIYA
          </span>
          {isNigeriaDay && (
            <span className="text-xs hidden lg:inline-flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-full text-white font-medium">
              🇳🇬 Oct 1
            </span>
          )}
        </div>
      </div>

      {/* Center: Search Box */}
      {(user?.role === 'staff' || user?.role === 'team_lead') && (
        <div className="flex-1 max-w-xl mx-2 md:mx-4">
          <div className="relative group">
            <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
              isNigeriaDay ? 'text-emerald-300' : 'text-surface-400 group-focus-within:text-brand-500'
            }`}>
              <Icons.Search size={15} />
            </div>
            <input 
              ref={searchInputRef}
              id="guide-search-bar"
              type="text" 
              placeholder="Search tickets... (Press / to focus)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
              className={`w-full border rounded-lg py-1.5 pl-8 pr-12 text-xs md:text-sm transition-all outline-none h-8 leading-tight ${
                isNigeriaDay
                  ? 'bg-emerald-900/60 text-white placeholder-emerald-300/70 border-emerald-600/50 focus:bg-emerald-950 focus:border-white focus:ring-1 focus:ring-white/30'
                  : 'bg-surface-50 dark:bg-dark-card text-surface-800 dark:text-surface-200 border-surface-200 dark:border-dark-border placeholder-surface-400 focus:bg-surface-0 dark:focus:bg-dark-bg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10'
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 p-0.5 rounded transition-colors"
                  title="Clear search (Esc)"
                  aria-label="Clear search"
                >
                  <Icons.Close size={13} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-2xs font-mono rounded border border-surface-200 dark:border-dark-border bg-surface-100 dark:bg-dark-surface text-surface-400">
                  /
                </kbd>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right: User Profile & Actions */}
      <div className="flex items-center gap-1 md:gap-1.5 w-auto justify-end ml-auto">
        {(user?.role !== 'staff' && user?.role !== 'team_lead') && (
          <>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-ticket-history'))} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium relative ${
                isNigeriaDay 
                  ? 'hover:bg-white/10 text-white' 
                  : 'hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300'
              }`} 
              title="Ticket History"
            >
              <Icons.Ticket size={16} />
              <span className="hidden sm:inline">History</span>
              {tickets.filter(t => t.createdByEmail === user?.email && t.status !== 'Closed').length > 0 && (
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span>
              )}
            </button>

            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-agent-guide'))} 
              className={`p-1.5 rounded-lg transition-colors ${
                isNigeriaDay 
                  ? 'hover:bg-white/10 text-white' 
                  : 'hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300'
              }`} 
              title="View Guide"
              aria-label="View Guide"
            >
              <Icons.Info size={16} />
            </button>
          </>
        )}

        <button 
          onClick={toggleTheme} 
          className={`p-1.5 rounded-lg transition-colors ${
            isNigeriaDay 
              ? 'hover:bg-white/10 text-white' 
              : 'hover:bg-surface-100 dark:hover:bg-dark-hover text-surface-600 dark:text-surface-300'
          }`} 
          title="Toggle Theme"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
        </button>
        
        <div className="relative ml-1" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2 p-1 rounded-lg transition-colors focus:outline-none ${
              isNigeriaDay 
                ? 'hover:bg-white/10' 
                : 'hover:bg-surface-100 dark:hover:bg-dark-hover'
            }`}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="text-right hidden md:block mr-1">
              <div className={`text-xs font-semibold leading-none ${isNigeriaDay ? 'text-white' : 'text-surface-800 dark:text-surface-200'}`}>{user?.name}</div>
              <div className={`text-2xs leading-none mt-1 capitalize ${isNigeriaDay ? 'text-emerald-200' : 'text-surface-400'}`}>
                {user?.role === 'team_lead' ? 'Team Lead' : user?.role === 'staff' ? (user?.isRoot || user?.email?.toLowerCase() === 'itstaff' ? 'Root Admin' : 'IT Staff') : user?.role?.replace('_', ' ') || 'Agent'}
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-xs font-bold relative overflow-hidden ring-2 ring-brand-500/10">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span>{user?.name?.charAt(0) || 'U'}</span>
              )}
              <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-surface-0 rounded-full"></div>
            </div>
          </button>
          
          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface-0 dark:bg-dark-card rounded-xl shadow-modal border border-surface-200 dark:border-dark-border py-1.5 animate-scale-in origin-top-right z-50">
              <div className="px-4 py-2 border-b border-surface-100 dark:border-dark-border mb-1 md:hidden">
                <div className="font-semibold text-surface-900 dark:text-white text-sm">{user?.name}</div>
                <div className="text-xs text-surface-400 truncate">{user?.email}</div>
              </div>

              <div className="px-3 py-1.5 text-2xs font-semibold text-surface-400 uppercase tracking-wider hidden md:block">
                Account
              </div>

              <button 
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }} 
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 transition-colors rounded-md mx-1 max-w-[calc(100%-8px)]"
              >
                <Icons.Logout size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
