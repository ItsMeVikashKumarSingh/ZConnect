'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Trash2,
  Edit2,
  ArrowLeft,
  Loader2,
  LogOut,
  RefreshCw,
  Layers,
  ShieldAlert,
  Send,
  Plus,
  X,
  Globe,
  Zap,
  Copy,
  Check,
  CheckCircle,
  AlertTriangle,
  Code,
  Sparkles,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { ZConnectLogo } from '../../../components/ZConnectLogo';
import { useTheme } from '../../ThemeProvider';

// Custom SVG Icons
const SlackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="3" height="8" x="13" y="2" rx="1.5" />
    <path d="M19 8.5a1.5 1.5 0 1 1-3 0V5a1.5 1.5 0 1 1 3 0z" />
    <rect width="8" height="3" x="14" y="13" rx="1.5" />
    <path d="M15.5 19a1.5 1.5 0 1 1 0-3H19a1.5 1.5 0 1 1 0 3z" />
    <rect width="3" height="8" x="8" y="14" rx="1.5" />
    <path d="M5 15.5a1.5 1.5 0 1 1 3 0V19a1.5 1.5 0 1 1-3 0z" />
    <rect width="8" height="3" x="2" y="8" rx="1.5" />
    <path d="M8.5 5a1.5 1.5 0 1 1 0 3H5a1.5 1.5 0 1 1 0-3z" />
  </svg>
);

interface Integration {
  ti_id: string;
  ti_platform: 'slack' | 'discord' | 'teams' | 'telegram' | 'custom_webhook';
  ti_type: 'webhook' | 'oauth';
  ti_config: {
    events: string[];
    channel_name?: string | null;
    webhook_url?: string | null;
  };
  webhookUrl?: string;
  ti_status_flag?: boolean;
}

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();

  const [token, setToken] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<'integrations' | 'autoauth'>('integrations');

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live Test Dispatcher state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; status: number; durationMs: number; response: string } | null>(null);

  // Auto-Auth & Site Authorization state
  const [targetUrl, setTargetUrl] = useState('https://studio.zorviktech.com');
  const [autoAuthLoading, setAutoAuthLoading] = useState(false);
  const [autoAuthResult, setAutoAuthResult] = useState<any>(null);
  const [embedTab, setEmbedTab] = useState<'sso' | 'html' | 'react'>('sso');
  const [copiedCode, setCopiedCode] = useState(false);

  // Form State
  const [form, setForm] = useState({
    integrationId: '',
    platform: 'slack' as Integration['ti_platform'],
    type: 'webhook' as Integration['ti_type'],
    webhookUrl: '',
    channelName: '',
    events: ['chat_started', 'message_received', 'ticket_resolved'],
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const platforms = [
    { id: 'slack', name: 'Slack Webhook', desc: 'Post instant notification blocks to your Slack channel.', type: 'webhook', icon: SlackIcon },
    { id: 'discord', name: 'Discord Webhook', desc: 'Send rich colored embeds to your Discord server.', type: 'webhook', icon: Send },
    { id: 'teams', name: 'Microsoft Teams', desc: 'Forward card alerts to Microsoft Teams channels.', type: 'webhook', icon: Layers },
    { id: 'telegram', name: 'Telegram Bot', desc: 'Dispatch chat alerts to a Telegram chat or channel.', type: 'webhook', icon: Send },
    { id: 'custom_webhook', name: 'Outgoing Webhook', desc: 'Post signed JSON event payloads to any custom server URL.', type: 'webhook', icon: Globe }
  ] as const;

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

  // 2. Fetch Integrations
  const fetchIntegrations = async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/integrations?projectId=${projectId}`, { headers });
      const data = await res.json();
      if (data.success) {
        setIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && projectId) fetchIntegrations();
  }, [token, projectId]);

  // 3. Dispatch Live Test Payload ("⚡ Send Test Payload")
  const handleTestIntegration = async (integrationId: string, platform: string, webhookUrl?: string) => {
    if (!token || !projectId) return;
    setTestingId(integrationId);
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          action: 'test',
          platform,
          webhookUrl,
        }),
      });

      const data = await res.json();
      setTestResult({
        id: integrationId,
        success: data.success,
        status: data.status || (data.success ? 200 : 500),
        durationMs: data.durationMs || 0,
        response: data.response || (data.success ? 'OK' : data.error || 'Failed'),
      });
    } catch (err: any) {
      setTestResult({
        id: integrationId,
        success: false,
        status: 500,
        durationMs: 0,
        response: err.message || 'Request failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  // 4. Test Auto-Authenticate Authorization Flow
  const handleAutoAuthorize = async () => {
    if (!projectId) return;
    setAutoAuthLoading(true);
    setAutoAuthResult(null);
    try {
      const query = new URLSearchParams({
        projectId,
        targetUrl,
      });
      const res = await fetch(`/api/widget/authorize?${query.toString()}`);
      const data = await res.json();
      setAutoAuthResult(data);
    } catch (err: any) {
      setAutoAuthResult({ success: false, error: err.message || 'Failed to authorize site' });
    } finally {
      setAutoAuthLoading(false);
    }
  };

  // 5. Open Form Modal
  const openCreateModal = (platform: Integration['ti_platform']) => {
    setForm({
      integrationId: '',
      platform,
      type: 'webhook',
      webhookUrl: '',
      channelName: '',
      events: ['chat_started', 'message_received', 'ticket_resolved'],
    });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const openEditModal = (integration: Integration) => {
    setForm({
      integrationId: integration.ti_id,
      platform: integration.ti_platform,
      type: integration.ti_type,
      webhookUrl: integration.webhookUrl || '',
      channelName: integration.ti_config.channel_name || '',
      events: integration.ti_config.events || ['chat_started', 'message_received', 'ticket_resolved'],
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  // 6. Submit Integration Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;
    if (!form.webhookUrl.trim()) {
      alert('Webhook URL is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          integrationId: form.integrationId || undefined,
          platform: form.platform,
          type: form.type,
          webhookUrl: form.webhookUrl,
          events: form.events,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowFormModal(false);
        fetchIntegrations();
      } else {
        alert(data.error || 'Failed to save integration');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  // 7. Delete Integration
  const handleDelete = async (integrationId: string) => {
    if (!token || !projectId || !confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      const res = await fetch(`/api/integrations?integrationId=${integrationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        fetchIntegrations();
      }
    } catch (err) {
      console.error('Delete integration failed:', err);
    }
  };

  const handleToggleEvent = (event: string) => {
    setForm((prev) => {
      const events = prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event];
      return { ...prev, events };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('zorvik_chat_token');
    router.push('/login');
  };

  if (authChecking) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent tracking-wider">Verifying security clearance...</span>
      </div>
    );
  }

  const ssoSnippet = `<script 
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://zconnect.zorviktech.com'}/widget.js" 
  data-project-id="${projectId}"
  data-auto-auth="true">
</script>`;

  const htmlSnippet = `<iframe 
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://zconnect.zorviktech.com'}/widget?projectId=${projectId}"
  style="width: 380px; height: 600px; border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999;"
  allow="microphone; camera">
</iframe>`;

  const reactSnippet = `import { useEffect } from 'react';

export function ZConnectWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${typeof window !== 'undefined' ? window.location.origin : 'https://zconnect.zorviktech.com'}/widget.js';
    script.setAttribute('data-project-id', '${projectId}');
    script.setAttribute('data-auto-auth', 'true');
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      {/* Header Navbar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard?token=${token}`}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="Return to Inbox"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <ZConnectLogo showText size={25} />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold font-mono text-primary-accent bg-primary-accent/10 border border-primary-accent/20 px-2.5 py-1 rounded-md hidden sm:block">
              Project: {projectId?.slice(0, 8)}...
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-red-400 p-2 font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-8 overflow-y-auto">
        {/* Page Title & Navigation Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary-accent" />
              Integrations & Auto-Auth Hub
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure webhook notifications to Slack/Discord/Teams and manage direct website auto-authentication.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'integrations'
                  ? 'bg-primary-accent text-primary-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-4 w-4" />
              Integrations Hub
            </button>
            <button
              onClick={() => setActiveTab('autoauth')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'autoauth'
                  ? 'bg-primary-accent text-primary-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Auto-Auth & Embed
            </button>
          </div>
        </div>

        {/* TAB 1: INTEGRATIONS HUB */}
        {activeTab === 'integrations' && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* Connected Integrations Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Connected Platforms ({integrations.length})</h2>
                <button
                  onClick={fetchIntegrations}
                  disabled={loading}
                  className="border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loading && integrations.length === 0 ? (
                <div className="flex py-12 items-center justify-center text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-accent" /> Loading integrations...
                </div>
              ) : integrations.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-8 text-center text-xs text-muted-foreground space-y-2 bg-card/40">
                  <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p>No external platform integrations configured for this project yet.</p>
                  <p className="text-[10px] text-muted-foreground/70">Select an integration platform below to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integrations.map((ti) => {
                    const spec = platforms.find((p) => p.id === ti.ti_platform);
                    const Icon = spec?.icon || Globe;
                    const isTestingThis = testingId === ti.ti_id;
                    const hasTestResult = testResult && testResult.id === ti.ti_id;

                    return (
                      <div
                        key={ti.ti_id}
                        className="border border-border bg-card rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-primary-accent/30 transition-all shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center shrink-0 text-primary-accent">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <h3 className="text-xs font-bold text-foreground capitalize flex items-center gap-2">
                                {ti.ti_platform.replace('_', ' ')}
                                <span className="text-[8px] bg-green-500/15 border border-green-500/30 text-green-500 font-bold px-1.5 py-0.5 rounded uppercase">
                                  Active
                                </span>
                              </h3>
                              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">
                                {ti.webhookUrl || ti.ti_config.webhook_url}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => openEditModal(ti)}
                              className="p-2 hover:bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Edit config"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ti.ti_id)}
                              className="p-2 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                              title="Disconnect"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Event Tags & Live Test Dispatcher */}
                        <div className="pt-2 border-t border-border flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-primary-accent font-semibold uppercase tracking-wider text-[9px] truncate">
                            Events: {ti.ti_config.events.join(', ')}
                          </span>

                          <button
                            onClick={() => handleTestIntegration(ti.ti_id, ti.ti_platform, ti.webhookUrl)}
                            disabled={isTestingThis}
                            className="flex items-center gap-1.5 bg-primary-accent/10 border border-primary-accent/30 text-primary-accent hover:bg-primary-accent/20 px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer"
                          >
                            {isTestingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            Send Test Payload
                          </button>
                        </div>

                        {/* Live Test Result Banner */}
                        {hasTestResult && (
                          <div
                            className={`p-3 rounded-lg border text-[11px] flex items-center justify-between gap-3 ${
                              testResult.success
                                ? 'bg-green-500/10 border-green-500/20 text-green-500'
                                : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {testResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                              <span className="font-bold truncate">
                                Status: {testResult.status} ({testResult.response})
                              </span>
                            </div>
                            <span className="font-mono text-[9px] opacity-80 shrink-0">{testResult.durationMs}ms</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Available Platforms Grid */}
            <section className="space-y-4 pt-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available Integration Connectors</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {platforms.map((p) => {
                  const Icon = p.icon;
                  const isConfigured = integrations.some((ti) => ti.ti_platform === p.id);
                  return (
                    <div
                      key={p.id}
                      className={`border rounded-xl p-5 flex flex-col justify-between h-48 hover:border-primary-accent/30 transition-all bg-card/60 ${
                        isConfigured ? 'border-primary-accent/20 bg-primary-accent/5' : 'border-border'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center border border-border text-primary-accent">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          {isConfigured && (
                            <span className="text-[8px] bg-primary-accent/15 border border-primary-accent/30 text-primary-accent font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Configured
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{p.name}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openCreateModal(p.id)}
                        className="mt-4 w-full py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer bg-primary-accent text-primary-accent-foreground hover:bg-primary-accent/90 shadow-sm"
                      >
                        <Plus className="h-3 w-3" />
                        {isConfigured ? 'Add Another Hook' : 'Configure Integration'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: AUTO-AUTH & EMBED GENERATOR */}
        {activeTab === 'autoauth' && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* Auto-Authentication Site Tester Section */}
            <section className="border border-border bg-card rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary-accent" />
                    Auto-Authenticate Website Authorization
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Instantly verify target domain origin and generate pre-signed SSO identity signatures for direct client site integration.
                  </p>
                </div>
              </div>

              {/* URL Input & Auto-Auth Trigger */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary-accent/50 font-mono"
                  />
                </div>
                <button
                  onClick={handleAutoAuthorize}
                  disabled={autoAuthLoading || !targetUrl.trim()}
                  className="bg-primary-accent hover:bg-primary-accent/90 text-primary-accent-foreground px-5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  {autoAuthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Auto Authenticate Website
                </button>
              </div>

              {/* Authorization Test Output */}
              {autoAuthResult && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    autoAuthResult.success
                      ? 'bg-green-500/10 border-green-500/20 text-green-500'
                      : 'bg-red-500/10 border-red-500/20 text-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      {autoAuthResult.success ? <CheckCircle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                      <span>
                        {autoAuthResult.success
                          ? `Domain '${autoAuthResult.targetHost}' Authorized Successfully!`
                          : autoAuthResult.error}
                      </span>
                    </div>
                    {autoAuthResult.success && (
                      <span className="text-[9px] uppercase tracking-wider font-bold bg-green-500/20 border border-green-500/40 px-2 py-0.5 rounded">
                        Origin Validated
                      </span>
                    )}
                  </div>

                  {autoAuthResult.success && (
                    <div className="text-[10px] text-foreground space-y-1 font-mono pt-2 border-t border-green-500/20">
                      <p>
                        <strong>Project:</strong> {autoAuthResult.projectName} ({autoAuthResult.projectId})
                      </p>
                      <p>
                        <strong>Identity Signature:</strong> {autoAuthResult.identity.signature}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Interactive Widget Code Generators */}
            <section className="border border-border bg-card rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Code className="h-4.5 w-4.5 text-primary-accent" />
                    Embed Code Generator
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Copy and paste the snippet onto your website to deploy the ZConnect support widget.
                  </p>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(embedTab === 'sso' ? ssoSnippet : embedTab === 'html' ? htmlSnippet : reactSnippet)
                  }
                  className="flex items-center gap-1.5 bg-primary-accent/10 border border-primary-accent/20 text-primary-accent hover:bg-primary-accent/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              {/* Code Format Switcher */}
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <button
                  onClick={() => setEmbedTab('sso')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    embedTab === 'sso'
                      ? 'bg-primary-accent/15 border border-primary-accent/30 text-primary-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Auto-SSO Script Tag
                </button>
                <button
                  onClick={() => setEmbedTab('html')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    embedTab === 'html'
                      ? 'bg-primary-accent/15 border border-primary-accent/30 text-primary-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  HTML iFrame
                </button>
                <button
                  onClick={() => setEmbedTab('react')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    embedTab === 'react'
                      ? 'bg-primary-accent/15 border border-primary-accent/30 text-primary-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  React / Next.js Component
                </button>
              </div>

              {/* Code Display Area */}
              <pre className="bg-background border border-border p-4 rounded-xl text-xs font-mono text-primary-accent overflow-x-auto custom-scrollbar leading-relaxed">
                <code>{embedTab === 'sso' ? ssoSnippet : embedTab === 'html' ? htmlSnippet : reactSnippet}</code>
              </pre>
            </section>
          </div>
        )}
      </main>

      {/* Integration Configuration Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-in scale-in duration-150">
            <div className="px-6 py-4 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-primary-accent" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider capitalize">
                  {isEditing ? 'Modify' : 'Setup'} {form.platform.replace('_', ' ')}
                </h3>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-muted-foreground uppercase tracking-wider text-[9px]">
                  {form.platform === 'custom_webhook' ? 'Target Post URL' : 'Incoming Webhook URL'}
                </label>
                <input
                  type="url"
                  placeholder={
                    form.platform === 'slack'
                      ? 'https://hooks.slack.com/services/...'
                      : form.platform === 'discord'
                      ? 'https://discord.com/api/webhooks/...'
                      : 'https://yourserver.com/webhook'
                  }
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary-accent/50 font-mono text-[10px]"
                  required
                />
              </div>

              {(form.platform === 'slack' || form.platform === 'discord' || form.platform === 'teams') && (
                <div className="space-y-1">
                  <label className="block font-bold text-muted-foreground uppercase tracking-wider text-[9px]">
                    Channel / Room Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="#support-alerts"
                    value={form.channelName}
                    onChange={(e) => setForm({ ...form, channelName: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary-accent/50"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="block font-bold text-muted-foreground uppercase tracking-wider text-[9px]">
                  Trigger Alerts on Events
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'chat_started', label: 'Ticket / Conversation Created' },
                    { id: 'message_received', label: 'Customer Message Sent' },
                    { id: 'ticket_resolved', label: 'Ticket Status Marked Resolved' },
                  ].map((evt) => (
                    <label key={evt.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(evt.id)}
                        onChange={() => handleToggleEvent(evt.id)}
                        className="rounded border-border text-primary-accent bg-background focus:ring-primary-accent/50"
                      />
                      <span className="text-foreground">{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-border hover:bg-muted rounded-lg text-muted-foreground font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary-accent hover:bg-primary-accent/90 text-primary-accent-foreground font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Integration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
          <span className="mt-2 text-xs font-mono uppercase text-primary-accent tracking-wider">Loading panel...</span>
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
