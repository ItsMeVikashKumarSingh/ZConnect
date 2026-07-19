'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  HelpCircle,
  Send,
  Search,
  User,
  MessageSquare,
  ArrowLeft,
  Loader2,
  Sparkles,
  LogIn,
  Paperclip,
  Smile,
  ThumbsUp,
  Heart,
  SmilePlus
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

  // Advanced features: Typing state, emoji panel, attachments mockup
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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

          if (data.activeConversation) {
            setConversation(data.activeConversation);
            setMessages(data.messages || []);
            setMode('chat');
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

  // 3. Poll messages if in chat mode
  useEffect(() => {
    if (mode !== 'chat' || !conversation?.tc_id || !projectId || !identity.userId || !identity.email || !identity.signature) return;

    const interval = setInterval(async () => {
      try {
        const query = new URLSearchParams({
          projectId,
          userId: identity.userId!,
          email: identity.email!,
          signature: identity.signature!,
        });

        const res = await fetch(`/api/widget?${query.toString()}`);
        const data = await res.json();
        if (data.success && data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.warn('Failed to poll messages', err);
      }
    }, 4500);

    return () => clearInterval(interval);
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
        setConversation(data.conversation);
        setMessages([data.message]);
        setMode('chat');
        window.parent.postMessage({ type: 'zorvik_chat_started', conversationId: data.conversation.tc_id }, '*');
      }
    } catch (err) {
      console.error('Failed to connect to agent', err);
    } finally {
      setLoading(false);
    }
  };

  // 8. Send message in active chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation?.tc_id || !identity.userId || !identity.email || !identity.signature) return;

    const messageText = newMessage;
    setNewMessage('');
    setSending(true);

    // Optimistic UI Append
    const tempMsg: Message = {
      tm_sender_id: identity.userId,
      tm_sender_role: 'user',
      tm_message: messageText,
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
      <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card shrink-0 shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          {mode !== config.defaultMode && (
            <button
              onClick={() => setMode(config.defaultMode as any)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
          )}
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-primary-accent flex items-center justify-center text-primary-accent-foreground">
              <ZConnectLogo size={20} />
            </div>
            <div className="overflow-hidden">
              <h2 className="text-xs font-bold tracking-wider uppercase font-mono truncate text-foreground">
                {config.title}
              </h2>
              <p className="text-[9px] text-muted-foreground truncate">{config.botName}</p>
            </div>
          </div>
        </div>
        {priority && (
          <span className="flex items-center gap-1 bg-gold-accent/15 border border-gold-accent/30 text-gold-accent px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase font-mono shrink-0">
            <Sparkles className="h-2.5 w-2.5" />
            Priority
          </span>
        )}
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
          <div className="bg-muted/40 px-6 py-2 border-b border-border flex items-center justify-between text-[10px] shrink-0">
            <span className="text-muted-foreground truncate max-w-[200px]">
              Topic: <strong className="text-foreground">{conversation?.tc_subject}</strong>
            </span>
            <span className="flex items-center gap-1.5 font-bold shrink-0">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              {conversation?.tc_status === 'resolved' ? 'Resolved' : 'Active Thread'}
            </span>
          </div>

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

            <form onSubmit={handleSendMessage} className="flex gap-2.5 items-center">
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 shrink-0">
                <Paperclip className="h-4.5 w-4.5" />
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
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 shrink-0"
              >
                <Smile className="h-4.5 w-4.5" />
              </button>

              <button
                type="submit"
                disabled={sending || !newMessage.trim() || conversation?.tc_status === 'resolved'}
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
