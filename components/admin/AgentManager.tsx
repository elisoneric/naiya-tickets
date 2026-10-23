import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../common/Icons';
import * as storage from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { AgentRecord } from '../../types';
import { sendPasswordSetEmail } from '../../services/emailService';
import { SystemBroadcastModal } from './SystemBroadcastModal';

const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'live.com', 'msn.com'];

export const AgentManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [bulkTlId, setBulkTlId] = useState('');
  const [bulkRole, setBulkRole] = useState<'agent' | 'team_lead' | 'referee' | 'moniepoint' | ''>('');
  
  const [newEmail, setNewEmail] = useState('');
  const [newAltEmail, setNewAltEmail] = useState('');
  const [newTlId, setNewTlId] = useState('');
  const [newRole, setNewRole] = useState<'agent' | 'team_lead' | 'referee' | 'moniepoint'>('agent');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Bulk Email Text File Upload Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [targetRole, setTargetRole] = useState<'agent' | 'team_lead' | 'referee' | 'moniepoint'>('agent');
  const [targetTlId, setTargetTlId] = useState('');
  const [suppressWelcome, setSuppressWelcome] = useState(true);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ processed: number; total: number } | null>(null);
  
  const [passwordResetAgent, setPasswordResetAgent] = useState<string | null>(null);
  const [passwordResetValue, setPasswordResetValue] = useState('');
  
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastRecipients, setBroadcastRecipients] = useState<string[]>([]);

  useEffect(() => { loadAgents(); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBroadcastModal) {
          setShowBroadcastModal(false);
          return;
        }
        if (showEmailModal) {
          setShowEmailModal(false);
          return;
        }
        if (passwordResetAgent) {
          setPasswordResetAgent(null);
          return;
        }
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBroadcastModal, showEmailModal, passwordResetAgent, searchQuery, onClose]);

  const loadAgents = async () => {
    try {
      setAgents(await storage.getAgentListRaw());
    } catch (e) {
      showToast('Failed to load agents from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Parse emails from file or text box in real-time
  const parsedEmails = useMemo(() => {
    const raw = pastedText.trim();
    if (!raw) return [];
    const list = raw.split(/[\r\n,;\s]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@') && e.length > 4 && e.includes('.'));
    return Array.from(new Set(list));
  }, [pastedText]);

  const parsedStats = useMemo(() => {
    let personal = 0;
    let company = 0;
    parsedEmails.forEach(email => {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && FREE_EMAIL_DOMAINS.includes(domain)) personal++;
      else company++;
    });
    return { total: parsedEmails.length, personal, company };
  }, [parsedEmails]);

  const handleFileChange = async (file: File | null) => {
    setBulkFile(file);
    if (!file) return;
    try {
      const text = await file.text();
      setPastedText(text);
    } catch (e) {
      showToast('Failed to read file content', 'error');
    }
  };

  const handleBulkEmailUpload = async () => {
    if (parsedEmails.length === 0) {
      showToast('No valid emails found to upload', 'error');
      return;
    }
    setIsBulkUploading(true);
    setUploadProgress({ processed: 0, total: parsedEmails.length });

    try {
      const result = await storage.bulkUploadAgentEmails(parsedEmails, {
        role: targetRole,
        teamLeadId: targetTlId,
        suppressWelcomeEmail: suppressWelcome,
        onProgress: (processed, total) => {
          setUploadProgress({ processed, total });
        }
      });

      showToast(`Successfully uploaded & restored ${parsedEmails.length} agent emails!`, 'success');
      await loadAgents();
      setShowEmailModal(false);
      setPastedText('');
      setBulkFile(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to upload emails', 'error');
    } finally {
      setIsBulkUploading(false);
      setUploadProgress(null);
    }
  };

  const downloadSampleTxt = () => {
    const txt = "agent1@company.com, agent2@company.com, agent3@company.com\nagent4@company.com\nagent5@company.com";
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_agent_emails.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    let personal = 0;
    let company = 0;
    agents.forEach(a => {
      const domain = a.email.split('@')[1]?.toLowerCase();
      if (domain && FREE_EMAIL_DOMAINS.includes(domain)) {
        personal++;
      } else {
        company++;
      }
    });
    return { total: agents.length, personal, company };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || (a.email.toLowerCase().includes(q) || (a.teamLeadId && a.teamLeadId.toLowerCase().includes(q)) || (a.role && a.role.toLowerCase().includes(q)));
        const matchesRole = roleFilter === 'all' || (roleFilter === 'agent' ? (!a.role || a.role === 'agent') : a.role === roleFilter);
        return matchesSearch && matchesRole;
    });
  }, [agents, searchQuery, roleFilter]);

  const toggleSelectAll = () => {
      setSelectedEmails(selectedEmails.size === filteredAgents.length ? new Set() : new Set(filteredAgents.map(a => a.email)));
  };

  const toggleSelect = (email: string) => {
      const next = new Set(selectedEmails);
      next.has(email) ? next.delete(email) : next.add(email);
      setSelectedEmails(next);
  };

  const handleUpsert = async () => {
    if (!newEmail.trim()) return;
    setIsSaving(true);
    try {
        const emails = newEmail.split(',').map(e => e.trim()).filter(e => e.includes('@'));
        if (emails.length === 0) {
            showToast('No valid emails found', 'error');
            return;
        }
        const updates = emails.map(email => ({ 
            email, 
            teamLeadId: newTlId, 
            role: newRole,
            ...(newAltEmail.trim() ? { altEmail: newAltEmail.trim() } : {})
        }));
        await storage.bulkUpdateAgentAllowlist(updates);
        await loadAgents();
        setNewEmail(''); setNewAltEmail(''); setNewTlId(''); setNewRole('agent');
        showToast(`Agent records updated (${emails.length})`, 'success');
    } catch(e) { showToast('Update failed', 'error'); } 
    finally { setIsSaving(false); }
  };

  const handleCsvUpload = async () => {
      if (!csvFile) return;
      setLoading(true);
      try {
          const text = await csvFile.text();
          const lines = text.split(/\r?\n/).slice(1);
          const data = lines.map(l => {
              const [em, tl, roleStr, altEm] = l.split(',').map(s => s.trim());
              const record: any = { email: em, teamLeadId: tl || '' };
              if (['team_lead', 'referee', 'agent', 'moniepoint'].includes(roleStr)) record.role = roleStr;
              if (altEm && altEm.includes('@')) record.altEmail = altEm;
              return em && em.includes('@') ? record as AgentRecord : null;
          }).filter((item): item is AgentRecord => item !== null);
          if (data.length) {
              await storage.bulkUpdateAgentAllowlist(data);
              await loadAgents();
              setCsvFile(null);
              showToast(`Upserted ${data.length} records`, 'success');
          } else { showToast('No valid records found', 'error'); }
      } catch (e) { showToast('Failed to process CSV', 'error'); } 
      finally { setLoading(false); }
  };

  const downloadSampleCsv = () => {
      const csv = "email,teamLeadId,role,altEmail\nagent1@example.com,TL-123,agent,personal@gmail.com";
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_agents.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleBulkAssign = async () => {
      if (!bulkTlId.trim() && !bulkRole) return;
      setLoading(true);
      try {
          const updates = agents.filter(a => selectedEmails.has(a.email)).map(a => ({ 
              ...a, 
              ...(bulkTlId.trim() ? { teamLeadId: bulkTlId } : {}),
              ...(bulkRole ? { role: bulkRole } : {})
          }));
          await storage.bulkUpdateAgentAllowlist(updates);
          await loadAgents();
          setBulkTlId(''); setBulkRole(''); setSelectedEmails(new Set());
          showToast(`Bulk updated ${updates.length} agents`, 'success');
      } catch (e) { showToast('Bulk update failed', 'error'); } 
      finally { setLoading(false); }
  };

  const handleBulkDelete = async () => {
      if (!confirm(`Delete ${selectedEmails.size} agents?`)) return;
      setLoading(true);
      try {
          await storage.deleteAgents(Array.from(selectedEmails));
          await loadAgents();
          setSelectedEmails(new Set());
          showToast('Agents removed', 'success');
      } catch (e) { showToast('Delete failed', 'error'); } 
      finally { setLoading(false); }
  };

  const handleSetPassword = async (email: string) => {
      if (!passwordResetValue.trim() || passwordResetValue.length < 8) {
          showToast('Password must be at least 8 characters', 'error');
          return;
      }
      setLoading(true);
      try {
          await storage.setAgentPassword(email, passwordResetValue);
          const targetAgent = agents.find(a => a.email.toLowerCase() === email.toLowerCase());
          await sendPasswordSetEmail(email, { 
              isReset: true, 
              tempPassword: passwordResetValue, 
              altEmail: targetAgent?.altEmail 
          });
          showToast(`Password updated and credentials emailed to ${email}`, 'success');
          setPasswordResetAgent(null);
          setPasswordResetValue('');
      } catch (e) { showToast('Failed to update password', 'error'); }
      finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-dark-surface overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b dark:border-dark-border flex justify-between items-center bg-brand-50 dark:bg-dark-surface shrink-0">
          <div className="flex items-center gap-6">
            <h3 className="font-black text-xl flex items-center gap-3 dark:text-white uppercase tracking-tight">
              <Icons.Users size={24} className="text-brand-600" />
              Agent Directory
            </h3>
            <div className="hidden md:flex items-center gap-4 text-xs font-semibold bg-white dark:bg-dark-bg px-4 py-1.5 rounded-full border border-brand-100 dark:border-white/10 shadow-sm">
              <span className="text-gray-600 dark:text-gray-300">Total: <span className="text-brand-600 dark:text-brand-400">{stats.total}</span></span>
              <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-gray-600 dark:text-gray-300">Company: <span className="text-blue-600 dark:text-blue-400">{stats.company}</span></span>
              <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-gray-600 dark:text-gray-300">Personal: <span className="text-orange-600 dark:text-orange-400">{stats.personal}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setBroadcastRecipients([]); setShowBroadcastModal(true); }}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              title="Broadcast email to agent base"
            >
              <Icons.Mail size={16} />
              <span>Broadcast Email</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
              <Icons.Close size={24} />
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-gray-50 dark:bg-dark-bg border-b dark:border-dark-border grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0 items-end">
            
            {/* Column 1: Manual Add (Span 5) */}
            <div className="lg:col-span-5 flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-surface-400 dark:text-dark-textMuted ml-1">Manual Entry / Quick Add</label>
                <div className="flex gap-2">
                    <input 
                        type="text" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && newEmail.includes('@') && !isSaving && handleUpsert()}
                        placeholder="Company Email(s)"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-surface-200 dark:bg-dark-card dark:border-dark-border text-surface-900 dark:text-dark-textPrimary text-sm focus:ring-2 ring-brand-500/20 outline-none"
                    />
                    <input 
                        type="text" value={newAltEmail} onChange={e => setNewAltEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && newEmail.includes('@') && !isSaving && handleUpsert()}
                        placeholder="Alt Email"
                        className="w-28 sm:w-36 px-3 py-2 rounded-lg border border-surface-200 dark:bg-dark-card dark:border-dark-border text-surface-900 dark:text-dark-textPrimary text-sm outline-none"
                    />
                    <input 
                        type="text" value={newTlId} onChange={e => setNewTlId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && newEmail.includes('@') && !isSaving && handleUpsert()}
                        placeholder="TL ID"
                        className="w-20 px-3 py-2 rounded-lg border border-surface-200 dark:bg-dark-card dark:border-dark-border text-surface-900 dark:text-dark-textPrimary text-sm outline-none"
                    />
                    <select 
                        value={newRole} onChange={e => setNewRole(e.target.value as any)}
                        className="w-24 sm:w-28 px-2 py-2 rounded-lg border border-surface-200 dark:bg-dark-card dark:border-dark-border text-surface-900 dark:text-dark-textPrimary text-sm outline-none"
                    >
                        <option value="agent">Agent</option>
                        <option value="team_lead">Lead</option>
                        <option value="referee">Referee</option>
                        <option value="moniepoint">Moniepoint</option>
                    </select>
                    <button onClick={handleUpsert} disabled={isSaving || !newEmail.includes('@')} className="px-4 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-lg font-bold disabled:opacity-50 text-sm transition-all shadow-sm">
                        {isSaving ? <Icons.Refresh size={16} className="animate-spin" /> : 'Add'}
                    </button>
                </div>
            </div>

            {/* Column 2: Search (Span 3) */}
            <div className="lg:col-span-3 flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Filter List</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search agents..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border dark:bg-dark-surface dark:border-dark-border dark:text-white text-sm outline-none"
                        />
                    </div>
                    <select
                        value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                        className="w-28 px-2 py-2 rounded-lg border dark:bg-dark-surface dark:border-dark-border dark:text-white text-sm outline-none"
                    >
                        <option value="all">All</option>
                        <option value="agent">Agent</option>
                        <option value="team_lead">Lead</option>
                        <option value="referee">Referee</option>
                        <option value="moniepoint">Moniepoint</option>
                    </select>
                </div>
            </div>

            {/* Column 3: Bulk Text Upload (Span 4) */}
            <div className="lg:col-span-4 flex flex-col gap-1.5 justify-end">
                <button 
                  onClick={() => setShowEmailModal(true)} 
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Icons.Upload size={14} />
                  Upload .TXT or Paste Emails
                </button>
            </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-dark-surface relative">
            {loading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                    <Icons.Refresh size={32} className="animate-spin text-brand-600" />
                </div>
            )}
            <table className="w-full text-left">
                <thead className="bg-gray-100 dark:bg-black/20 text-gray-500 font-bold text-xs uppercase sticky top-0 z-10">
                    <tr>
                        <th className="p-4 w-12 text-center">
                            <input type="checkbox" checked={filteredAgents.length > 0 && selectedEmails.size === filteredAgents.length} onChange={toggleSelectAll} />
                        </th>
                        <th className="p-4">Agent Identification</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Team Lead ID</th>
                        <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredAgents.map(a => (
                        <tr key={a.email} className={`hover:bg-brand-50/30 dark:hover:bg-white/5 transition-colors ${selectedEmails.has(a.email) ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}>
                            <td className="p-4 text-center"><input type="checkbox" checked={selectedEmails.has(a.email)} onChange={() => toggleSelect(a.email)} /></td>
                            <td className="p-4">
                                <div className="font-bold dark:text-gray-200">{a.email}</div>
                                {a.altEmail && (
                                    <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                        Alt: {a.altEmail}
                                    </div>
                                )}
                            </td>
                            <td className="p-4">
                                <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter ${
                                    a.role === 'team_lead' ? 'bg-blue-100 text-blue-700' : 
                                    a.role === 'referee' ? 'bg-orange-100 text-orange-700' : 
                                    a.role === 'moniepoint' ? 'bg-teal-100 text-teal-700' :
                                    'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300'
                                }`}>
                                    {a.role || 'Agent'}
                                </span>
                            </td>
                            <td className="p-4">
                                {a.teamLeadId ? <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase tracking-tighter">{a.teamLeadId}</span> : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="p-4 text-right pr-6">
                                <div className="flex justify-end gap-2 items-center">
                                    {passwordResetAgent === a.email ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="text" 
                                                value={passwordResetValue} 
                                                onChange={e => setPasswordResetValue(e.target.value)} 
                                                placeholder="New Password" 
                                                className="px-2 py-1 text-xs border rounded outline-none dark:bg-black/50 dark:border-gray-600 dark:text-white"
                                            />
                                            <button onClick={() => handleSetPassword(a.email)} className="text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 p-1 rounded transition-colors"><Icons.Check size={14}/></button>
                                            <button onClick={() => setPasswordResetAgent(null)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1 rounded transition-colors"><Icons.Close size={14}/></button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => { setPasswordResetAgent(a.email); setPasswordResetValue(''); }} 
                                            className="text-xs text-gray-500 hover:text-brand-600 bg-gray-100 dark:bg-white/10 dark:text-gray-300 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 px-2 py-1 rounded transition-colors"
                                        >
                                            Set Password
                                        </button>
                                    )}
                                    <button onClick={() => storage.removeAgentFromAllowlist(a.email).then(loadAgents)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">
                                        <Icons.Closed size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Bulk Action Footer */}
        {selectedEmails.size > 0 && (
            <div className="p-4 bg-brand-600 text-white flex items-center gap-6 animate-slide-in-up">
                <span className="font-black uppercase text-sm tracking-widest">{selectedEmails.size} SELECTED</span>
                <div className="h-6 w-px bg-white/20"></div>
                <div className="flex items-center gap-2 flex-1">
                    <input value={bulkTlId} onChange={e => setBulkTlId(e.target.value)} placeholder="Assign TL ID..." className="bg-white/10 border-white/20 border rounded-lg px-4 py-1.5 text-sm placeholder-white/50 outline-none w-48" />
                    <select 
                        value={bulkRole} onChange={e => setBulkRole(e.target.value as any)}
                        className="bg-white/10 border-white/20 border rounded-lg px-4 py-1.5 text-sm outline-none text-white"
                    >
                        <option value="" className="text-black">No Role Change</option>
                        <option value="agent" className="text-black">Agent</option>
                        <option value="team_lead" className="text-black">Team Lead</option>
                        <option value="referee" className="text-black">Referee</option>
                        <option value="moniepoint" className="text-black">Moniepoint</option>
                    </select>
                    <button onClick={handleBulkAssign} disabled={!bulkTlId.trim() && !bulkRole} className="bg-white text-brand-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-brand-50 disabled:opacity-50">Apply</button>
                    <button 
                      onClick={() => { setBroadcastRecipients(Array.from(selectedEmails)); setShowBroadcastModal(true); }}
                      className="bg-sky-500 hover:bg-sky-600 px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Icons.Mail size={14} />
                      Email Selected ({selectedEmails.size})
                    </button>
                </div>
                <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-lg font-bold text-sm">Delete</button>
            </div>
        )}

        {/* --- SYSTEM BROADCAST MODAL --- */}
        {showBroadcastModal && (
          <SystemBroadcastModal 
            onClose={() => setShowBroadcastModal(false)} 
            initialRecipients={broadcastRecipients} 
          />
        )}

        {/* --- BULK EMAIL TXT FILE UPLOAD MODAL --- */}
        {showEmailModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-[2px] p-0 sm:p-4">
            <div className="bg-surface-0 dark:bg-dark-card border border-surface-200 dark:border-dark-border rounded-none sm:rounded-2xl shadow-modal w-full max-w-3xl overflow-hidden flex flex-col h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] animate-scale-in">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Icons.Upload size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight">Restore Agent Emails</h3>
                    <p className="text-xs text-emerald-100">Upload a .txt or .csv file containing comma-separated or newline-separated emails</p>
                  </div>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white">
                  <Icons.Close size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex flex-col gap-6">
                
                {/* Upload File / Dropzone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">1. Select Email Text File (.txt / .csv)</label>
                    <div className="relative border-2 border-dashed border-emerald-300 dark:border-emerald-700/50 rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-900/10 flex flex-col items-center justify-center text-center gap-2 hover:border-emerald-500 transition-colors overflow-hidden">
                      <Icons.Upload size={32} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {bulkFile ? bulkFile.name : 'Click to select or drag .txt / .csv file'}
                      </span>
                      <input 
                        type="file" 
                        accept=".txt,.csv,.log" 
                        onChange={e => handleFileChange(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                  </div>

                  {/* Sample Downloads & Quick Controls */}
                  <div className="flex flex-col gap-2 justify-between bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border dark:border-dark-border">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Recovery Options</span>
                      <div className="flex items-center gap-2 mt-2">
                        <input 
                          type="checkbox" 
                          id="suppressEmails" 
                          checked={suppressWelcome} 
                          onChange={e => setSuppressWelcome(e.target.checked)} 
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <label htmlFor="suppressEmails" className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                          Suppress Welcome Emails (Recommended for bulk restore)
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-[11px] text-gray-400 font-medium">Need a sample format?</span>
                      <div className="flex gap-2">
                        <button onClick={downloadSampleTxt} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                          <Icons.Download size={12} /> Sample TXT
                        </button>
                        <button onClick={downloadSampleCsv} className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1">
                          <Icons.Download size={12} /> Sample CSV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paste / Direct Input Text Area */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">2. Or Paste Comma-Separated Emails Directly</label>
                    {parsedEmails.length > 0 && (
                      <span className="text-xs font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                        {parsedEmails.length.toLocaleString()} Unique Emails Parsed
                      </span>
                    )}
                  </div>
                  <textarea 
                    rows={6}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="agent1@company.com, agent2@company.com, agent3@company.com..."
                    className="w-full p-3 font-mono text-xs border rounded-xl dark:bg-dark-bg dark:border-dark-border dark:text-white focus:ring-2 ring-emerald-500/20 outline-none"
                  />
                </div>

                {/* Live Parsing Stats Badge */}
                {parsedEmails.length > 0 && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="text-gray-700 dark:text-gray-200">Total Valid: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{parsedStats.total.toLocaleString()}</strong></span>
                      <div className="w-px h-4 bg-emerald-200 dark:bg-emerald-800"></div>
                      <span className="text-gray-700 dark:text-gray-200">Company Domain: <strong className="text-blue-700 dark:text-blue-400 font-bold">{parsedStats.company.toLocaleString()}</strong></span>
                      <div className="w-px h-4 bg-emerald-200 dark:bg-emerald-800"></div>
                      <span className="text-gray-700 dark:text-gray-200">Personal Domain: <strong className="text-orange-700 dark:text-orange-400 font-bold">{parsedStats.personal.toLocaleString()}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select 
                        value={targetRole} 
                        onChange={e => setTargetRole(e.target.value as any)}
                        className="text-xs p-1.5 border rounded-lg dark:bg-dark-surface dark:text-white font-semibold outline-none"
                      >
                        <option value="agent">Role: Agent</option>
                        <option value="team_lead">Role: Team Lead</option>
                        <option value="referee">Role: Referee</option>
                        <option value="moniepoint">Role: Moniepoint</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Batch Progress Bar */}
                {uploadProgress && (
                  <div className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-dark-bg rounded-xl border dark:border-dark-border">
                    <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                      <span>Restoring Agent Database...</span>
                      <span>{uploadProgress.processed.toLocaleString()} / {uploadProgress.total.toLocaleString()} ({Math.round((uploadProgress.processed / uploadProgress.total) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 dark:bg-dark-bg border-t dark:border-dark-border flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setShowEmailModal(false)}
                  disabled={isBulkUploading}
                  className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-100 dark:hover:bg-white/10 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkEmailUpload}
                  disabled={isBulkUploading || parsedEmails.length === 0}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {isBulkUploading ? (
                    <>
                      <Icons.Refresh size={16} className="animate-spin" />
                      Uploading ({uploadProgress?.processed || 0}/{uploadProgress?.total || 0})...
                    </>
                  ) : (
                    <>
                      <Icons.Check size={16} />
                      Restore {parsedEmails.length ? parsedEmails.length.toLocaleString() : ''} Agents to DB
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
  );
};