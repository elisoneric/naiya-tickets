import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getTicketsRaw, getGeneralSettings, getTicketDetails, searchTicketsRaw } from '../services/storageService';
import { playNotificationSound, isSoundMuted, toggleSoundMuted } from '../services/soundService';
import { Ticket, Shortcut, TriageCategory, Macro, Message } from '../types';
import { useAuth } from './AuthContext';

interface TicketContextType {
  tickets: Ticket[];
  searchResults: Ticket[] | null;
  categories: string[];
  shortcuts: Shortcut[];
  macros: Macro[];
  triageCategories: TriageCategory[];
  loading: boolean;
  isSearching: boolean;
  loadingDetails: boolean;
  activeTicketId: string | null;
  setActiveTicketId: (id: string | null) => void;
  activeTicket: Ticket | null;
  getTicket: (id: string) => Ticket | undefined;
  activeFolder: string;
  setActiveFolder: (folder: string) => void;
  payTargetQuery: string;
  setPayTargetQuery: (query: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  serverCounts: Record<string, number> | null;
  refreshTickets: () => void;
  loadMoreTickets: () => Promise<void>;
  hasMore: boolean;
  updateCategoriesList: () => void;
  viewedTickets: Set<string>;
  updateLocalTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  soundMuted: boolean;
  toggleSound: () => boolean;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

export const TicketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [triageCategories, setTriageCategories] = useState<TriageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [soundMutedState, setSoundMutedState] = useState(() => isSoundMuted());

  const toggleSound = useCallback(() => {
    const next = toggleSoundMuted();
    setSoundMutedState(next);
    return next;
  }, []);

  const [activeFolder, setActiveFolder] = useState(() => {
     const path = window.location.pathname;
     if (path === '/access') return 'Requests';
     if (path === '/settings') return 'Settings';
     if (path === '/analytics') return 'Analytics';
     if (path === '/agents') return 'Agents';
     if (path === '/pay') return 'Pay';
     return 'Inbox';
  });

  // Sync folder changes to URL
  useEffect(() => {
     const currentPath = window.location.pathname;
     let newPath = '/tickets';
     if (activeFolder === 'Requests') newPath = '/access';
     if (activeFolder === 'Settings') newPath = '/settings';
     if (activeFolder === 'Analytics') newPath = '/analytics';
     if (activeFolder === 'Agents') newPath = '/agents';
     if (activeFolder === 'Pay') newPath = '/pay';

     if (currentPath !== newPath) {
         window.history.pushState({}, '', newPath);
     }
  }, [activeFolder]);

  const [payTargetQuery, setPayTargetQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [serverSearchResults, setServerSearchResults] = useState<Ticket[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [viewedTickets, setViewedTickets] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  // In-memory Master Cache of loaded tickets (preserves active ticket even if it leaves current folder list)
  const ticketCacheRef = useRef<Map<string, Ticket>>(new Map());

  // Optimistic Overrides (Locks local changes from being overwritten by stale polls for 12 seconds)
  const optimisticOverridesRef = useRef<Map<string, { updates: Partial<Ticket>; expiresAt: number }>>(new Map());

  // Polling Interval Ref
  const intervalRef = useRef<number | null>(null);
  const liveMessagePollRef = useRef<number | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverCounts, setServerCounts] = useState<Record<string, number> | null>(null);
  const prevUnreadCountRef = useRef<number | null>(null);
  const knownTicketIdsRef = useRef<Set<string>>(new Set());

  const activeFolderRef = useRef(activeFolder);
  const selectedCategoryRef = useRef(selectedCategory);
  const selectedRoleRef = useRef(selectedRole);
  const activeTicketIdRef = useRef(activeTicketId);
  
  useEffect(() => {
     activeFolderRef.current = activeFolder;
     selectedCategoryRef.current = selectedCategory;
     selectedRoleRef.current = selectedRole;
     activeTicketIdRef.current = activeTicketId;
  }, [activeFolder, selectedCategory, selectedRole, activeTicketId]);

  // 1. INSTANT LOCAL SEARCH (0ms Latency against loaded tickets & master cache)
  const localMatches = useMemo<Ticket[] | null>(() => {
      const q = searchQuery.trim().replace(/^#/, '').toLowerCase();
      if (!q) return null;

      const candidateMap = new Map<string, Ticket>();
      tickets.forEach(t => candidateMap.set(t.id, t));
      ticketCacheRef.current.forEach((t, id) => {
          if (!candidateMap.has(id)) candidateMap.set(id, t);
      });

      const matched = Array.from(candidateMap.values()).filter(t => {
          const idMatch = t.id?.toLowerCase().includes(q);
          const numMatch = t.ticketNumber?.toLowerCase().includes(q);
          const titleMatch = t.title?.toLowerCase().includes(q);
          const emailMatch = t.createdByEmail?.toLowerCase().includes(q);
          const nameMatch = t.createdByName?.toLowerCase().includes(q);
          const descMatch = t.description?.toLowerCase().includes(q);
          const catMatch = t.category?.toLowerCase().includes(q);
          const projMatch = t.project?.toLowerCase().includes(q);
          const previewMatch = t.lastMessagePreview?.toLowerCase().includes(q);
          return idMatch || numMatch || titleMatch || emailMatch || nameMatch || descMatch || catMatch || projMatch || previewMatch;
      });

      return matched;
  }, [searchQuery, tickets]);

  // 2. SERVER-SIDE SEARCH EFFECT (Asynchronously queries full database for archived / historical tickets)
  useEffect(() => {
      if (!searchQuery.trim()) {
          setServerSearchResults(null);
          setIsSearching(false);
          return;
      }
      
      setIsSearching(true);
      const timer = setTimeout(async () => {
          try {
              const { tickets: results } = await searchTicketsRaw(searchQuery);
              // Merge cache details if loaded
              const enriched = results.map(r => {
                  const cached = ticketCacheRef.current.get(r.id);
                  if (cached && cached.detailsLoaded) {
                      return { ...r, ...cached };
                  }
                  return r;
              });
              setServerSearchResults(enriched);
          } catch (e) {
              console.error("Search failed", e);
              setServerSearchResults([]);
          } finally {
              setIsSearching(false);
          }
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. UNIFIED DEDUPLICATED SEARCH RESULTS (Combines 0ms local results with server hits)
  const searchResults = useMemo<Ticket[] | null>(() => {
      const q = searchQuery.trim().replace(/^#/, '').toLowerCase();
      if (!q) return null;

      const unifiedMap = new Map<string, Ticket>();

      // Put local matches first
      (localMatches || []).forEach(t => unifiedMap.set(t.id, t));

      // Merge server results
      (serverSearchResults || []).forEach(t => {
          if (!unifiedMap.has(t.id)) {
              const cached = ticketCacheRef.current.get(t.id);
              unifiedMap.set(t.id, cached ? { ...t, ...cached } : t);
          }
      });

      const list = Array.from(unifiedMap.values());

      // Rank exact ID / ticketNumber matches first, followed by prefix matches, then recent updates
      return list.sort((a, b) => {
          const aNum = (a.ticketNumber || '').toLowerCase();
          const bNum = (b.ticketNumber || '').toLowerCase();
          const aId = (a.id || '').toLowerCase();
          const bId = (b.id || '').toLowerCase();

          const aExact = aNum === q || aId === q || aNum.replace(/^tkt-/, '') === q;
          const bExact = bNum === q || bId === q || bNum.replace(/^tkt-/, '') === q;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          const aPrefix = aNum.startsWith(q) || aId.startsWith(q);
          const bPrefix = bNum.startsWith(q) || bId.startsWith(q);
          if (aPrefix && !bPrefix) return -1;
          if (!aPrefix && bPrefix) return 1;

          const timeA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt as any).getTime();
          const timeB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt as any).getTime();
          return timeB - timeA;
      });
  }, [searchQuery, localMatches, serverSearchResults]);

  const updateLocalTicket = useCallback((ticketId: string, updates: Partial<Ticket>) => {
      // Record optimistic lock for 12 seconds
      const now = Date.now();
      const existing = optimisticOverridesRef.current.get(ticketId)?.updates || {};
      optimisticOverridesRef.current.set(ticketId, {
          updates: { ...existing, ...updates },
          expiresAt: now + 12000
      });

      // Update cache
      const cached = ticketCacheRef.current.get(ticketId);
      if (cached) {
          ticketCacheRef.current.set(ticketId, {
              ...cached,
              ...updates,
              updatedAt: updates.updatedAt || new Date()
          });
      }

      // Update tickets in state
      setTickets(prev => prev.map(t => {
          if (t.id === ticketId) {
              const updated = {
                  ...t,
                  ...updates,
                  updatedAt: updates.updatedAt || new Date()
              };
              ticketCacheRef.current.set(ticketId, updated);
              return updated;
          }
          return t;
      }));

      // Also update search results if active
      setServerSearchResults(prev => {
          if (!prev) return null;
          return prev.map(t => t.id === ticketId ? { ...t, ...updates, updatedAt: updates.updatedAt || new Date() } : t);
      });
  }, []);

  // Universal Ticket Resolution by ID or Ticket Number
  const getTicket = useCallback((id: string): Ticket | undefined => {
      if (!id) return undefined;
      const cleanId = id.trim().replace(/^#/, '').toLowerCase();

      // Check active state
      let found = tickets.find(t => t.id === id || t.id.toLowerCase() === cleanId);
      if (found) return found;

      found = tickets.find(t => t.ticketNumber === id || t.ticketNumber?.toLowerCase() === cleanId || t.ticketNumber?.toLowerCase().replace(/^#/, '') === cleanId);
      if (found) return found;

      // Check search results
      if (searchResults) {
          found = searchResults.find(t => t.id === id || t.id.toLowerCase() === cleanId || t.ticketNumber === id || t.ticketNumber?.toLowerCase() === cleanId);
          if (found) return found;
      }

      // Check master cache
      found = ticketCacheRef.current.get(id);
      if (found) return found;

      for (const t of ticketCacheRef.current.values()) {
          if (t.id.toLowerCase() === cleanId || t.ticketNumber?.toLowerCase() === cleanId || t.ticketNumber?.toLowerCase().replace(/^#/, '') === cleanId) {
              return t;
          }
      }

      return undefined;
  }, [tickets, searchResults]);

  const activeTicket = activeTicketId ? getTicket(activeTicketId) || null : null;

  // Unconstrained Full Ticket Loading & Delta Sync Engine
  const fetchAll = useCallback(async () => {
      try {
          const since = lastFetchTimeRef.current;
          const isAgent = user?.role === 'agent';
          const createdByEmail = isAgent ? user?.email : undefined;
          
          // For staff/leads, load all tickets (limit: 10000) with folder 'All' so in-memory tabs are 100% complete
          const limit = 10000;
          const folder = isAgent ? activeFolderRef.current : 'All';
          const category = selectedCategoryRef.current;
          const role = selectedRoleRef.current;
          
          const { tickets: data, serverTime, counts } = await getTicketsRaw(since, limit, undefined, createdByEmail, folder, category, role);
          
          lastFetchTimeRef.current = serverTime;
          if (counts) {
              setServerCounts(counts);

              // Sound chime check for staff when unread tickets increase
              if (user && (user.role === 'staff' || user.role === 'team_lead')) {
                  if (prevUnreadCountRef.current !== null && counts.unread > prevUnreadCountRef.current) {
                      playNotificationSound();
                  }
                  prevUnreadCountRef.current = counts.unread;
              }
          }

          setHasMore(false); // All available headers loaded into memory

          // Clean up expired optimistic overrides
          const now = Date.now();
          optimisticOverridesRef.current.forEach((val, key) => {
              if (now >= val.expiresAt) {
                  optimisticOverridesRef.current.delete(key);
              }
          });

          // Helper to apply optimistic lock and preserve cached details
          const processIncomingTicket = (newItem: Ticket, existing?: Ticket): Ticket => {
              let item = { ...newItem };

              // Check if we have cached details
              const cached = existing || ticketCacheRef.current.get(item.id);
              if (cached && (cached.detailsLoaded || (cached.messages && cached.messages.length > 0))) {
                  const isActive = item.id === activeTicketIdRef.current;
                  const newTime = item.updatedAt instanceof Date ? item.updatedAt.getTime() : new Date(item.updatedAt as any).getTime();
                  const existingTime = cached.updatedAt instanceof Date ? cached.updatedAt.getTime() : new Date(cached.updatedAt as any).getTime();

                  // Keep details loaded for the active ticket so fetchAll doesn't race loadDetails or drop active messages
                  const shouldInvalidate = !isActive && (newTime > existingTime);

                  item = {
                      ...item,
                      messages: cached.messages || [],
                      attachments: cached.attachments || [],
                      description: cached.description || item.description,
                      detailsLoaded: shouldInvalidate ? false : true
                  };
              }

              // Apply active optimistic override if locked
              const override = optimisticOverridesRef.current.get(item.id);
              if (override && now < override.expiresAt) {
                  item = { ...item, ...override.updates };
              }

              // Store in master cache
              ticketCacheRef.current.set(item.id, item);
              knownTicketIdsRef.current.add(item.id);
              return item;
          };

          setTickets(prev => {
              if (!since) {
                  // Full refresh / initial load: populate all ticket headers
                  const prevMap = new Map(prev.map(t => [t.id, t]));
                  return data.map(newItem => processIncomingTicket(newItem, prevMap.get(newItem.id)));
              }

              if (data.length === 0) return prev;
              if (prev.length === 0) return data.map(newItem => processIncomingTicket(newItem));
              
              const newTicketsMap = new Map(data.map(t => [t.id, t]));
              
              // Delta update: Update existing tickets, add new ones
              const merged = prev.map(existing => {
                  const newItem = newTicketsMap.get(existing.id);
                  if (!newItem) {
                      // Apply optimistic override if any
                      const override = optimisticOverridesRef.current.get(existing.id);
                      if (override && now < override.expiresAt) {
                          const updated = { ...existing, ...override.updates };
                          ticketCacheRef.current.set(existing.id, updated);
                          return updated;
                      }
                      return existing;
                  }
                  
                  newTicketsMap.delete(existing.id); // Mark as processed
                  return processIncomingTicket(newItem, existing);
              });
              
              // Add remaining new tickets
              const remainingNew = Array.from(newTicketsMap.values()).map(newItem => processIncomingTicket(newItem));
              
              return [...merged, ...remainingNew].sort((a, b) => {
                  const timeA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt as any).getTime();
                  const timeB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt as any).getTime();
                  return timeB - timeA;
              });
          });
      } catch (e) {
          console.error("Failed to fetch tickets", e);
      } finally {
          setLoading(false);
      }
  }, [user?.role, user?.email]);

  const refreshTickets = useCallback(() => {
    // Force a complete refresh
    setLoading(true);
    lastFetchTimeRef.current = 0;
    fetchAll();
  }, [fetchAll]);

  const loadMoreTickets = useCallback(async () => {
    // Since full list is loaded on start, loadMore is a no-op fallback
    setHasMore(false);
  }, []);

  const updateCategoriesList = useCallback(async () => {
    try {
        const settings = await getGeneralSettings();
        setCategories(settings.categories || []);
        setShortcuts(settings.shortcuts || []);
        setMacros(settings.macros || []);
        setTriageCategories(settings.triageCategories || []);
    } catch (e) {
        console.error("Failed to load categories", e);
    }
  }, []);

  useEffect(() => {
    updateCategoriesList();
  }, [updateCategoriesList]);

  const prevActiveTicketIdRef = useRef<string | null>(null);

  // Load details when active ID changes or when ticket is invalidated (detailsLoaded: false)
  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
        if (activeTicketId && user) {
            const ticket = getTicket(activeTicketId);
            
            // Only fetch full details if not loaded
            if (!ticket || !ticket.detailsLoaded) {
                const isSwitching = prevActiveTicketIdRef.current !== activeTicketId;
                if (isSwitching) {
                    setLoadingDetails(true);
                }
                
                const details = await getTicketDetails(activeTicketId);
                if (isMounted && details) {
                    const cached = ticketCacheRef.current.get(activeTicketId) || ticket || { id: activeTicketId } as Ticket;
                    
                    // Non-destructive message merge: preserve ANY message already in client cache that hasn't hit server yet
                    const serverMsgs = details.messages || [];
                    const cachedMsgs = cached.messages || [];
                    const mergedMessages = [...serverMsgs];
                    for (const localMsg of cachedMsgs) {
                        if (!localMsg || !localMsg.id) continue;
                        const exists = serverMsgs.some(sm => 
                            sm.id === localMsg.id || 
                            (sm.senderId === localMsg.senderId && (sm.content || '').trim() === (localMsg.content || '').trim())
                        );
                        if (!exists) {
                            mergedMessages.push(localMsg);
                        }
                    }

                    mergedMessages.sort((a, b) => {
                        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return timeA - timeB;
                    });

                    const merged = { ...cached, ...details, messages: mergedMessages, detailsLoaded: true };
                    ticketCacheRef.current.set(activeTicketId, merged);

                    setTickets(prev => prev.map(t => t.id === activeTicketId ? merged : t));
                }
                
                if (isMounted && isSwitching) {
                    setLoadingDetails(false);
                }
            } else if (isMounted) {
                setLoadingDetails(false);
            }
            
            if (isMounted) {
                prevActiveTicketIdRef.current = activeTicketId;
                setViewedTickets(prev => {
                    const next = new Set(prev);
                    next.add(activeTicketId);
                    return next;
                });
            }
            
        } else if (isMounted) {
            prevActiveTicketIdRef.current = activeTicketId;
        }
    };
    loadDetails();
    return () => {
        isMounted = false;
    };
  }, [activeTicketId, user, getTicket]);

  // LIVE PER-THREAD MESSAGE POLLING (Real-time update for open message threads)
  useEffect(() => {
      if (!activeTicketId || !user) {
          if (liveMessagePollRef.current) clearInterval(liveMessagePollRef.current);
          return;
      }

      const pollOpenThread = async () => {
          if (document.hidden) return;

          // Skip if an optimistic message send is still in-flight (prevents flash)
          const override = optimisticOverridesRef.current.get(activeTicketId);
          if (override && Date.now() < override.expiresAt && override.updates.messages) return;

          // Skip if global poll ran in the last 2 seconds (avoid redundant fetches)
          if (Date.now() - lastFetchTimeRef.current < 2000) return;

          try {
              // Step 1: Lightweight check — fetches metadata & count
              const lwRes = await getTicketDetails(activeTicketId, true);
              if (!lwRes) return;

              const currentTicket = getTicket(activeTicketId);
              const currentMessages = currentTicket?.messages || [];
              const lastLocalMsg = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;

              const serverUpdatedAt = lwRes.updatedAt ? new Date(lwRes.updatedAt).getTime() : 0;
              const localUpdatedAt = currentTicket?.updatedAt instanceof Date
                  ? currentTicket.updatedAt.getTime()
                  : new Date(currentTicket?.updatedAt as any).getTime();

              const countChanged = typeof (lwRes as any).messageCount === 'number' && (lwRes as any).messageCount !== currentMessages.length;
              const lastIdChanged = Boolean((lwRes as any).lastMessageId && lastLocalMsg?.id && (lwRes as any).lastMessageId !== lastLocalMsg.id);
              const previewChanged = Boolean(lwRes.lastMessagePreview && currentTicket?.lastMessagePreview && lwRes.lastMessagePreview !== currentTicket.lastMessagePreview);
              const roleChanged = Boolean(lwRes.lastMessageRole && currentTicket?.lastMessageRole && lwRes.lastMessageRole !== currentTicket.lastMessageRole);
              const timeChanged = serverUpdatedAt > localUpdatedAt;

              // Only fetch full details if server indicates changes across any signal
              if (!countChanged && !lastIdChanged && !previewChanged && !roleChanged && !timeChanged) return;

              // Step 2: Server has newer data — fetch full details
              const details = await getTicketDetails(activeTicketId, false);
              if (!details) return;

              const newMessages: Message[] = details.messages || [];

              // Check if messages changed (new message arrived or count differs)
              if (newMessages.length !== currentMessages.length || (newMessages.length > 0 && currentMessages.length > 0 && newMessages[newMessages.length - 1].id !== currentMessages[currentMessages.length - 1].id)) {
                  // Final guard: don't overwrite if optimistic override just became active
                  const latestOverride = optimisticOverridesRef.current.get(activeTicketId);
                  if (latestOverride && Date.now() < latestOverride.expiresAt && latestOverride.updates.messages) return;

                  // Non-destructive message merge: preserve any client messages not yet returned by server
                  const mergedMessages = [...newMessages];
                  for (const localMsg of currentMessages) {
                      if (!localMsg || !localMsg.id) continue;
                      const exists = newMessages.some(sm => 
                          sm.id === localMsg.id || 
                          (sm.senderId === localMsg.senderId && (sm.content || '').trim() === (localMsg.content || '').trim())
                      );
                      if (!exists) {
                          mergedMessages.push(localMsg);
                      }
                  }

                  mergedMessages.sort((a, b) => {
                      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                      return timeA - timeB;
                  });

                  const updatedTicket: Ticket = {
                      ...(currentTicket || { id: activeTicketId } as Ticket),
                      messages: mergedMessages,
                      attachments: details.attachments || currentTicket?.attachments || [],
                      description: details.description || currentTicket?.description || '',
                      detailsLoaded: true
                  };

                  ticketCacheRef.current.set(activeTicketId, updatedTicket);
                  setTickets(prev => prev.map(t => t.id === activeTicketId ? updatedTicket : t));
              }
          } catch (e) {
              console.debug("Silent message poll skipped", e);
          }
      };

      // Poll open ticket thread every 5 seconds (was 3.5s)
      liveMessagePollRef.current = window.setInterval(pollOpenThread, 5000);

      return () => {
          if (liveMessagePollRef.current) clearInterval(liveMessagePollRef.current);
      };
  }, [activeTicketId, user, getTicket]);


  // Global Polling Logic & Network Recovery (Adaptive 3.5s active, 60s idle)
  useEffect(() => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      lastFetchTimeRef.current = 0;
      return;
    }

    // Always ensure fresh data when user identity is established
    lastFetchTimeRef.current = 0;
    setLoading(true);

    // Initial Fetch
    fetchAll();

    // Start Polling with Adaptive Backoff (8s active, 120s idle)
    const tick = () => {
        fetchAll();
        const nextInterval = document.hidden ? 120000 : 8000;
        intervalRef.current = window.setTimeout(tick, nextInterval);
    };
    intervalRef.current = window.setTimeout(tick, 8000);

    const handleNetworkRecovery = () => {
        lastFetchTimeRef.current = 0;
        fetchAll();
    };
    
    const handleVisibilityChange = () => {
        if (!document.hidden && intervalRef.current) {
            clearTimeout(intervalRef.current);
            tick();
        }
    };
    
    window.addEventListener('network-recovered', handleNetworkRecovery);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        if (intervalRef.current) clearTimeout(intervalRef.current);
        window.removeEventListener('network-recovered', handleNetworkRecovery);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchAll]);

  return (
    <TicketContext.Provider value={{
      tickets,
      searchResults,
      categories,
      shortcuts,
      macros,
      triageCategories,
      loading,
      isSearching,
      loadingDetails,
      activeTicketId,
      setActiveTicketId,
      activeTicket,
      getTicket,
      activeFolder,
      setActiveFolder,
      payTargetQuery,
      setPayTargetQuery,
      searchQuery,
      setSearchQuery,
      selectedCategory,
      setSelectedCategory,
      selectedRole,
      setSelectedRole,
      serverCounts,
      refreshTickets,
      loadMoreTickets,
      hasMore,
      updateCategoriesList,
      viewedTickets,
      updateLocalTicket,
      soundMuted: soundMutedState,
      toggleSound
    }}>
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => {
  const context = useContext(TicketContext);
  if (!context) throw new Error('useTickets must be used within TicketProvider');
  return context;
};
