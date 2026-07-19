'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { ZConnectLogo } from '../components/ZConnectLogo';
import {
  Shield,
  MessageSquare,
  Sparkles,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Search,
  Monitor,
  Moon,
  Sun,
  CheckCircle,
  HelpCircle,
  Send,
  User,
  Paperclip,
  Smile,
  AlertCircle,
  Users,
  Layers,
  Lock,
  Clock,
  ChevronRight,
  Filter,
  Check,
  X,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock types for the real-time simulator
interface SimTicket {
  id: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  status: 'open' | 'resolved';
  priority: boolean;
  updatedAt: string;
}

interface SimMessage {
  id: string;
  ticketId: string;
  sender: 'user' | 'agent';
  text: string;
  time: string;
}

export default function LandingPage() {
  const router = useRouter();
  const { theme, accent, setTheme, setAccent } = useTheme();

  // Color options for personalization playground
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

  // Inline simulator panel: 'widget' | 'agent' | null
  const [simulatorView, setSimulatorView] = useState<'widget' | 'agent' | null>(null);
  const showSimulator = simulatorView !== null;

  // ----------------------------------------------------
  // REAL-TIME TICKETING SIMULATOR STATE
  // ----------------------------------------------------
  const [tickets, setTickets] = useState<SimTicket[]>([
    {
      id: 'tick-101',
      userName: 'Alice Vance',
      userEmail: 'alice@vance-studios.com',
      subject: 'Custom API script alignment issue',
      category: 'technical',
      status: 'open',
      priority: true,
      updatedAt: 'Just now'
    },
    {
      id: 'tick-102',
      userName: 'Robert Dow',
      userEmail: 'robert@dowdesign.co',
      subject: 'Inquiry on billing options',
      category: 'billing',
      status: 'resolved',
      priority: false,
      updatedAt: '2 hours ago'
    }
  ]);

  const [simMessages, setSimMessages] = useState<SimMessage[]>([
    {
      id: 'msg-1',
      ticketId: 'tick-101',
      sender: 'user',
      text: "Hi, I'm trying to align the iframe container but it seems to push margins on mobile viewports. Any advice?",
      time: '12:45 PM'
    },
    {
      id: 'msg-2',
      ticketId: 'tick-102',
      sender: 'user',
      text: "Hello, do you offer quarterly billing options for startup accounts?",
      time: '10:30 AM'
    },
    {
      id: 'msg-3',
      ticketId: 'tick-102',
      sender: 'agent',
      text: "Yes, we do! You can configure payment terms inside your Billing tab under the console settings.",
      time: '10:32 AM'
    }
  ]);

  const [selectedTicketId, setSelectedTicketId] = useState<string>('tick-101');

  // USER WIDGET SIDE STATES
  const [widgetMode, setWidgetMode] = useState<'faq' | 'prechat' | 'handover' | 'chat'>('faq');
  const [faqExpanded, setFaqExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [userWidgetForm, setUserWidgetForm] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    message: ''
  });
  
  const [userWidgetInput, setUserWidgetInput] = useState('');
  const [widgetTyping, setWidgetTyping] = useState(false);
  const [userCreatedTicketId, setUserCreatedTicketId] = useState<string | null>(null);

  // AGENT CONSOLE SIDE STATES
  const [agentInput, setAgentInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const [agentInboxFilter, setAgentInboxFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const userScrollRef = useRef<HTMLDivElement>(null);
  const agentScrollRef = useRef<HTMLDivElement>(null);

  // Autoscroll chats
  useEffect(() => {
    userScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, widgetTyping]);

  useEffect(() => {
    agentScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, agentTyping]);

  const simFaqs = [
    { id: 'f-1', q: 'How do I embed the ZConnect widget?', a: 'Copy the HTML integration script from your admin settings panel and paste it immediately before the closing </body> tag.' },
    { id: 'f-2', q: 'Does ZConnect support SSO?', a: 'Yes! ZConnect utilizes cryptographically secure HMAC-SHA256 tokens to authenticate users securely.' },
    { id: 'f-3', q: 'Is the support platform responsive?', a: 'Absolutely. Both the operator console and the floating client widget are optimized for mobile, tablet, and desktop viewports.' }
  ];

  const handleUserPrechatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWidgetForm.name.trim() || !userWidgetForm.email.trim()) return;
    setWidgetMode('handover');
  };

  const handleUserHandoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, subject, category, message } = userWidgetForm;
    if (!subject.trim() || !message.trim()) return;

    const newTicketId = `tick-${Date.now().toString().substring(10)}`;

    const newTicket: SimTicket = {
      id: newTicketId,
      userName: name || 'Valued Client',
      userEmail: email || 'client@company.com',
      subject: subject,
      category: category,
      status: 'open',
      priority: true,
      updatedAt: 'Just now'
    };

    const newMsg: SimMessage = {
      id: `msg-${Date.now()}`,
      ticketId: newTicketId,
      sender: 'user',
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setTickets(prev => [newTicket, ...prev]);
    setSimMessages(prev => [...prev, newMsg]);
    setSelectedTicketId(newTicketId);
    setUserCreatedTicketId(newTicketId);
    setWidgetMode('chat');

    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      const agentReply: SimMessage = {
        id: `msg-agent-${Date.now()}`,
        ticketId: newTicketId,
        sender: 'agent',
        text: `Hello ${name || 'there'}! I have received your request regarding "${subject}" under ${category} support. Let me look into this for you.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSimMessages(prev => [...prev, agentReply]);
    }, 3000);
  };

  const handleUserWidgetSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWidgetInput.trim() || !userCreatedTicketId) return;

    const newMsg: SimMessage = {
      id: `msg-${Date.now()}`,
      ticketId: userCreatedTicketId,
      sender: 'user',
      text: userWidgetInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSimMessages(prev => [...prev, newMsg]);
    setUserWidgetInput('');

    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      const autoAgentReply: SimMessage = {
        id: `msg-agent-${Date.now()}`,
        ticketId: userCreatedTicketId,
        sender: 'agent',
        text: "Understood. Our systems are checking. Feel free to add any details or attachments below.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSimMessages(prev => [...prev, autoAgentReply]);
    }, 2500);
  };

  const handleAgentConsoleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const newMsg: SimMessage = {
      id: `msg-${Date.now()}`,
      ticketId: selectedTicketId,
      sender: 'agent',
      text: agentInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSimMessages(prev => [...prev, newMsg]);
    setAgentInput('');

    if (selectedTicketId === userCreatedTicketId) {
      setWidgetTyping(true);
      setTimeout(() => {
        setWidgetTyping(false);
      }, 1000);
    }
  };

  const handleAgentResolve = (ticketId: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'resolved' } : t));
  };

  const handleResetSimulator = () => {
    setWidgetMode('faq');
    setUserCreatedTicketId(null);
    setSelectedTicketId('tick-101');
    setUserWidgetForm({
      name: '',
      email: '',
      subject: '',
      category: 'general',
      message: ''
    });
    setTickets([
      {
        id: 'tick-101',
        userName: 'Alice Vance',
        userEmail: 'alice@vance-studios.com',
        subject: 'Custom API script alignment issue',
        category: 'technical',
        status: 'open',
        priority: true,
        updatedAt: 'Just now'
      },
      {
        id: 'tick-102',
        userName: 'Robert Dow',
        userEmail: 'robert@dowdesign.co',
        subject: 'Inquiry on billing options',
        category: 'billing',
        status: 'resolved',
        priority: false,
        updatedAt: '2 hours ago'
      }
    ]);
    setSimMessages([
      {
        id: 'msg-1',
        ticketId: 'tick-101',
        sender: 'user',
        text: "Hi, I'm trying to align the iframe container but it seems to push margins on mobile viewports. Any advice?",
        time: '12:45 PM'
      },
      {
        id: 'msg-2',
        ticketId: 'tick-102',
        sender: 'user',
        text: "Hello, do you offer quarterly billing options for startup accounts?",
        time: '10:30 AM'
      },
      {
        id: 'msg-3',
        ticketId: 'tick-102',
        sender: 'agent',
        text: "Yes, we do! You can configure payment terms inside your Billing tab under the console settings.",
        time: '10:32 AM'
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      {/* Ambient background decoration */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary-accent/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-gold-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <ZConnectLogo showText size={36} />
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            <button onClick={() => setShowSimulator(true)} className="hover:text-foreground transition-colors font-semibold bg-transparent border-none cursor-pointer">Live Simulator</button>
            <a href="#features" className="hover:text-foreground transition-colors">Platform Features</a>
            <a href="#playground" className="hover:text-foreground transition-colors">Personalization</a>
            <a href="#security" className="hover:text-foreground transition-colors">Enterprise Security</a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/login')}
              className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push('/login')}
              className="bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-sm font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all"
            >
              Launch Portal
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center md:text-left flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] max-w-2xl text-foreground">
            Real-Time Customer Chat. <span className="text-primary-accent">Delivered Instantly.</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-xl leading-relaxed">
            Deliver state-of-the-art live messaging, self-service FAQs, and streamlined ticketing directly to your users under ZConnect&apos;s premium corporate brand.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start pt-2">
            <button
              onClick={() => setShowSimulator(true)}
              className="w-full sm:w-auto bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground font-bold px-6 py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-primary-accent/10 transition-all hover:translate-x-0.5"
            >
              Launch Live Simulator
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto border border-border bg-card hover:bg-muted text-foreground font-bold px-6 py-3.5 rounded-lg flex items-center justify-center transition-all"
            >
              Explore Console
            </button>
          </div>
        </div>

        <div className="flex-1 w-full max-w-md md:max-w-none">
          <div className="premium-card relative overflow-hidden bg-card/60 backdrop-blur-sm border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
                <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground font-mono">ZConnect Agent Hub</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-muted/50 rounded-xl space-y-1">
                <span className="text-2xl font-bold text-foreground">142</span>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Active Tickets</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl space-y-1">
                <span className="text-2xl font-bold text-primary-accent">99.8%</span>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">SLA Met</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl space-y-1">
                <span className="text-2xl font-bold text-gold-accent">1.2m</span>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Response</p>
              </div>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-3 bg-background/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary-accent/15 flex items-center justify-center text-primary-accent text-xs font-bold font-mono">
                    JD
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">John Doe</h4>
                    <p className="text-[9px] text-muted-foreground">john@company.com</p>
                  </div>
                </div>
                <span className="text-[9px] bg-primary-accent/10 border border-primary-accent/30 text-primary-accent px-2 py-0.5 rounded font-bold uppercase font-mono">
                  Billing
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                &quot;Can we schedule an upgrade to the support package before the next billing cycle?&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Chat Capabilities Section */}
      <section id="chat-capabilities" className="max-w-7xl mx-auto px-6 py-20 border-t border-border/60 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold tracking-widest text-primary-accent uppercase font-mono">Core Capability</span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Complete Real-Time Chat Infrastructure</h2>
          <p className="text-muted-foreground text-md leading-relaxed">
            ZConnect provides a decoupled customer chat widget and ticketing dashboard built for modern enterprise pipelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: Customer Chat Widget */}
          <div className={`premium-card bg-card p-8 space-y-6 flex flex-col justify-between transition-all ${simulatorView === 'widget' ? 'ring-2 ring-primary-accent/50' : ''}`}>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-primary-accent/10 text-primary-accent flex items-center justify-center">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">1. Floating Client Widget</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Embed a responsive floating chat widget directly on your site. Users can search FAQs, resolve issues, or hand off to a live human operator — all without leaving the page.
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 pt-1">
                <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> Quick Reply Suggestion Chips</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> Real-Time animated message status</li>
              </ul>
            </div>
            <button
              onClick={() => setSimulatorView(v => v === 'widget' ? null : 'widget')}
              className={`text-xs font-bold font-mono uppercase tracking-wider py-2.5 rounded-lg transition-all w-full flex items-center justify-center gap-2 cursor-pointer border ${
                simulatorView === 'widget'
                  ? 'bg-primary-accent text-primary-accent-foreground border-primary-accent'
                  : 'bg-card text-muted-foreground border-border hover:border-primary-accent/50 hover:text-foreground'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              {simulatorView === 'widget' ? 'Hide Preview' : 'Preview Widget'}
            </button>
          </div>

          {/* Card 2: Agent Console Workspace */}
          <div className={`premium-card bg-card p-8 space-y-6 flex flex-col justify-between transition-all ${simulatorView === 'agent' ? 'ring-2 ring-gold-accent/50' : ''}`}>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-xl bg-gold-accent/10 text-gold-accent flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">2. Agent Ticketing Console</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Equip your support operators with a comprehensive, lightning-fast dashboard. Track incoming sessions, filter tickets by status, and respond with canned templates.
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 pt-1">
                <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> Priority SLA flags &amp; categorization</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> AutoComplete canned shortcut replies</li>
              </ul>
            </div>
            <button
              onClick={() => setSimulatorView(v => v === 'agent' ? null : 'agent')}
              className={`text-xs font-bold font-mono uppercase tracking-wider py-2.5 rounded-lg transition-all w-full flex items-center justify-center gap-2 cursor-pointer border ${
                simulatorView === 'agent'
                  ? 'bg-gold-accent text-white border-gold-accent'
                  : 'bg-card text-muted-foreground border-border hover:border-gold-accent/50 hover:text-foreground'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              {simulatorView === 'agent' ? 'Hide Preview' : 'Preview Console'}
            </button>
          </div>
        </div>

        {/* Inline Simulator Panel */}
        {simulatorView && (
          <div className="max-w-4xl mx-auto w-full border border-border rounded-2xl overflow-hidden shadow-2xl bg-card mt-4">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <ZConnectLogo size={24} />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {simulatorView === 'widget' ? 'User Widget Preview' : 'Agent Console Preview'}
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {simulatorView === 'widget' ? 'Live interactive widget simulation' : 'Live inbox & ticket console simulation'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetSimulator}
                  className="text-xs border border-border bg-card hover:bg-muted text-foreground font-mono font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  onClick={() => setSimulatorView(null)}
                  className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Widget Panel */}
            {simulatorView === 'widget' && (
              <div className="p-6">
                <div className="flex justify-between items-center px-1 mb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">User Widget Screen</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="w-full max-w-sm mx-auto h-[520px] bg-background border border-border rounded-xl shadow-xl flex flex-col overflow-hidden">
                  <div className="p-4 bg-primary-accent text-primary-accent-foreground flex items-center gap-2 shrink-0">
                    {widgetMode !== 'faq' && !userCreatedTicketId && (
                      <button onClick={() => setWidgetMode('faq')} className="hover:opacity-85 text-white p-1"><ArrowLeft className="h-4 w-4" /></button>
                    )}
                    <div className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center"><ZConnectLogo size={16} /></div>
                    <div>
                      <h3 className="text-[11px] font-bold">Support Chat Hub</h3>
                      <p className="text-[9px] opacity-75">Customer Chat Widget</p>
                    </div>
                  </div>
                  {widgetMode === 'faq' && (
                    <div className="flex-1 p-4 space-y-4 flex flex-col overflow-hidden">
                      <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input type="text" placeholder="Search top questions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none" />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                        {simFaqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase())).map(faq => (
                          <div key={faq.id} className="border border-border bg-card rounded-lg overflow-hidden text-xs">
                            <button onClick={() => setFaqExpanded(faqExpanded === faq.id ? null : faq.id)} className="w-full text-left px-3.5 py-2.5 font-semibold hover:bg-muted/40 flex justify-between items-center text-foreground">
                              <span>{faq.q}</span><span>{faqExpanded === faq.id ? '−' : '+'}</span>
                            </button>
                            {faqExpanded === faq.id && <p className="px-3.5 pb-2.5 text-muted-foreground border-t border-border/20 pt-1.5 leading-relaxed">{faq.a}</p>}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setWidgetMode('prechat')} className="w-full py-2.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-bold rounded-lg font-mono uppercase tracking-wider transition-colors shrink-0 cursor-pointer">Submit Support Ticket</button>
                    </div>
                  )}
                  {widgetMode === 'prechat' && (
                    <form onSubmit={handleUserPrechatSubmit} className="flex-1 p-4 space-y-3.5 flex flex-col justify-between overflow-y-auto">
                      <div className="space-y-3">
                        <div><h4 className="text-xs font-bold text-foreground">Introduce Yourself</h4><p className="text-[9px] text-muted-foreground mt-0.5">Let operators know who is initiating this request.</p></div>
                        <div className="space-y-1"><label className="text-[8px] font-bold text-muted-foreground uppercase">Full Name</label><input type="text" placeholder="John Smith" value={userWidgetForm.name} onChange={(e) => setUserWidgetForm({ ...userWidgetForm, name: e.target.value })} className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none text-foreground" required /></div>
                        <div className="space-y-1"><label className="text-[8px] font-bold text-muted-foreground uppercase">Email Address</label><input type="email" placeholder="john@company.com" value={userWidgetForm.email} onChange={(e) => setUserWidgetForm({ ...userWidgetForm, email: e.target.value })} className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none text-foreground" required /></div>
                      </div>
                      <button type="submit" className="w-full py-2.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-bold rounded-lg font-mono uppercase tracking-wider transition-colors mt-2 cursor-pointer">Next Options</button>
                    </form>
                  )}
                  {widgetMode === 'handover' && (
                    <form onSubmit={handleUserHandoverSubmit} className="flex-1 p-4 space-y-3 flex flex-col justify-between overflow-y-auto">
                      <div className="space-y-3">
                        <div><h4 className="text-xs font-bold text-foreground">Ticket Details</h4><p className="text-[9px] text-muted-foreground mt-0.5">Describe your inquiry.</p></div>
                        <div className="space-y-1"><label className="text-[8px] font-bold text-muted-foreground uppercase">Subject</label><input type="text" placeholder="What can we help with?" value={userWidgetForm.subject} onChange={(e) => setUserWidgetForm({ ...userWidgetForm, subject: e.target.value })} className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none text-foreground" required /></div>
                        <div className="space-y-1"><label className="text-[8px] font-bold text-muted-foreground uppercase">Category</label>
                          <select value={userWidgetForm.category} onChange={(e) => setUserWidgetForm({ ...userWidgetForm, category: e.target.value })} className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none text-foreground">
                            <option value="general">General Support</option><option value="billing">Payments &amp; Billing</option><option value="technical">Technical Bug</option>
                          </select>
                        </div>
                        <div className="space-y-1"><label className="text-[8px] font-bold text-muted-foreground uppercase">Message</label><textarea placeholder="Type initial details..." value={userWidgetForm.message} onChange={(e) => setUserWidgetForm({ ...userWidgetForm, message: e.target.value })} className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none text-foreground min-h-[60px] resize-none" required /></div>
                      </div>
                      <button type="submit" className="w-full py-2.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-bold rounded-lg font-mono uppercase tracking-wider transition-colors cursor-pointer">Create Ticket</button>
                    </form>
                  )}
                  {widgetMode === 'chat' && userCreatedTicketId && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="bg-muted/40 border-b border-border/60 px-4 py-1.5 text-[9px] text-muted-foreground flex justify-between shrink-0 font-mono">
                        <span>Ticket: {userCreatedTicketId}</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Open</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-background/50">
                        {simMessages.filter(m => m.ticketId === userCreatedTicketId).map((m, idx) => {
                          const isUser = m.sender === 'user';
                          return (
                            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${isUser ? 'rounded-br-none bg-primary-accent text-primary-accent-foreground' : 'rounded-bl-none bg-card border border-border text-foreground'}`}>
                                <p className="whitespace-pre-wrap">{m.text}</p>
                                <span className={`block text-[8px] text-right mt-1 font-mono ${isUser ? 'opacity-70' : 'text-muted-foreground'}`}>{m.time}</span>
                              </div>
                            </div>
                          );
                        })}
                        {widgetTyping && (
                          <div className="flex justify-start"><div className="bg-card border border-border rounded-xl rounded-tl-none px-3.5 py-2 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-100" /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-200" /></div></div>
                        )}
                        <div ref={userScrollRef} />
                      </div>
                      <form onSubmit={handleUserWidgetSend} className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0">
                        <input type="text" placeholder="Reply to agent..." value={userWidgetInput} onChange={(e) => setUserWidgetInput(e.target.value)} className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none" />
                        <button type="submit" disabled={!userWidgetInput.trim()} className="bg-primary-accent text-primary-accent-foreground p-1.5 rounded-lg hover:brightness-110 disabled:opacity-40 transition-colors cursor-pointer"><Send className="h-3.5 w-3.5" /></button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Agent Panel */}
            {simulatorView === 'agent' && (
              <div className="p-6">
                <div className="flex justify-between items-center px-1 mb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">Operator Dashboard</span>
                  <span className="text-[10px] text-primary-accent font-bold">Inbox Console View</span>
                </div>
                <div className="w-full h-[520px] bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden">
                  <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-primary-accent flex items-center justify-center"><ZConnectLogo size={12} /></div>
                      <span className="text-[11px] font-bold text-foreground">ZConnect Inbox Console</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground font-mono font-bold">Node ID: LANDING_SANDBOX</div>
                  </div>
                  <div className="flex-1 flex overflow-hidden">
                    <div className="w-52 border-r border-border flex flex-col overflow-hidden bg-muted/10 shrink-0">
                      <div className="p-2 border-b border-border flex gap-1 shrink-0">
                        <button onClick={() => setAgentInboxFilter(agentInboxFilter === 'all' ? 'open' : 'all')} className={`text-[8px] font-bold border border-border px-2 py-0.5 rounded flex items-center gap-1 ${agentInboxFilter !== 'all' ? 'bg-primary-accent/15 border-primary-accent text-primary-accent' : 'bg-card text-muted-foreground'}`}>
                          <Filter className="h-2.5 w-2.5" /> Filter Open
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                        {tickets.filter(t => agentInboxFilter === 'all' || t.status === 'open').map(t => {
                          const isSelected = selectedTicketId === t.id;
                          return (
                            <button key={t.id} onClick={() => setSelectedTicketId(t.id)} className={`w-full text-left p-2 rounded-lg border transition-all flex flex-col gap-0.5 ${isSelected ? 'border-primary-accent bg-primary-accent/5' : 'border-border bg-card hover:bg-muted/30'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-[9px] text-foreground truncate max-w-[90px]">{t.userName}</span>
                                {t.priority && <span className="bg-yellow-500/10 text-yellow-500 text-[7px] font-bold px-1 rounded font-mono">SLA</span>}
                              </div>
                              <span className="text-[8px] text-muted-foreground truncate font-mono">{t.subject}</span>
                              <div className="flex justify-between items-center text-[7px] text-muted-foreground mt-0.5">
                                <span className="capitalize font-mono">{t.category}</span>
                                <span className={`font-bold ${t.status === 'resolved' ? 'text-green-500' : 'text-primary-accent'}`}>{t.status}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden bg-background/30">
                      {selectedTicketId ? (() => {
                        const activeTicket = tickets.find(t => t.id === selectedTicketId);
                        if (!activeTicket) return null;
                        return (
                          <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-3 border-b border-border bg-card flex items-center justify-between shrink-0">
                              <div className="overflow-hidden">
                                <h4 className="text-xs font-bold text-foreground truncate">{activeTicket.subject}</h4>
                                <p className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate">User: {activeTicket.userName} ({activeTicket.userEmail})</p>
                              </div>
                              {activeTicket.status === 'open' ? (
                                <button onClick={() => handleAgentResolve(activeTicket.id)} className="bg-green-500 hover:bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0 cursor-pointer"><Check className="h-3 w-3" /> Resolve</button>
                              ) : (
                                <span className="bg-green-500/10 text-green-500 border border-green-500/25 px-2 py-0.5 rounded text-[7px] font-bold font-mono tracking-wider shrink-0 uppercase">Resolved</span>
                              )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-background/20">
                              {simMessages.filter(m => m.ticketId === activeTicket.id).map((m, idx) => {
                                const isAgent = m.sender === 'agent';
                                return (
                                  <div key={idx} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${isAgent ? 'rounded-br-none bg-primary-accent text-primary-accent-foreground' : 'rounded-bl-none bg-card border border-border text-foreground'}`}>
                                      <p className="whitespace-pre-wrap">{m.text}</p>
                                      <span className={`block text-[8px] text-right mt-1 font-mono ${isAgent ? 'opacity-70' : 'text-muted-foreground'}`}>{m.time}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {agentTyping && (
                                <div className="flex justify-start"><div className="bg-card border border-border rounded-xl rounded-tl-none px-3.5 py-2 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-100" /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-200" /></div></div>
                              )}
                              <div ref={agentScrollRef} />
                            </div>
                            {activeTicket.status === 'open' ? (
                              <form onSubmit={handleAgentConsoleSend} className="p-2.5 border-t border-border bg-card flex gap-2 shrink-0 items-center">
                                <input type="text" placeholder="Type operator reply..." value={agentInput} onChange={(e) => setAgentInput(e.target.value)} className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                                <button type="submit" disabled={!agentInput.trim()} className="bg-primary-accent text-primary-accent-foreground p-1.5 rounded-lg hover:brightness-110 disabled:opacity-40 transition-colors cursor-pointer"><Send className="h-3.5 w-3.5" /></button>
                              </form>
                            ) : (
                              <div className="p-2 bg-muted/40 border-t border-border text-center text-[9px] text-muted-foreground font-semibold shrink-0">Ticket marked resolved.</div>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 text-center p-6 space-y-1">
                          <MessageSquare className="h-8 w-8 opacity-20" />
                          <p className="text-xs font-bold font-mono uppercase">Console Standby</p>
                          <p className="text-[9px]">Select a ticket to reply.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Platform Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 border-t border-border/60 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-bold tracking-widest text-primary-accent uppercase font-mono">Platform Ecosystem</span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Cohesive Support Infrastructure</h2>
          <p className="text-muted-foreground text-md leading-relaxed">
            Every layer of the ZConnect ecosystem is aligned to deliver a modern, cohesive experience for operators and clients.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="premium-card bg-card p-8 space-y-4">
            <div className="h-10 w-10 rounded-xl bg-primary-accent/10 text-primary-accent flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">FAQ Deflection Engine</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Create and order category-based FAQ topics. These topics resolve common questions automatically within the widget, deflecting up to 40% of standard ticket loads.
            </p>
          </div>

          <div className="premium-card bg-card p-8 space-y-4">
            <div className="h-10 w-10 rounded-xl bg-gold-accent/10 text-gold-accent flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Dynamic Tenant Configurations</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Configure parameters such as widget titles, default modes, bot names, and feature access permissions. Adapt widget settings instantly for individual client domain names.
            </p>
          </div>

          <div className="premium-card bg-card p-8 space-y-4">
            <div className="h-10 w-10 rounded-xl bg-primary-accent/10 text-primary-accent flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">HMAC Verification</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Verify end-user identities using secure HMAC-SHA256 signatures generated server-side. Secure priority routing and SLA validations automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Theme Playground */}
      <section id="playground" className="max-w-7xl mx-auto px-6 py-20 border-t border-border/60 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-bold tracking-widest text-primary-accent uppercase font-mono">Customization Options</span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dynamic Brand Alignment</h2>
          <p className="text-muted-foreground text-md leading-relaxed">
            Allow your tenants to match ZConnect directly to their website styling. Test how theme selectors and accent presets adapt components immediately.
          </p>
        </div>

        <div className="premium-card bg-card max-w-4xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Controls Panel */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">Theme Mode</h3>
              <div className="flex gap-2 bg-muted p-1 rounded-xl border border-border">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    theme === 'light' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    theme === 'dark' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    theme === 'system' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  System
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">Accent Colors</h3>
              <div className="grid grid-cols-4 gap-2">
                {presets.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setAccent(p.value)}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex flex-col items-center gap-1 capitalize ${
                      accent === p.value
                        ? 'border-primary-accent bg-primary-accent/10 text-primary-accent'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
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
                            : '#F43F5E'
                      }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-primary-accent/5 border border-primary-accent/20 p-4 rounded-xl flex gap-3 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-primary-accent shrink-0 mt-0.5" />
              <span>
                Theme configuration changes propagate globally and persist in local cache storage, ensuring zero configuration lag.
              </span>
            </div>
          </div>

          {/* Real-time styled card preview */}
          <div className="border border-border rounded-xl overflow-hidden bg-background shadow-lg transition-colors p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-primary-accent flex items-center justify-center text-primary-accent-foreground text-[10px] font-bold">
                  ZC
                </div>
                <span className="text-xs font-bold text-foreground">Interactive Demo</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-primary-accent animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Accent Badges</span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-primary-accent/15 text-primary-accent text-[9px] font-semibold">
                  Active Agent
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gold-accent/15 text-gold-accent text-[9px] font-semibold">
                  Priority SLA
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider font-mono">Buttons & Focus Rings</span>
              <div className="flex gap-2">
                <button className="bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex-1 shadow-sm">
                  Primary Action
                </button>
                <button className="border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-muted-foreground">Uploading sync data...</span>
                <span className="text-primary-accent">75%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary-accent h-1.5 rounded-full transition-all duration-500" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Trust Section */}
      <section id="security" className="max-w-7xl mx-auto px-6 py-20 border-t border-border/60 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Shield className="h-10 w-10 text-primary-accent mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Decoupled Security Integrity</h2>
          <p className="text-muted-foreground text-sm md:text-md leading-relaxed max-w-2xl mx-auto">
            ZConnect uses secure, isolated backend nodes. Client authorization signatures are verified using cryptographically secure HMAC-SHA256 tokens, and referrer origins are strictly sanitized to prevent injection threats.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <ZConnectLogo showText size={28} />
          <p>&copy; {new Date().getFullYear()} Zorvik Technologies Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-foreground cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
          </div>
        </div>
      </footer>

      {/* Simulator is now inline within the Core Capabilities section above */}
      <AnimatePresence>
        {showSimulator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col p-6 overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between border-b border-border pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <ZConnectLogo size={32} />
                <div>
                  <h2 className="text-lg font-bold text-foreground">Live Support Ticketing Simulator</h2>
                  <p className="text-xs text-muted-foreground">Real-time side-by-side workspace simulation</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleResetSimulator}
                  className="text-xs border border-border bg-card hover:bg-muted text-foreground font-mono font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Reset Sandbox
                </button>
                <button
                  onClick={() => setShowSimulator(false)}
                  className="h-10 w-10 rounded-full border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Simulator Body Workspace */}
            <div className="max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
              
              {/* USER WIDGET PANEL (4 COLS) */}
              <div className="lg:col-span-4 space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">1. User Widget Screen</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>

                <div className="w-full h-[520px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
                  
                  {/* Widget Header */}
                  <div className="p-4 bg-primary-accent text-primary-accent-foreground flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      {widgetMode !== 'faq' && !userCreatedTicketId && (
                        <button onClick={() => setWidgetMode('faq')} className="hover:opacity-85 text-white p-1">
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                      )}
                      <div className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center">
                        <ZConnectLogo size={16} />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-bold">Support Chat Hub</h3>
                        <p className="text-[9px] opacity-75">Customer Chat Widget</p>
                      </div>
                    </div>
                  </div>

                  {/* Widget Body FAQ Mode */}
                  {widgetMode === 'faq' && (
                    <div className="flex-1 p-4 space-y-4 flex flex-col overflow-hidden">
                      <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search top questions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none"
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                        {simFaqs
                          .filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(faq => (
                            <div key={faq.id} className="border border-border bg-card rounded-lg overflow-hidden text-xs">
                              <button
                                onClick={() => setFaqExpanded(faqExpanded === faq.id ? null : faq.id)}
                                className="w-full text-left px-3.5 py-2.5 font-semibold hover:bg-muted/40 flex justify-between items-center text-foreground"
                              >
                                <span>{faq.q}</span>
                                <span>{faqExpanded === faq.id ? '−' : '+'}</span>
                              </button>
                              {faqExpanded === faq.id && (
                                <p className="px-3.5 pb-2.5 text-muted-foreground border-t border-border/20 pt-1.5 leading-relaxed">
                                  {faq.a}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>

                      <button
                        onClick={() => setWidgetMode('prechat')}
                        className="w-full py-2.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-bold rounded-lg font-mono uppercase tracking-wider transition-colors shrink-0 cursor-pointer"
                      >
                        Submit Support Ticket
                      </button>
                    </div>
                  )}

                  {/* Widget Body Prechat Mode */}
                  {widgetMode === 'prechat' && (
                    <form onSubmit={handleUserPrechatSubmit} className="flex-1 p-4 space-y-3.5 flex flex-col justify-between overflow-y-auto">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Introduce Yourself</h4>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Let operators know who is initiating this request.</p>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Full Name</label>
                          <input
                            type="text"
                            placeholder="John Smith"
                            value={userWidgetForm.name}
                            onChange={(e) => setUserWidgetForm({ ...userWidgetForm, name: e.target.value })}
                            className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-accent/30 text-foreground"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Email Address</label>
                          <input
                            type="email"
                            placeholder="john@company.com"
                            value={userWidgetForm.email}
                            onChange={(e) => setUserWidgetForm({ ...userWidgetForm, email: e.target.value })}
                            className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-accent/30 text-foreground"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-bold rounded-lg font-mono uppercase tracking-wider transition-colors mt-2 cursor-pointer"
                      >
                        Next Options
                      </button>
                    </form>
                  )}

                  {/* Widget Body Handover Form Mode */}
                  {widgetMode === 'handover' && (
                    <form onSubmit={handleUserHandoverSubmit} className="flex-1 p-4 space-y-3.5 flex flex-col justify-between overflow-y-auto">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Ticket Details</h4>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Describe your inquiry to open a live session.</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Subject</label>
                          <input
                            type="text"
                            placeholder="What can we help you with?"
                            value={userWidgetForm.subject}
                            onChange={(e) => setUserWidgetForm({ ...userWidgetForm, subject: e.target.value })}
                            className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-accent/30 text-foreground"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Category</label>
                          <select
                            value={userWidgetForm.category}
                            onChange={(e) => setUserWidgetForm({ ...userWidgetForm, category: e.target.value })}
                            className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-accent/30 text-foreground"
                          >
                            <option value="general">General Support</option>
                            <option value="billing">Payments & Billing</option>
                            <option value="technical">Technical Bug</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">Message</label>
                          <textarea
                            placeholder="Type initial message details..."
                            value={userWidgetForm.message}
                            onChange={(e) => setUserWidgetForm({ ...userWidgetForm, message: e.target.value })}
                            className="w-full bg-card border border-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-accent/30 text-foreground min-h-[60px] resize-none"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground text-xs font-bold rounded-lg font-mono uppercase tracking-wider transition-colors mt-2 cursor-pointer"
                      >
                        Create Ticket
                      </button>
                    </form>
                  )}

                  {/* Widget Body Chat Mode */}
                  {widgetMode === 'chat' && userCreatedTicketId && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="bg-muted/40 border-b border-border/60 px-4 py-1.5 text-[9px] text-muted-foreground flex justify-between shrink-0 font-mono">
                        <span>Ticket: {userCreatedTicketId}</span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          Open
                        </span>
                      </div>

                      {/* Message scroll thread */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-background/50">
                        {simMessages
                          .filter(m => m.ticketId === userCreatedTicketId)
                          .map((m, idx) => {
                            const isUser = m.sender === 'user';
                            return (
                              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                    isUser
                                      ? 'rounded-br-none bg-primary-accent text-primary-accent-foreground shadow-sm'
                                      : 'rounded-bl-none bg-card border border-border text-foreground'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap">{m.text}</p>
                                  <span className={`block text-[8px] text-right mt-1 font-mono ${isUser ? 'opacity-70' : 'text-muted-foreground'}`}>
                                    {m.time}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                        {widgetTyping && (
                          <div className="flex justify-start">
                            <div className="bg-card border border-border rounded-xl rounded-tl-none px-3.5 py-2 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"></span>
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-100"></span>
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-200"></span>
                            </div>
                          </div>
                        )}
                        <div ref={userScrollRef} />
                      </div>

                      {/* Input Form */}
                      <form onSubmit={handleUserWidgetSend} className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          placeholder="Reply to agent..."
                          value={userWidgetInput}
                          onChange={(e) => setUserWidgetInput(e.target.value)}
                          className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!userWidgetInput.trim()}
                          className="bg-primary-accent text-primary-accent-foreground p-1.5 rounded-lg hover:brightness-110 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              {/* AGENT SIDE PANEL (8 COLS) */}
              <div className="lg:col-span-8 space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono tracking-wider">2. Operator Dashboard</span>
                  <span className="text-[10px] text-primary-accent font-bold">Inbox Console view</span>
                </div>

                <div className="w-full h-[520px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
                  
                  {/* Top Mini Header */}
                  <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-primary-accent flex items-center justify-center text-primary-accent-foreground">
                        <ZConnectLogo size={12} />
                      </div>
                      <span className="text-[11px] font-bold text-foreground">ZConnect Inbox Console</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground font-mono font-bold">
                      Node ID: LANDING_SANDBOX
                    </div>
                  </div>

                  {/* Split Workspace */}
                  <div className="flex-1 flex overflow-hidden">
                    
                    {/* Inbox Left List Column */}
                    <div className="w-44 md:w-48 border-r border-border flex flex-col overflow-hidden bg-muted/10 shrink-0">
                      <div className="p-2 border-b border-border flex gap-1 shrink-0">
                        <button
                          onClick={() => setAgentInboxFilter(agentInboxFilter === 'all' ? 'open' : 'all')}
                          className={`text-[8px] font-bold border border-border px-2 py-0.5 rounded flex items-center gap-1 ${agentInboxFilter !== 'all' ? 'bg-primary-accent/15 border-primary-accent text-primary-accent' : 'bg-card text-muted-foreground'}`}
                        >
                          <Filter className="h-2.5 w-2.5" />
                          Filter Open
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                        {tickets
                          .filter(t => agentInboxFilter === 'all' || t.status === 'open')
                          .map(t => {
                            const isSelected = selectedTicketId === t.id;
                            return (
                              <button
                                key={t.id}
                                onClick={() => setSelectedTicketId(t.id)}
                                className={`w-full text-left p-2 rounded-lg border transition-all flex flex-col gap-0.5 ${isSelected ? 'border-primary-accent bg-primary-accent/5' : 'border-border bg-card hover:bg-muted/30'}`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-[9px] text-foreground truncate max-w-[80px]">{t.userName}</span>
                                  {t.priority && (
                                    <span className="bg-yellow-500/10 text-yellow-500 text-[7px] font-bold px-1 rounded font-mono">SLA</span>
                                  )}
                                </div>
                                <span className="text-[8px] text-muted-foreground truncate font-mono">{t.subject}</span>
                                <div className="flex justify-between items-center text-[7px] text-muted-foreground mt-0.5">
                                  <span className="capitalize font-mono">{t.category}</span>
                                  <span className={`font-bold ${t.status === 'resolved' ? 'text-green-500' : 'text-primary-accent'}`}>{t.status}</span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Conversation Chat Right Column */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-background/30">
                      {selectedTicketId ? (
                        (() => {
                          const activeTicket = tickets.find(t => t.id === selectedTicketId);
                          if (!activeTicket) return null;
                          return (
                            <div className="flex-1 flex flex-col overflow-hidden">
                              {/* Thread header */}
                              <div className="p-3 border-b border-border bg-card flex items-center justify-between shrink-0">
                                <div className="overflow-hidden">
                                  <h4 className="text-xs font-bold text-foreground truncate">{activeTicket.subject}</h4>
                                  <p className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate">
                                    User: {activeTicket.userName} ({activeTicket.userEmail})
                                  </p>
                                </div>
                                
                                {activeTicket.status === 'open' ? (
                                  <button
                                    onClick={() => handleAgentResolve(activeTicket.id)}
                                    className="bg-green-500 hover:bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0 cursor-pointer"
                                  >
                                    <Check className="h-3 w-3" />
                                    Resolve
                                  </button>
                                ) : (
                                  <span className="bg-green-500/10 text-green-500 border border-green-500/25 px-2 py-0.5 rounded text-[7px] font-bold font-mono tracking-wider shrink-0 uppercase">
                                    Resolved
                                  </span>
                                )}
                              </div>

                              {/* Message History thread */}
                              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-background/20">
                                {simMessages
                                  .filter(m => m.ticketId === activeTicket.id)
                                  .map((m, idx) => {
                                    const isAgent = m.sender === 'agent';
                                    return (
                                      <div key={idx} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                          className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                            isAgent
                                              ? 'rounded-br-none bg-primary-accent text-primary-accent-foreground shadow-sm'
                                              : 'rounded-bl-none bg-card border border-border text-foreground'
                                          }`}
                                        >
                                          <p className="whitespace-pre-wrap">{m.text}</p>
                                          <span className={`block text-[8px] text-right mt-1 font-mono ${isAgent ? 'opacity-70' : 'text-muted-foreground'}`}>
                                            {m.time}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                
                                {agentTyping && (
                                  <div className="flex justify-start">
                                    <div className="bg-card border border-border rounded-xl rounded-tl-none px-3.5 py-2 flex items-center gap-1.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"></span>
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-100"></span>
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce delay-200"></span>
                                    </div>
                                  </div>
                                )}
                                <div ref={agentScrollRef} />
                              </div>

                              {/* Agent input form */}
                              {activeTicket.status === 'open' ? (
                                <form onSubmit={handleAgentConsoleSend} className="p-2.5 border-t border-border bg-card flex gap-2 shrink-0 items-center">
                                  <input
                                    type="text"
                                    placeholder="Type operator reply..."
                                    value={agentInput}
                                    onChange={(e) => setAgentInput(e.target.value)}
                                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                                  />
                                  <button
                                    type="submit"
                                    disabled={!agentInput.trim()}
                                    className="bg-primary-accent text-primary-accent-foreground p-1.5 rounded-lg hover:brightness-110 disabled:opacity-40 transition-colors cursor-pointer"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </button>
                                </form>
                              ) : (
                                <div className="p-2 bg-muted/40 border-t border-border text-center text-[9px] text-muted-foreground font-semibold shrink-0">
                                  Ticket marked resolved.
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 text-center p-6 space-y-1">
                          <MessageSquare className="h-8 w-8 opacity-20" />
                          <p className="text-xs font-bold font-mono uppercase">Console Standby</p>
                          <p className="text-[9px]">Select a ticket from the left inbox listing to reply.</p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
