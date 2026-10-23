
import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { useTickets } from '../../contexts/TicketContext';
import { useAuth } from '../../contexts/AuthContext';
import { updateStaffAccount } from '../../services/storageService';

interface FolderPaneProps {
  closeMobileMenu?: () => void;
  onNewTicket?: () => void;
}

export const FolderPane: React.FC<FolderPaneProps> = ({ closeMobileMenu, onNewTicket }) => {
  const { activeFolder, setActiveFolder, tickets, categories } = useTickets();
  const { user, setUser } = useAuth();
  const [showSpecialization, setShowSpecialization] = useState(false);

  const isRoot = !!user?.isRoot || user?.email?.toLowerCase() === 'itstaff';
  const isStaffMember = user?.role === 'staff' || user?.role === 'team_lead';

  const getCount = (folder: string) => {
    let visibleTickets = tickets; 
    
    // Base filter for TL
    if (user?.role === 'team_lead') {
        visibleTickets = tickets.filter(t => t.teamLeadId === user.managedTeamId && !t.isEscalated);
    }

    switch (folder) {
      case 'Inbox': 
        return visibleTickets.filter(t => t.status !== 'Closed').length;
      case 'Unread': 
        return visibleTickets.filter(t => {
            const isStaff = user?.role === 'staff' || user?.role === 'team_lead';
            const isStaffReply = t.lastMessageRole === 'staff' || t.lastMessageRole === 'team_lead';
            const isUnread = isStaff ? (!t.isReadByStaff && !isStaffReply) : !t.readBy?.includes(user?.email || '');
            return t.status !== 'Closed' && isUnread;
        }).length;
      case 'Read':
         return visibleTickets.filter(t => {
            const isStaff = user?.role === 'staff' || user?.role === 'team_lead';
            const isStaffReply = t.lastMessageRole === 'staff' || t.lastMessageRole === 'team_lead';
            const isUnread = isStaff ? (!t.isReadByStaff && !isStaffReply) : !t.readBy?.includes(user?.email || '');
            return t.status !== 'Closed' && !isUnread;
         }).length;
      case 'Pinned':
          return visibleTickets.filter(t => t.isPinned).length;
      case 'Assigned to me': 
        return visibleTickets.filter(t => t.assignedToEmail === user?.email && t.status !== 'Closed').length;
      case 'Closed': 
        return visibleTickets.filter(t => t.status === 'Closed').length;
      default: return 0;
    }
  };

  const handleSpecializationToggle = async (cat: string) => {
    if (!user) return;
    const current = user.specializedCategories || [];
    const next = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
    
    const updatedUser = { ...user, specializedCategories: next };
    setUser(updatedUser);
    localStorage.setItem('app_user', JSON.stringify(updatedUser));
    
    if (user.role === 'staff') {
      try {
        await updateStaffAccount(user.email, { specializedCategories: next });
      } catch (e) {
        console.error("Failed to save specialization", e);
      }
    }
  };

  const NavItem = ({ name, icon: Icon }: { name: string; icon: any }) => {
    const isActive = activeFolder === name;
    const count = getCount(name);
    
    return (
      <button
        onClick={() => {
            setActiveFolder(name);
            if (closeMobileMenu) closeMobileMenu();
        }}
        className={`w-full flex items-center justify-between px-4 py-2 text-[14px] transition-colors relative group ${
          isActive 
            ? 'bg-blue-100/50 dark:bg-white/10 text-brand-700 dark:text-brand-300 font-semibold' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
        }`}
      >
        {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-600"></div>}
        <div className="flex items-center gap-3">
          <Icon size={18} className={isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-500'} strokeWidth={1.5} />
          <span className="truncate">{name}</span>
        </div>
        {name !== 'Analytics' && name !== 'Settings' && count > 0 && (
          <span className={`text-xs font-medium ${
            isActive ? 'text-brand-700 dark:text-brand-300' : 'text-gray-500'
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full bg-white md:bg-gray-50 dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border flex flex-col h-full select-none">
      <div className="p-3 pb-2">
        <button 
           onClick={() => {
               if (onNewTicket) {
                   onNewTicket();
               } else {
                   setActiveFolder('New');
               }
               if (closeMobileMenu) closeMobileMenu();
           }}
           className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-[4px] py-2 text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
        >
          <Icons.Plus size={18} /> New Ticket
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto mt-2 pb-4">
        <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between group cursor-pointer">
          Favorites
        </div>
        <NavItem name="Inbox" icon={Icons.Inbox} />
        <NavItem name="Pinned" icon={Icons.Pin} />
        <NavItem name="Assigned to me" icon={Icons.User} />

        <div className="mt-4 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
           Status
        </div>
        <NavItem name="Unread" icon={Icons.Unread} />
        <NavItem name="Read" icon={Icons.Read} />
        <NavItem name="Closed" icon={Icons.Closed} />
        
        {isStaffMember && (
          <>
            <div className="my-4 border-t border-gray-200 dark:border-dark-border mx-4"></div>
            {isRoot && <NavItem name="Analytics" icon={Icons.Dashboard} />}
            <NavItem name="Settings" icon={Icons.Settings} />
          </>
        )}

        {isStaffMember && (
          <div className="mt-4">
            <button 
              onClick={() => setShowSpecialization(!showSpecialization)}
              className="w-full px-4 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <span>Specializations</span>
              <Icons.More size={14} className={`transition-transform duration-200 ${showSpecialization ? 'rotate-90' : ''}`} />
            </button>
            {showSpecialization && (
              <div className="bg-white dark:bg-black/20 py-2 animate-fade-in">
                {categories.map(cat => {
                  const isSelected = user.specializedCategories?.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => handleSpecializationToggle(cat)}
                      className={`w-full text-left text-sm py-2 px-6 flex items-center gap-2 transition-all ${
                        isSelected 
                          ? 'bg-brand-50 text-brand-700 font-bold border-l-4 border-brand-600 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-500' 
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-l-4 border-transparent'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isSelected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-300 dark:bg-white/10 dark:border-gray-500'
                      }`}>
                          {isSelected && <Icons.Check size={10} strokeWidth={4} />}
                      </div>
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
                {categories.length === 0 && <span className="block px-6 text-xs italic text-gray-400">Loading categories...</span>}
              </div>
            )}
          </div>
        )}
      </nav>
      
      <div className="p-3 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface/50">
          <div className="text-[10px] text-gray-400 text-center font-medium">
             Na'iya Support System &copy; 2026
          </div>
      </div>
    </div>
  );
};
