'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  Search,
  MessageSquare,
  ArrowLeft,
  Loader2,
  Sparkles,
  LogIn,
  Paperclip,
  Smile,
  FileText,
  X,
  History,
  CheckCircle,
  Plus,
  ChevronDown,
  Clock,
  AlertCircle
} from 'lucide-react';
import { ZConnectLogo } from '../../components/ZConnectLogo';

interface FAQ {
  tf_id: string;
  tf_question: string;
  tf_answer: string;
  tf_category: string;
}

interface Message {
  tm_id?: string;
  tm_sender_id: string;
  tm_sender_role: 'user' | 'client' | 'admin';
  tm_message: string;
  tm_attachments?: any[];
  tm_created_at?: string;
  reactions?: string[];
}

function WidgetContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  // Explicitly passed parameters from parent context
  const queryUserId = searchParams.get('userId');
  const queryEmail = searchParams.get('email');
  const queryName = searchParams.get('name');
  const querySignature = searchParams.get('signature');
  const priority = searchParams.get('priority') === 'true';
  const inline = searchParams.get('inline') === 'true';

  // Resolved identity credentials
  const [identity, setIdentity] = useState<{
    userId: string | null;
    email: string | null;
    name: string | null;
    signature: string | null;
  }>({
    userId: queryUserId,
    email: queryEmail,
    name: queryName,
    signature: querySignature,
  });

  // Config State
  const [config, setConfig] = useState({
    primaryColor: '#0D2B5C',
    accentColor: '#D4A017',
    backgroundColor: '#F8FAFC',
    title: 'Support Hub',
    botName: 'Virtual Assistant',
    defaultMode: 'faq',
    allowHandover: true,
    placeholder: 'Type a message...',
  });

  // UI Flow State: 'loading' | 'faq' | 'prechat' | 'handover' | 'chat'
  const [mode, setMode] = useState<'loading' | 'faq' | 'prechat' | 'handover' | 'chat'>('loading');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Live Chat State
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Multi-ticket / history state
  const [userConversations, setUserConversations] = useState<any[]>([]);
  const [ticketHistoryOpen, setTicketHistoryOpen] = useState(false);
  const [conversationStatus, setConversationStatus] = useState<string>('');

  // Advanced features: Typing state, emoji panel, attachments
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // File upload state
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string; key: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-Chat Form State (for anonymous users)
  const [preChatForm, setPreChatForm] = useState({
    name: '',
    email: '',
  });

  // Handover Form State
  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    message: '',
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Check LocalStorage for Anonymous Session on Mount if no query params exist
  useEffect(() => {
    if (!queryUserId && !queryEmail && !querySignature) {
      const stored = localStorage.getItem(`zorvik_chat_anon_${projectId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setIdentity({
            userId: parsed.userId,
            email: parsed.email,
            name: parsed.name,
            signature: 'anonymous',
          });
        } catch (e) {
          console.warn('Failed to parse stored anonymous session', e);
        }
      }
    }
  }, [queryUserId, queryEmail, querySignature, projectId]);

  // 2. Fetch config and FAQs
  useEffect(() => {
    if (!projectId) return;

    const fetchConfig = async () => {
      try {
        const activeUserId = identity.userId;
        const activeEmail = identity.email;
        const activeSignature = identity.signature;

        const query = new URLSearchParams({
          projectId,
          ...(activeUserId && { userId: activeUserId }),
          ...(activeEmail && { email: activeEmail }),
          ...(activeSignature && { signature: activeSignature }),
        });

        const res = await fetch(`/api/widget?${query.toString()}`);
        const data = await res.json();

        if (data.success) {
          if (data.widgetConfig) {
            const fetchedConfig = data.widgetConfig;
            setConfig((prev) => ({ ...prev, ...fetchedConfig }));
            
            // Set dynamic CSS properties based on widget configs from database
            const root = document.documentElement;
            if (fetchedConfig.primaryColor) {
              root.style.setProperty('--primary-accent', fetchedConfig.primaryColor);
              // Slightly darker shade for hover
              root.style.setProperty('--primary-accent-hover', fetchedConfig.primaryColor + 'ee');
            }
            if (fetchedConfig.accentColor) {
              root.style.setProperty('--gold-accent', fetchedConfig.accentColor);
            }
            if (fetchedConfig.backgroundColor) {
              root.style.setProperty('--background', fetchedConfig.backgroundColor);
            }
          }
          setFaqs(data.faqs || []);
          if (data.userConversations) {
            setUserConversations(data.userConversations);
          }

          if (data.activeConversation) {
            setConversation(data.activeConversation);
            setConversationStatus(data.activeConversation.tc_status || 'open');
            setMessages(data.messages || []);
            setMode('chat');
            // Persist last active ticket per project to localStorage
            try {
              localStorage.setItem(
                `zconnect_session_${projectId}`,
                JSON.stringify({ conversationId: data.activeConversation.tc_id })
              );
            } catch (_) {}
          } else {
            setMode((data.widgetConfig?.defaultMode as any) || 'faq');
          }
        } else {
          setMode('faq');
        }
      } catch (err) {
        console.error('Failed to load widget config', err);
        setMode('faq');
      }
    };

    fetchConfig();
  }, [projectId, identity]);

  // 3. Subscribe to Realtime messages via SSE
  useEffect(() => {
    if (mode !== 'chat' || !conversation?.tc_id || !projectId || !identity.userId || !identity.email || !identity.signature) return;

    const query = new URLSearchParams({
      projectId,
      conversationId: conversation.tc_id,
      userId: identity.userId!,
      email: identity.email!,
      signature: identity.signature!,
    });

    const eventSource = new EventSource(`/api/widget/realtime?${query.toString()}`);

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.type === 'message') {
          const newMsg = parsed.data;
          if (newMsg && newMsg.tm_id) {
            // Ignore own messages (handled synchronously by send_message)
            if (newMsg.tm_sender_id === identity.userId) return;
            setMessages((prev) => {
              const exists = prev.some((m) => m.tm_id === newMsg.tm_id);
              if (exists) return prev;
              return [...prev, newMsg];
            });
          }
        } else if (parsed.type === 'conversation_update') {
          // Real-time ticket status update from operator
          setConversationStatus(parsed.status || 'open');
          setConversation((prev: any) => ({ ...prev, tc_status: parsed.status }));
          // Refresh history list to reflect new status
          setUserConversations((prev) =>
            prev.map((c) =>
              c.tc_id === parsed.conversation?.tc_id
                ? { ...c, tc_status: parsed.status }
                : c
            )
          );
        }
      } catch (err) {
        console.error('Failed to parse SSE event', err);
      }
    };

    eventSource.onmessage = handleMessage;

    eventSource.onerror = (err) => {
      console.warn('SSE EventSource disconnected. Reconnecting...', err);
    };

    return () => {
      eventSource.close();
    };
  }, [mode, conversation, projectId, identity]);

  // 4. Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 5. Filter FAQs by search query
  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.tf_question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tf_answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 6. Handle Pre-Chat Form submission (Anonymous signup)
  const handlePreChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preChatForm.name.trim() || !preChatForm.email.trim()) return;

    // Generate random anonymous UUID
    const randomUuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const anonUserId = `anon:${preChatForm.email.toLowerCase().trim()}:${randomUuid}`;

    const newIdentity = {
      userId: anonUserId,
      email: preChatForm.email.toLowerCase().trim(),
      name: preChatForm.name.trim(),
      signature: 'anonymous',
    };

    // Save to LocalStorage
    localStorage.setItem(`zorvik_chat_anon_${projectId}`, JSON.stringify(newIdentity));
    setIdentity(newIdentity);
    setMode('handover');
  };

  // 7. Submit Human Handover (Creates Conversation ticket)
  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim() || !identity.userId || !identity.email || !identity.signature) return;

    setLoading(true);

    // Context metadata tracking: capture browser details and source parent page URL
    const clientMetadata = {
      sourceUrl: document.referrer || window.location.href || 'Unknown Source',
      userAgent: navigator.userAgent || 'Unknown Browser',
    };

    try {
      const res = await fetch('/api/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: identity.userId,
          email: identity.email,
          name: identity.name || 'User',
          signature: identity.signature,
          action: 'start_chat',
          subject: form.subject,
          category: form.category,
          message: form.message,
          isPriority: priority,
          metadata: clientMetadata,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const newConv = data.conversation;
        setConversation(newConv);
        setConversationStatus(newConv.tc_status || 'open');
        setMessages([data.message]);
        setUserConversations((prev) => [newConv, ...prev]);
        setMode('chat');
        try {
          localStorage.setItem(
            `zconnect_session_${projectId}`,
            JSON.stringify({ conversationId: newConv.tc_id })
          );
        } catch (_) {}
        window.parent.postMessage({ type: 'zorvik_chat_started', conversationId: newConv.tc_id }, '*');
      }
    } catch (err) {
      console.error('Failed to connect to agent', err);
    } finally {
      setLoading(false);
    }
  };

  // 8. Send message in active chat
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !identity.userId || !identity.email || !identity.signature) return;

    setUploading(true);
    try {
      // 1. Get presigned upload URL from backend
      const res = await fetch('/api/widget/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: identity.userId,
          email: identity.email,
          signature: identity.signature,
          filename: file.name,
          filetype: file.type,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to get upload signature');
      }

      const { uploadUrl, fileKey } = data;

      // 2. Upload file directly to Backblaze B2 (pre-signed URL)
      const b2Res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!b2Res.ok) {
        throw new Error('Upload to storage failed');
      }

      // 3. Add to attachments state
      const newAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
        key: fileKey,
      };
      setAttachments(prev => [...prev, newAttachment]);
    } catch (err) {
      console.error('File upload error:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && attachments.length === 0) || !conversation?.tc_id || !identity.userId || !identity.email || !identity.signature) return;

    const messageText = newMessage;
    const currentAttachments = attachments;
    setNewMessage('');
    setAttachments([]);
    setSending(true);

    // Optimistic UI Append
    const tempMsg: Message = {
      tm_sender_id: identity.userId,
      tm_sender_role: 'user',
      tm_message: messageText,
      tm_attachments: currentAttachments.map(att => ({ ...att, url: '' })),
      tm_created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: identity.userId,
          email: identity.email,
          name: identity.name || 'User',
          signature: identity.signature,
          action: 'send_message',
          conversationId: conversation.tc_id,
          message: messageText,
          senderRole: 'user',
          attachments: currentAttachments,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => prev.map((m) => (m.tm_message === messageText ? data.message : m)));
        
        // Simulate minor typing effect feedback from virtual bot assistant
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleQuickSuggestion = (text: string) => {
    setNewMessage(text);
  };

  const addReaction = (index: number, reaction: string) => {
    setMessages(prev => prev.map((m, i) => {
      if (i === index) {
        const reactions = m.reactions || [];
        const exists = reactions.includes(reaction);
        return {
          ...m,
          reactions: exists ? reactions.filter(r => r !== reaction) : [...reactions, reaction]
        };
      }
      return m;
    }));
  };

  // Switch handler for handover button click
  const triggerHandover = () => {
    if (!identity.userId || !identity.email) {
      setMode('prechat');
    } else {
      setMode('handover');
    }
  };

  // Switch to a specific ticket from history
  const switchToConversation = async (conv: any) => {
    setTicketHistoryOpen(false);
    setConversation(conv);
    setConversationStatus(conv.tc_status || 'open');
    setMessages([]);
    setMode('chat');
    // Fetch messages for selected conversation
    try {
      const query = new URLSearchParams({
        projectId: projectId!,
        conversationId: conv.tc_id,
        ...(identity.userId && { userId: identity.userId }),
        ...(identity.email && { email: identity.email }),
        ...(identity.signature && { signature: identity.signature }),
      });
      const res = await fetch(`/api/widget/messages?${query.toString()}`);
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch (_) {}
    try {
      localStorage.setItem(
        `zconnect_session_${projectId}`,
        JSON.stringify({ conversationId: conv.tc_id })
      );
    } catch (_) {}
  };

  // Start a brand new ticket
  const startNewTicket = () => {
    setTicketHistoryOpen(false);
    setConversation(null);
    setMessages([]);
    setConversationStatus('');
    setMode('handover');
  };

  if (mode === 'loading') {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-muted-foreground bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs text-primary-accent tracking-wider font-mono uppercase">Loading Hub...</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full overflow-hidden text-foreground bg-background transition-all ${
        inline ? 'rounded-none' : 'md:rounded-xl md:shadow-2xl md:border md:border-border'
      }`}
    >
      {/* Header Widget Navbar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 bg-card shrink-0 shadow-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          {mode !== config.defaultMode && (
            <button
              onClick={() => setMode(config.defaultMode as any)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-7 w-7 rounded-full bg-primary-accent flex items-center justify-center text-primary-accent-foreground">
              <ZConnectLogo size={16} />
            </div>
            <div className="overflow-hidden">
              <h2 className="text-xs font-bold tracking-wider uppercase font-mono truncate text-foreground">
                {config.title}
              </h2>
              <p className="text-[9px] text-muted-foreground truncate">{config.botName}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {priority && (
            <span className="flex items-center gap-1 bg-gold-accent/15 border border-gold-accent/30 text-gold-accent px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase font-mono">
              <Sparkles className="h-2.5 w-2.5" />
              Priority
            </span>
          )}
          {/* Ticket History Switcher — shown for verified logged-in users */}
          {userConversations.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setTicketHistoryOpen((o) => !o)}
                className="flex items-center gap-1 text-[10px] font-bold border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg transition-all"
              >
                <History className="h-3 w-3" />
                Tickets ({userConversations.length})
                <ChevronDown className={`h-3 w-3 transition-transform ${ticketHistoryOpen ? 'rotate-180' : ''}`} />
              </button>
              {ticketHistoryOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Tickets</span>
                    <button
                      onClick={startNewTicket}
                      className="flex items-center gap-1 text-[10px] font-bold text-primary-accent hover:text-primary-accent/80 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> New
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {userConversations.map((c) => (
                      <button
                        key={c.tc_id}
                        onClick={() => switchToConversation(c)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0 ${
                          conversation?.tc_id === c.tc_id ? 'bg-primary-accent/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-foreground truncate flex-1">{c.tc_subject || 'Support Request'}</span>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                            c.tc_status === 'resolved' || c.tc_status === 'closed'
                              ? 'bg-green-500/15 text-green-500'
                              : 'bg-primary-accent/15 text-primary-accent'
                          }`}>
                            {c.tc_status || 'open'}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground capitalize">{c.tc_category || 'general'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* FAQ Search Mode */}
      {mode === 'faq' && (
        <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {filteredFaqs.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No matching questions found.</p>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = expandedFaq === faq.tf_id;
                return (
                  <div key={faq.tf_id} className="border border-border bg-card rounded-xl overflow-hidden transition-all duration-200">
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : faq.tf_id)}
                      className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-muted/40 transition-colors flex justify-between items-center text-foreground"
                    >
                      <span>{faq.tf_question}</span>
                      <span className="text-[10px] text-muted-foreground">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-border/20 pt-2 leading-relaxed whitespace-pre-wrap">
                        {faq.tf_answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {config.allowHandover && (
            <button
              onClick={triggerHandover}
              className="w-full py-2.5 rounded-lg text-xs font-bold text-center border border-border bg-card hover:bg-muted text-foreground transition-all font-mono shrink-0 cursor-pointer"
            >
              Talk to an agent
            </button>
          )}
        </div>
      )}

      {/* Pre-Chat Form Mode (Lead Capture) */}
      {mode === 'prechat' && (
        <form onSubmit={handlePreChatSubmit} className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Introduce Yourself</h3>
            <p className="text-[10px] text-muted-foreground">Let us know who you are to start the conversation.</p>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-muted-foreground uppercase">Full Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={preChatForm.name}
                onChange={(e) => setPreChatForm({ ...preChatForm, name: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-muted-foreground uppercase">Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={preChatForm.email}
                onChange={(e) => setPreChatForm({ ...preChatForm, email: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-primary-accent-foreground bg-primary-accent hover:bg-primary-accent-hover font-mono uppercase tracking-wider mt-4 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            Proceed to Chat
          </button>
        </form>
      )}

      {/* Handover Form Mode (Ticket Details) */}
      {mode === 'handover' && (
        <form onSubmit={handleHandoverSubmit} className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Start Live Conversation</h3>
            <p className="text-[10px] text-muted-foreground">Describe your inquiry to connect with an agent.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-muted-foreground uppercase">Subject</label>
              <input
                type="text"
                placeholder="What can we help you with?"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-muted-foreground uppercase">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
              >
                <option value="general">General Support</option>
                <option value="billing">Payments & Billing</option>
                <option value="technical">Technical Bug</option>
                <option value="feature">Feature Request</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-muted-foreground uppercase">Message Details</label>
              <textarea
                placeholder="Type your message details..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40 min-h-[100px] resize-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-primary-accent-foreground bg-primary-accent hover:bg-primary-accent-hover font-mono uppercase tracking-wider mt-4 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <MessageSquare className="h-4 w-4" />
                Initialize Chat
              </>
            )}
          </button>
        </form>
      )}

      {/* Live Chat Mode */}
      {mode === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Status Bar */}
          <div className="bg-muted/40 px-4 py-2 border-b border-border flex items-center justify-between text-[10px] shrink-0">
            <span className="text-muted-foreground truncate max-w-[170px]">
              <strong className="text-foreground">{conversation?.tc_subject || 'Support Request'}</strong>
            </span>
            <span className={`flex items-center gap-1.5 font-bold shrink-0 ${
              conversationStatus === 'resolved' || conversationStatus === 'closed'
                ? 'text-green-500'
                : 'text-primary-accent'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                conversationStatus === 'resolved' || conversationStatus === 'closed'
                  ? 'bg-green-500'
                  : 'bg-primary-accent animate-pulse'
              }`}></span>
              {conversationStatus === 'resolved' ? 'Resolved' : conversationStatus === 'closed' ? 'Closed' : 'Active'}
            </span>
          </div>

          {/* Resolved / Closed status banner */}
          {(conversationStatus === 'resolved' || conversationStatus === 'closed') && (
            <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-3 flex items-start gap-3 shrink-0">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-green-500">Ticket {conversationStatus === 'resolved' ? 'Resolved' : 'Closed'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">This conversation has been closed by our team. Need more help?</p>
              </div>
              <button
                onClick={startNewTicket}
                className="flex items-center gap-1 text-[10px] font-bold text-primary-accent hover:text-primary-accent/80 bg-primary-accent/10 border border-primary-accent/20 px-2 py-1 rounded-lg transition-all shrink-0"
              >
                <Plus className="h-3 w-3" /> New Ticket
              </button>
            </div>
          )}

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-background/50">
            {messages.map((msg, index) => {
              const isMe = msg.tm_sender_id === identity.userId;
              return (
                <div key={index} className="space-y-1">
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="group relative max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          isMe
                            ? 'rounded-br-none bg-primary-accent text-primary-accent-foreground shadow-sm'
                            : 'rounded-bl-none bg-card border border-border text-foreground'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.tm_message}</p>
                        
                        {/* Attachments rendering */}
                        {msg.tm_attachments && msg.tm_attachments.length > 0 && (
                          <div className="mt-2 space-y-2 border-t border-border/10 pt-2 shrink-0">
                            {msg.tm_attachments.map((att: any, attIdx: number) => {
                              const isImg = att.type?.startsWith('image/');
                              return (
                                <div key={attIdx} className="max-w-full">
                                  {isImg ? (
                                    <a href={att.url || '#'} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border/20 bg-background/50 hover:opacity-90 transition-opacity">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={att.url || ''}
                                        alt={att.name}
                                        className="max-h-48 max-w-full object-contain mx-auto"
                                        loading="lazy"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={att.url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 rounded-lg bg-background/40 hover:bg-background/60 border border-border/20 transition-colors text-xs text-foreground font-semibold"
                                    >
                                      <FileText className="h-4 w-4 text-primary-accent shrink-0" />
                                      <span className="truncate flex-1">{att.name}</span>
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <span className={`block text-[8px] text-right mt-1 font-mono ${isMe ? 'opacity-70' : 'text-muted-foreground'}`}>
                          {msg.tm_created_at ? new Date(msg.tm_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                        </span>
                      </div>

                      {/* Reactions display */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`absolute -bottom-2.5 flex gap-1 ${isMe ? 'right-2' : 'left-2'}`}>
                          {msg.reactions.map((r, ri) => (
                            <span key={ri} className="bg-card border border-border text-[10px] px-1 rounded-full shadow-sm">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Mini reaction triggers */}
                      <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${isMe ? '-left-16' : '-right-16'}`}>
                        <button onClick={() => addReaction(index, '👍')} className="hover:scale-125 transition-transform text-xs">👍</button>
                        <button onClick={() => addReaction(index, '❤️')} className="hover:scale-125 transition-transform text-xs">❤️</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-xl rounded-tl-none px-4 py-2.5 flex items-center gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-100"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-200"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestions chips */}
          <div className="px-4 py-2 bg-muted/20 border-t border-border/60 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
            <button onClick={() => handleQuickSuggestion('Thank you for the help!')} className="text-[10px] font-bold border border-border hover:border-primary-accent bg-card text-muted-foreground hover:text-primary-accent px-2.5 py-1 rounded-full transition-all">👍 Thank you</button>
            <button onClick={() => handleQuickSuggestion('Is there any update on my ticket?')} className="text-[10px] font-bold border border-border hover:border-primary-accent bg-card text-muted-foreground hover:text-primary-accent px-2.5 py-1 rounded-full transition-all">⏱ Check update</button>
          </div>

          {/* Chat Input Form */}
          <div className="p-3 border-t border-border bg-card relative shrink-0">
            {showEmojiPicker && (
              <div className="absolute bottom-full right-4 bg-popover border border-border rounded-xl p-2.5 mb-2.5 grid grid-cols-6 gap-2.5 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                {['😀', '👍', '❤️', '🙌', '🎉', '🔥', '🤔', '💬', '👀', '💡', '✅', '❌'].map(emoji => (
                  <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="hover:scale-125 transition-transform text-sm p-1.5">
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Pending Attachments List */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-muted/20 shrink-0">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-card border border-border rounded-full pl-3 pr-2 py-1 text-[10px] max-w-[180px] truncate shadow-sm">
                    <span className="truncate flex-1">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground p-0.5 hover:bg-muted rounded-full shrink-0 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex gap-2.5 items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || conversation?.tc_status === 'resolved'}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Paperclip className="h-4.5 w-4.5" />}
              </button>
              
              <input
                type="text"
                placeholder={config.placeholder || "Type a message..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-primary-accent/40 text-foreground"
                disabled={conversation?.tc_status === 'resolved'}
              />

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 shrink-0 cursor-pointer"
                disabled={conversation?.tc_status === 'resolved'}
              >
                <Smile className="h-4.5 w-4.5" />
              </button>

              <button
                type="submit"
                disabled={sending || (!newMessage.trim() && attachments.length === 0) || conversation?.tc_status === 'resolved'}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-primary-accent-foreground bg-primary-accent hover:bg-primary-accent-hover transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-muted-foreground bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs text-primary-accent tracking-wider font-mono uppercase">Loading page context...</span>
      </div>
    }>
      <WidgetContent />
    </Suspense>
  );
}
