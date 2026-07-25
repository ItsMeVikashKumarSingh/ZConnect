'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  Send,
  CheckCircle,
  Search,
  Sparkles,
  HelpCircle,
  Loader2,
  BookOpen,
  LogOut,
  ChevronLeft,
  Settings,
  Sun,
  Moon,
  Monitor,
  User,
  Clock,
  Compass
} from 'lucide-react';
import Link from 'next/link';
import { ZConnectLogo } from '../../components/ZConnectLogo';
import { useTheme } from '../ThemeProvider';

interface Conversation {
  tc_id: string;
  tc_user_id: string;
  tc_user_name: string;
  tc_user_email: string;
  tc_subject: string;
  tc_category: string;
  tc_status: 'open' | 'resolved' | 'closed';
  tc_is_priority: boolean;
  tc_created_at: string;
  tc_updated_at: string;
  tc_metadata?: {
    sourceUrl?: string;
    userAgent?: string;
  };
}

interface Message {
  tm_id: string;
  tm_sender_id: string;
  tm_sender_role: 'user' | 'client' | 'admin';
  tm_message: string;
  tm_created_at: string;
}

interface CannedResponse {
  tcr_id: string;
  tcr_shortcut: string;
  tcr_response: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, accent, setTheme, setAccent } = useTheme();
  
  const [token, setToken] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Mock sender ID for logged-in client user
  const tenantUserId = 'client-agent-1';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [canned, setCanned] = useState<CannedResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Responsive state: force mobile split views
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Canned shortcuts autocomplete state
  const [showCannedList, setShowCannedList] = useState(false);
  const [filteredCanned, setFilteredCanned] = useState<CannedResponse[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const presets: Array<{ name: string; value: typeof accent }> = [
    { name: 'Navy', value: 'navy' },
    { name: 'Blue', value: 'blue' },
    { name: 'Indigo', value: 'indigo' },
    { name: 'Purple', value: 'purple' },
    { name: 'Emerald', value: 'emerald' },
    { name: 'Cyan', value: 'cyan' },
    { name: 'Orange', value: 'orange' },
    { name: 'Rose', value: 'rose' }
  ];

  // 1. Authenticate session on mount
  useEffect(() => {
    const queryToken = searchParams.get('token');
    const localToken = localStorage.getItem('zorvik_chat_token');
    const activeToken = queryToken || localToken;

    if (!activeToken) {
      router.push('/login');
      return;
    }

    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: activeToken }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.session?.role === 'client') {
          setToken(activeToken);
          setProjectId(data.session.projectId);
          if (queryToken) localStorage.setItem('zorvik_chat_token', queryToken);
          setAuthChecking(false);
        } else {
          localStorage.removeItem('zorvik_chat_token');
          router.push('/login');
        }
      } catch (err) {
        localStorage.removeItem('zorvik_chat_token');
        router.push('/login');
      }
    };

    verifySession();
  }, [searchParams, router]);

  // 2. Fetch conversations and canned shortcuts
  const fetchWorkspaceData = async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [convRes, cannedRes] = await Promise.all([
        fetch(`/api/dashboard?projectId=${projectId}&action=conversations`, { headers }),
        fetch(`/api/dashboard?projectId=${projectId}&action=canned`, { headers }),
      ]);

      const convData = await convRes.json();
      const cannedData = await cannedRes.json();

      if (convData.success) setConversations(convData.conversations);
      if (cannedData.success) setCanned(cannedData.canned);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && projectId) fetchWorkspaceData();
  }, [token, projectId]);

  const selectedConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedConvIdRef.current = selectedConv?.tc_id || null;
  }, [selectedConv]);

  // 3. Subscribe to Realtime dashboard updates (conversations & messages) via SSE
  useEffect(() => {
    if (!token || !projectId) return;

    const query = new URLSearchParams({
      projectId,
      token,
    });

    const eventSource = new EventSource(`/api/dashboard/realtime?${query.toString()}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'conversation') {
          const conv = payload.data;
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.tc_id === conv.tc_id);
            if (idx > -1) {
              const updated = [...prev];
              updated[idx] = conv;
              return updated.sort((a, b) => new Date(b.tc_updated_at).getTime() - new Date(a.tc_updated_at).getTime());
            } else {
              return [conv, ...prev];
            }
          });

          // Sync active selection status changes
          if (selectedConvIdRef.current === conv.tc_id) {
            setSelectedConv((current) => (current ? { ...current, tc_status: conv.tc_status, tc_updated_at: conv.tc_updated_at } : null));
          }
        } else if (payload.type === 'message') {
          const msg = payload.data;
          // Ignore own replies (handled synchronously by handleSendReply)
          if (msg.tm_sender_id === tenantUserId) return;

          // Check if this message belongs to the currently active conversation
          if (selectedConvIdRef.current === msg.tm_conversation_id) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.tm_id === msg.tm_id);
              if (exists) return prev;
              return [...prev, msg];
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('Dashboard SSE disconnected. Reconnecting...', err);
    };

    return () => {
      eventSource.close();
    };
  }, [token, projectId]);

  // 4. Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 5. Handle conversation selection
  const selectConversation = async (conv: Conversation) => {
    if (!token || !projectId) return;
    setSelectedConv(conv);
    setMobileView('chat');
    setLoadingMsg(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/dashboard?projectId=${projectId}&action=messages&conversationId=${conv.tc_id}`, { headers });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMsg(false);
    }
  };

  // 6. Send Agent Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || !token || !projectId) return;

    const messageText = newMessage;
    setNewMessage('');
    setShowCannedList(false);

    // Optimistic UI Append
    const tempMsg: Message = {
      tm_id: 'temp-' + Date.now(),
      tm_sender_id: tenantUserId,
      tm_sender_role: 'client',
      tm_message: messageText,
      tm_created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          action: 'send_reply',
          conversationId: selectedConv.tc_id,
          message: messageText,
          senderId: tenantUserId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.map((m) => (m.tm_id === tempMsg.tm_id ? data.message : m)));
        setConversations((prev) =>
          prev.map((c) => (c.tc_id === selectedConv.tc_id ? { ...c, tc_status: 'open', tc_updated_at: new Date().toISOString() } : c))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 7. Mark resolved
  const handleResolve = async () => {
    if (!selectedConv || !token || !projectId) return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          action: 'resolve',
          conversationId: selectedConv.tc_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedConv((prev) => (prev ? { ...prev, tc_status: 'resolved' } : null));
        setConversations((prev) =>
          prev.map((c) => (c.tc_id === selectedConv.tc_id ? { ...c, tc_status: 'resolved' } : c))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 8. Canned reply filters
  const handleInputChange = (val: string) => {
    setNewMessage(val);
    if (val.startsWith('/')) {
      const query = val.toLowerCase().substring(1);
      const filtered = canned.filter((c) => c.tcr_shortcut.toLowerCase().includes(query));
      setFilteredCanned(filtered);
      setShowCannedList(filtered.length > 0);
    } else {
      setShowCannedList(false);
    }
  };

  const selectCannedResponse = (response: string) => {
    setNewMessage(response);
    setShowCannedList(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('zorvik_chat_token');
    router.push('/login');
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.tc_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.tc_user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.tc_subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'open' && conv.tc_status === 'open') ||
      (statusFilter === 'resolved' && conv.tc_status === 'resolved');

    return matchesSearch && matchesStatus;
  });

  if (authChecking) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent">Verifying security clearance...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col md:flex-row overflow-hidden bg-background transition-colors duration-300">
      
      {/* 1. Left Sidebar - Navigation & Branding */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-5 flex items-center justify-between md:border-b border-border">
          <ZConnectLogo showText size={30} />
          
          {/* Quick theme settings trigger on mobile */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Sidebar Nav links */}
        <nav className="hidden md:flex flex-col flex-1 p-4 space-y-1.5">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-3 mb-2">Workspace</span>
          
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold bg-primary-accent/10 text-primary-accent transition-all text-left">
            <MessageSquare className="h-4 w-4 text-primary-accent" />
            Ticketing Inbox
          </button>

          <Link
            href={`/dashboard/faqs?token=${token}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <BookOpen className="h-4 w-4" />
            Manage FAQs
          </Link>

          <Link
            href={`/dashboard/integrations?token=${token}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Settings className="h-4 w-4" />
            Integrations
          </Link>

          <div className="border-t border-border my-4 pt-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-3 mb-2">Controls</span>
          </div>

          {/* Theme engine selector directly embedded in sidebar */}
          <div className="px-3 space-y-4">
            {/* Theme switcher */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-muted-foreground font-bold uppercase">Theme Mode</span>
              <div className="flex bg-muted p-0.5 rounded-lg border border-border">
                <button
                  onClick={() => setTheme('light')}
                  title="Light mode"
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold flex justify-center items-center ${theme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Sun className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  title="Dark mode"
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold flex justify-center items-center ${theme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Moon className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  title="System mode"
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold flex justify-center items-center ${theme === 'system' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Monitor className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Accent switcher */}
            <div className="space-y-2">
              <span className="text-[9px] text-muted-foreground font-bold uppercase">Accent Colors</span>
              <div className="grid grid-cols-4 gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setAccent(p.value)}
                    title={p.name}
                    className={`h-6 w-6 rounded-full flex items-center justify-center border transition-all ${accent === p.value ? 'border-foreground scale-105 shadow-sm' : 'border-transparent hover:scale-105'}`}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{
                        backgroundColor:
                          p.value === 'navy'
                            ? '#0D2B5C'
                            : p.value === 'blue'
                            ? '#3B82F6'
                            : p.value === 'indigo'
                            ? '#6366F1'
                            : p.value === 'purple'
                            ? '#A855F7'
                            : p.value === 'emerald'
                            ? '#10B981'
                            : p.value === 'cyan'
                            ? '#06B6D4'
                            : p.value === 'orange'
                            ? '#F97316'
                            : '#F43F5E',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="hidden md:flex flex-col border-t border-border p-4 space-y-3 bg-muted/30">
          <div className="text-[10px] text-muted-foreground">
            Project ID: <span className="font-mono text-foreground font-semibold truncate block mt-0.5">{projectId}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-600 transition-colors py-1.5"
          >
            <LogOut className="h-4 w-4" />
            Disconnect Console
          </button>
        </div>

        {/* Mobile Settings Drawer overlay */}
        {showSettings && (
          <div className="md:hidden border-t border-border bg-card p-4 space-y-4 animate-in slide-in-from-top duration-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">Mobile Settings</span>
              <button onClick={() => handleLogout()} className="text-xs font-bold text-red-500 flex items-center gap-1">
                <LogOut className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>
            <div className="flex gap-4">
              <Link href={`/dashboard/faqs?token=${token}`} className="flex-1 py-2 text-center bg-muted text-xs font-bold rounded-lg hover:bg-muted/80">
                FAQs Manager
              </Link>
              <Link href={`/dashboard/integrations?token=${token}`} className="flex-1 py-2 text-center bg-muted text-xs font-bold rounded-lg hover:bg-muted/80">
                Integrations
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] text-muted-foreground font-bold uppercase">Theme Mode</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="w-full bg-muted border border-border rounded-lg text-xs py-1.5 px-2.5 text-foreground"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-muted-foreground font-bold uppercase">Accent Color</span>
                <select
                  value={accent}
                  onChange={(e) => setAccent(e.target.value as any)}
                  className="w-full bg-muted border border-border rounded-lg text-xs py-1.5 px-2.5 text-foreground capitalize"
                >
                  {presets.map(p => (
                    <option key={p.value} value={p.value}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Conversations Inbox Panel */}
      <section
        className={`w-full md:w-80 border-r border-border flex flex-col overflow-hidden bg-card/40 ${
          mobileView === 'chat' && selectedConv ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 space-y-3.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search inquiries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary-accent/40"
            />
          </div>
          
          <div className="flex bg-muted rounded-lg p-0.5 border border-border">
            {(['open', 'resolved', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 py-1.5 text-[10px] font-bold tracking-wider rounded-md text-center uppercase transition-all ${
                  statusFilter === status
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary-accent" />
              <span className="text-[10px] mt-2 font-mono">Loading inbox...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-16 space-y-2">
              <Compass className="h-8 w-8 mx-auto opacity-30" />
              <p>No tickets found in this segment.</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConv?.tc_id === conv.tc_id;
              return (
                <button
                  key={conv.tc_id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'border-primary-accent bg-primary-accent/5 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground truncate">{conv.tc_user_name}</span>
                    {conv.tc_is_priority && (
                      <span className="flex items-center gap-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 dark:text-yellow-400 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono">
                        <Sparkles className="h-2.5 w-2.5" />
                        Priority
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate font-mono">{conv.tc_user_email}</span>
                  <p className="text-xs font-semibold text-foreground/80 line-clamp-1 mt-1">{conv.tc_subject}</p>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground mt-1.5 font-mono pt-1.5 border-t border-border/20">
                    <span className="capitalize">{conv.tc_category}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(conv.tc_updated_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* 3. Messaging Chat Panel */}
      <section
        className={`flex-1 flex flex-col overflow-hidden bg-muted/20 ${
          mobileView === 'list' && !selectedConv ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConv ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Pane Header */}
            <div className="border-b border-border px-6 py-4 bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="overflow-hidden">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                    {selectedConv.tc_subject}
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                        selectedConv.tc_status === 'resolved'
                          ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                          : 'bg-primary-accent/10 border border-primary-accent/20 text-primary-accent'
                      }`}
                    >
                      {selectedConv.tc_status}
                    </span>
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Client: {selectedConv.tc_user_name} ({selectedConv.tc_user_email})
                  </p>
                </div>
              </div>
              {selectedConv.tc_status !== 'resolved' && (
                <button
                  onClick={handleResolve}
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition-colors shadow-sm cursor-pointer shrink-0"
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolve
                </button>
              )}
            </div>

            {/* Conversation Messages Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-background/50">
              {loadingMsg ? (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
                  <span className="text-[10px] mt-2 font-mono">Loading messages...</span>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isAgent = msg.tm_sender_role === 'client' || msg.tm_sender_role === 'admin';
                  return (
                    <div key={index} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-5 py-3 text-xs leading-relaxed ${
                          isAgent
                            ? 'rounded-br-none bg-primary-accent text-primary-accent-foreground shadow-sm'
                            : 'rounded-bl-none bg-card border border-border text-foreground'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.tm_message}</p>
                        <span
                          className={`block text-[8px] text-right mt-1.5 font-mono ${
                            isAgent ? 'opacity-70' : 'text-muted-foreground'
                          }`}
                        >
                          {new Date(msg.tm_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Conversation Input Form */}
            {selectedConv.tc_status !== 'resolved' ? (
              <div className="p-4 border-t border-border bg-card relative shrink-0">
                {showCannedList && (
                  <div className="absolute bottom-full left-4 right-4 bg-popover border border-border rounded-xl max-h-40 overflow-y-auto mb-2.5 z-50 shadow-xl custom-scrollbar">
                    {filteredCanned.map((c) => (
                      <button
                        key={c.tcr_id}
                        onClick={() => selectCannedResponse(c.tcr_response)}
                        className="w-full text-left px-4 py-2 hover:bg-muted text-xs border-b border-border/40 transition-colors font-mono"
                      >
                        <span className="text-primary-accent font-bold">{c.tcr_shortcut}</span>
                        <span className="text-muted-foreground ml-2 truncate inline-block max-w-[80%] vertical-align-middle">
                          - {c.tcr_response}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSendReply} className="flex gap-3 items-end">
                  <textarea
                    placeholder="Type a response... (Use '/' to trigger canned response templates)"
                    value={newMessage}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-primary-accent/40 resize-none h-12 custom-scrollbar"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary-accent text-primary-accent-foreground hover:bg-primary-accent-hover transition-colors disabled:opacity-50 shadow-sm shrink-0 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 bg-muted/40 border-t border-border text-center text-xs text-muted-foreground font-semibold">
                This inquiry was marked resolved. Re-open by sending a reply in the widget.
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-3 p-6 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 animate-bounce" />
            <h3 className="text-xs font-bold tracking-wider font-mono uppercase">Console Workspace Standby</h3>
            <p className="text-[10px] text-muted-foreground max-w-xs">
              Select a client conversation from the sidebar list to inspect support history and reply.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent">Loading Workspace...</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
