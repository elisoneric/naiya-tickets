import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Ticket, Message } from '../../types';
import { sendMessage } from '../../services/ticketService';
import { useAuth } from '../../contexts/AuthContext';
import { formatMessageTime, formatMessageDateGroup } from '../../utils/dateUtils';
import { Icons } from '../common/Icons';
import { FormattedMessage } from '../common/FormattedMessage';
import { useToast } from '../../contexts/ToastContext';
import { useTickets } from '../../contexts/TicketContext';

interface UserChatProps {
    ticket: Ticket;
    onBack?: () => void;
    hideHeader?: boolean;
}

export const UserChat: React.FC<UserChatProps> = ({ ticket, onBack, hideHeader }) => {
  const draftKey = `draft_user_${ticket?.id || ''}`;
  const [input, setInput] = useState(() => localStorage.getItem(draftKey) || '');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { showToast } = useToast();
  const { refreshTickets, loadingDetails } = useTickets();

  // Load / save draft
  useEffect(() => {
      localStorage.setItem(draftKey, input);
  }, [input, draftKey]);

  useEffect(() => {
      setLocalMessages([]);
      setInput(localStorage.getItem(draftKey) || '');
  }, [ticket?.id, draftKey]);

  const allMessages = useMemo(() => {
      const raw = [...(ticket?.messages || []), ...localMessages];
      const seenIds = new Set<string>();
      const result: Message[] = [];

      for (const m of raw) {
          if (!m || !m.id) continue;
          if (seenIds.has(m.id)) continue;

          const mTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
          const isDuplicate = result.some(existing => {
              if (existing.id === m.id) return true;
              if (
                  existing.senderId === m.senderId &&
                  (existing.content || '').trim() === (m.content || '').trim()
              ) {
                  const exTime = existing.timestamp ? new Date(existing.timestamp).getTime() : 0;
                  return Math.abs(exTime - mTime) < 180000;
              }
              return false;
          });

          if (!isDuplicate) {
              seenIds.add(m.id);
              result.push(m);
          }
      }

      result.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
      });

      return result;
  }, [ticket?.messages, localMessages]);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages.length, ticket?.id]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Handle global Escape key
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          e.preventDefault();
          setPreviewImage(null);
          return;
        }
        if (onBack) {
          e.preventDefault();
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [previewImage, onBack]);

  const { updateLocalTicket } = useTickets();

  if (!ticket) return null;

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    const text = input.trim();
    setInput('');
    setIsSending(true);
    localStorage.removeItem(draftKey);

    const tempId = 'temp-' + Date.now();
    const optimisticMsg: Message = {
        id: tempId,
        senderId: user?.email || 'me',
        senderName: user?.name || 'Me',
        role: 'guest',
        content: text,
        timestamp: new Date()
    };

    const currentMessages = ticket.messages || [];
    const optimisticMessages = [...currentMessages, optimisticMsg];

    setLocalMessages(prev => [...prev, optimisticMsg]);

    // Optimistically update ticket preview in context
    updateLocalTicket(ticket.id, {
        lastMessageRole: 'guest',
        lastMessagePreview: text.substring(0, 100),
        updatedAt: new Date(),
        status: ticket.status === 'Closed' ? 'Open' : ticket.status,
        messages: optimisticMessages,
        detailsLoaded: true
    });

    try {
        const sent = await sendMessage(ticket, {
            senderId: user?.email || 'user',
            senderName: user?.name || 'User',
            role: 'guest',
            content: text
        });

        const latestTicket = ticket;
        const confirmedMsg: Message = {
            ...optimisticMsg,
            id: sent?.id || tempId,
            timestamp: sent?.timestamp ? new Date(sent.timestamp) : optimisticMsg.timestamp
        };

        // Retain confirmed message in localMessages so it never disappears from view
        setLocalMessages(prev => prev.map(m => m.id === tempId ? confirmedMsg : m));

        const confirmedMessages = (latestTicket?.messages || optimisticMessages).map((m: any) =>
            m.id === tempId ? confirmedMsg : m
        );
        if (!confirmedMessages.some((m: any) => m.id === confirmedMsg.id || (m.content === confirmedMsg.content && m.senderId === confirmedMsg.senderId))) {
            confirmedMessages.push(confirmedMsg);
        }

        updateLocalTicket(ticket.id, {
            messages: confirmedMessages,
            detailsLoaded: true
        });
    } catch (e) {
        showToast('Failed to send message. Please try again.', 'error');
        const reverted = (ticket.messages || []).filter((m: any) => m.id !== tempId);
        updateLocalTicket(ticket.id, {
            messages: reverted,
            detailsLoaded: true
        });
        setLocalMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
        setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
          if (ev.target?.result) {
              const base64 = ev.target.result as string;
              
              const tempId = 'temp-img-' + Date.now();
              const optimisticMsg: Message = {
                  id: tempId,
                  senderId: user?.email || 'me',
                  senderName: user?.name || 'Me',
                  role: 'guest',
                  content: 'Sent an attachment',
                  attachments: [base64],
                  timestamp: new Date()
              };

              const currentMessages = ticket.messages || [];
              const optimisticMessages = [...currentMessages, optimisticMsg];

              setLocalMessages(prev => [...prev, optimisticMsg]);

              updateLocalTicket(ticket.id, {
                  lastMessageRole: 'guest',
                  lastMessagePreview: 'Sent an attachment',
                  updatedAt: new Date(),
                  status: ticket.status === 'Closed' ? 'Open' : ticket.status,
                  messages: optimisticMessages,
                  detailsLoaded: true
              });

              try {
                  const sent = await sendMessage(ticket, {
                    senderId: user?.email || 'user',
                    senderName: user?.name || 'User',
                    role: 'guest',
                    content: 'Sent an attachment',
                    attachments: [base64]
                  });

                  const confirmedMessages = (ticket.messages || optimisticMessages).map((m: any) =>
                      m.id === tempId ? {
                          ...m,
                          id: sent?.id || m.id,
                          attachments: (sent?.attachments && sent.attachments.length > 0) ? sent.attachments : m.attachments,
                          timestamp: sent?.timestamp ? new Date(sent.timestamp) : m.timestamp
                      } : m
                  );
                  updateLocalTicket(ticket.id, {
                      messages: confirmedMessages,
                      detailsLoaded: true
                  });
                  setLocalMessages(prev => prev.filter(m => m.id !== tempId));
              } catch (err) {
                  showToast('Failed to upload image', 'error');
                  const reverted = (ticket.messages || []).filter((m: any) => m.id !== tempId);
                  updateLocalTicket(ticket.id, {
                      messages: reverted,
                      detailsLoaded: true
                  });
                  setLocalMessages(prev => prev.filter(m => m.id !== tempId));
              }
          }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const formatTime = formatMessageTime;
  const formatDate = formatMessageDateGroup;

  // Group messages by date
  type MessageGroup = { date: string; messages: (Message & { isOriginal?: boolean })[] };
  const groupedMessages: MessageGroup[] = [];
  
  const allWithOriginal = [
    {
      id: 'original-' + ticket.id,
      senderId: ticket.createdByEmail,
      senderName: ticket.createdByName || 'User',
      role: 'guest' as const,
      content: ticket.description,
      attachments: ticket.attachments,
      timestamp: ticket.createdAt,
      isOriginal: true,
    },
    ...allMessages,
  ];

  allWithOriginal.forEach((msg) => {
    const dateLabel = formatDate(msg.timestamp);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (!lastGroup || lastGroup.date !== dateLabel) {
      groupedMessages.push({ date: dateLabel, messages: [msg as Message & { isOriginal?: boolean }] });
    } else {
      lastGroup.messages.push(msg as Message & { isOriginal?: boolean });
    }
  });

  const statusColor = ticket.status === 'Open' 
    ? 'text-emerald-400' 
    : ticket.status === 'In Progress' 
    ? 'text-amber-400' 
    : 'text-gray-400';

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#0d1117] font-segoe relative overflow-hidden">
      
      {/* ── Single Clean Header ── */}
      {!hideHeader && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-700 dark:bg-[#161b22] shrink-0 z-20 shadow-md">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors shrink-0"
              title="Back"
            >
              <Icons.Back size={22} />
            </button>
          )}

          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 text-white font-bold text-sm">
            <Icons.Shield size={16} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm leading-tight truncate">{ticket.title}</p>
            <p className={`text-xs font-medium leading-tight ${statusColor} flex items-center gap-1 mt-0.5`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block"></span>
              {ticket.status} · #{ticket.ticketNumber}
            </p>
          </div>

          {/* Clean link to view work report */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-pay-portal'))}
            className="text-xs text-white/80 hover:text-white underline underline-offset-2 transition-colors shrink-0 font-normal cursor-pointer"
          >
            View more report
          </button>

          {/* Loading indicator */}
          {loadingDetails && (
            <Icons.Refresh size={16} className="animate-spin text-white/60 shrink-0" />
          )}
        </div>
      )}

      {hideHeader && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-medium truncate">#{ticket.ticketNumber} · {ticket.title}</span>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-pay-portal'))}
            className="text-brand-600 dark:text-brand-400 hover:underline font-medium shrink-0 ml-2 cursor-pointer"
          >
            View more report
          </button>
        </div>
      )}

      {/* ── Messages Area ── */}
      <div
        className="flex-1 overflow-y-auto px-3 md:px-6 py-4 flex flex-col gap-0.5 z-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      >
        {groupedMessages.map((group) => (
          <div key={group.date} className="flex flex-col gap-1">
            
            {/* Date separator */}
            <div className="flex items-center justify-center my-3">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-white/5 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-200 dark:border-white/10 shadow-sm">
                {group.date}
              </span>
            </div>

            {group.messages.map((msg) => {
              const isMe = msg.role === 'guest' || msg.role === 'agent' || (!['staff', 'admin', 'team_lead', 'system'].includes(msg.role));
              const isSystem = msg.role === 'system';
              const isSupport = msg.role !== 'guest' && msg.role !== 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-100 dark:border-white/10 shadow-sm max-w-xs text-center">
                      <Icons.Info size={12} className="shrink-0 opacity-70" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              const bubbleAlignClass = isMe ? 'items-end' : 'items-start';
              const bubbleClass = isMe
                ? 'bg-brand-600 text-white rounded-2xl rounded-br-sm'
                : isSupport
                ? 'bg-white dark:bg-[#1e2430] text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-sm border border-gray-100 dark:border-white/10 shadow-sm'
                : 'bg-white dark:bg-[#1e2430] text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-sm border border-gray-100 dark:border-white/10 shadow-sm';

              const timeClass = isMe
                ? 'text-white/60'
                : 'text-gray-400 dark:text-gray-500';

              return (
                <div key={msg.id} className={`flex flex-col ${bubbleAlignClass} mb-1`}>
                  {/* Sender name (only for non-me, non-system) */}
                  {!isMe && (
                    <div className="flex items-center gap-1.5 px-1 mb-0.5 ml-1">
                      <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 truncate max-w-[140px]">
                        {msg.isOriginal ? msg.senderName : (isSupport ? 'Support Team' : msg.senderName)}
                      </span>
                      {isSupport && (
                        <span className="text-[9px] uppercase font-bold tracking-widest text-white bg-brand-500 px-1.5 py-0.5 rounded-sm leading-none">
                          Staff
                        </span>
                      )}
                      {msg.isOriginal && (
                        <span className="text-[9px] uppercase font-bold tracking-widest text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-sm leading-none">
                          Original Request
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={`max-w-[78%] md:max-w-[60%] px-3.5 py-2.5 ${bubbleClass}`}>
                    {/* Text */}
                    {msg.content && msg.content !== 'Sent an attachment' && (
                      <div className="text-[14px] leading-relaxed break-words">
                        <FormattedMessage content={msg.content} isUser={isMe} />
                      </div>
                    )}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className={`flex flex-wrap gap-2 ${msg.content && msg.content !== 'Sent an attachment' ? 'mt-2' : ''}`}>
                        {msg.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="w-40 h-28 rounded-lg overflow-hidden cursor-zoom-in shadow-sm"
                            onClick={() => setPreviewImage(att)}
                          >
                            <img
                              src={att}
                              alt="attachment"
                              loading="lazy"
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Time */}
                    <div className={`flex items-center ${isMe ? 'justify-end' : 'justify-start'} mt-1 gap-1`}>
                      <span className={`text-[10px] font-medium ${timeClass}`}>{formatTime(msg.timestamp)}</span>
                      {isMe && (
                        <Icons.Check size={12} className="text-white/50 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Scroll anchor */}
        <div ref={scrollRef} className="h-1" />
      </div>

      {/* ── Input Bar ── */}
      <div className="bg-white dark:bg-[#161b22] border-t border-gray-200 dark:border-white/10 px-3 py-3 shrink-0 z-20">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shrink-0 self-end mb-0.5"
            title="Attach image"
          >
            <Icons.Attachment size={20} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
          />

          {/* Textarea container */}
          <div className="flex-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 focus-within:border-brand-500 dark:focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all overflow-hidden">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none resize-none px-4 py-2.5 text-[14px] leading-relaxed block"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-sm shrink-0 self-end mb-0.5 active:scale-95"
            title="Send"
          >
            {isSending
              ? <Icons.Refresh size={18} className="animate-spin" />
              : <Icons.Send size={18} />
            }
          </button>
        </div>
      </div>

      {/* ── Image Lightbox ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <Icons.Close size={22} />
          </button>
          <div className="w-full h-full flex items-center justify-center p-6">
            <img
              src={previewImage}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              alt="Preview"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function renderMessageText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium opacity-90 hover:opacity-100 break-all transition-opacity"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
