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
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { ZConnectLogo } from '../../../components/ZConnectLogo';
import { useTheme } from '../../ThemeProvider';

// Custom Brand Icons
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

const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.093.252-.19.37-.287a.075.075 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.098.245.195.372.288a.077.077 0 0 1-.006.128 12.299 12.299 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
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

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live Test Dispatcher state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; status: number; durationMs: number; response: string } | null>(null);

  // Modal Form State
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

  const platformSpecs = [
    {
      id: 'slack',
      name: 'Slack',
      authLabel: 'Authenticate with Slack',
      desc: 'Connect your Slack workspace to receive real-time ticket alerts & channel notifications.',
      colorClass: 'bg-[#4A154B] hover:bg-[#3F113F] text-white',
      borderClass: 'border-[#4A154B]/40 hover:border-[#4A154B]',
      icon: SlackIcon,
      placeholderUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
    },
    {
      id: 'discord',
      name: 'Discord',
      authLabel: 'Authenticate with Discord',
      desc: 'Link your Discord server to forward customer messages & resolved ticket alerts.',
      colorClass: 'bg-[#5865F2] hover:bg-[#4752C4] text-white',
      borderClass: 'border-[#5865F2]/40 hover:border-[#5865F2]',
      icon: DiscordIcon,
      placeholderUrl: 'https://discord.com/api/webhooks/123456/abcdef...',
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      authLabel: 'Authenticate with MS Teams',
      desc: 'Connect MS Teams channels to receive interactive card notifications on chat activity.',
      colorClass: 'bg-[#6264A7] hover:bg-[#464775] text-white',
      borderClass: 'border-[#6264A7]/40 hover:border-[#6264A7]',
      icon: Layers,
      placeholderUrl: 'https://outlook.office.com/webhook/...',
    },
    {
      id: 'telegram',
      name: 'Telegram Bot',
      authLabel: 'Authenticate with Telegram',
      desc: 'Dispatch automated chat notifications directly to your Telegram group or channel.',
      colorClass: 'bg-[#229ED9] hover:bg-[#1A7CA7] text-white',
      borderClass: 'border-[#229ED9]/40 hover:border-[#229ED9]',
      icon: Send,
      placeholderUrl: 'https://api.telegram.org/bot123456:ABC.../sendMessage?chat_id=-100...',
    },
    {
      id: 'custom_webhook',
      name: 'Custom Webhook',
      authLabel: 'Authenticate Webhook',
      desc: 'Post HMAC-signed JSON event payloads to your custom backend or API gateway.',
      colorClass: 'bg-primary-accent hover:bg-primary-accent/90 text-primary-accent-foreground',
      borderClass: 'border-primary-accent/40 hover:border-primary-accent',
      icon: Globe,
      placeholderUrl: 'https://yourdomain.com/api/webhooks/zconnect',
    },
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

  // 3. Open OAuth / Authentication Modal
  const openAuthenticateModal = (platform: Integration['ti_platform']) => {
    const spec = platformSpecs.find((p) => p.id === platform);
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

  // 4. Dispatch Live Test Payload ("⚡ Send Test Payload")
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

  // 5. Submit Integration Authorization Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;
    if (!form.webhookUrl.trim()) {
      alert('Webhook / Authorization URL is required.');
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
        alert(data.error || 'Failed to authorize integration');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to authorize integration');
    } finally {
      setSaving(false);
    }
  };

  // 6. Delete Integration
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

  const selectedSpec = platformSpecs.find((p) => p.id === form.platform);

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
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary-accent" />
              Platform Integrations & Authentication
            </h1>
            <p className="text-xs text-muted-foreground">
              Authenticate and connect external communication platforms (Slack, Discord, MS Teams, Telegram, Webhooks) to your website support chat.
            </p>
          </div>

          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* Connected Platforms Section */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Active Connected Integrations ({integrations.length})
          </h2>

          {loading && integrations.length === 0 ? (
            <div className="flex py-12 items-center justify-center text-muted-foreground text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary-accent" /> Loading integrations...
            </div>
          ) : integrations.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center text-xs text-muted-foreground space-y-2 bg-card/40">
              <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No active platform integrations connected yet.</p>
              <p className="text-[10px] text-muted-foreground">
                Click one of the <strong className="text-primary-accent">Authenticate</strong> buttons below to link Slack, Discord, MS Teams, or Telegram.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((ti) => {
                const spec = platformSpecs.find((p) => p.id === ti.ti_platform);
                const Icon = spec?.icon || Globe;
                const isTestingThis = testingId === ti.ti_id;
                const hasTestResult = testResult && testResult.id === ti.ti_id;

                return (
                  <div
                    key={ti.ti_id}
                    className="border border-border bg-card rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-primary-accent/30 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-11 w-11 rounded-xl bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center shrink-0 text-primary-accent">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <h3 className="text-xs font-bold text-foreground capitalize flex items-center gap-2">
                            {ti.ti_platform.replace('_', ' ')}
                            <span className="text-[8px] bg-green-500/15 border border-green-500/30 text-green-500 font-bold px-1.5 py-0.5 rounded uppercase">
                              Connected & Authenticated
                            </span>
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[240px]">
                            {ti.webhookUrl || ti.ti_config.webhook_url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEditModal(ti)}
                          className="p-2 hover:bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Edit credentials"
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

                    {/* Events & Live Test Dispatcher */}
                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-primary-accent font-semibold uppercase tracking-wider text-[9px] truncate">
                        Events: {ti.ti_config.events.join(', ')}
                      </span>

                      <button
                        onClick={() => handleTestIntegration(ti.ti_id, ti.ti_platform, ti.webhookUrl)}
                        disabled={isTestingThis}
                        className="flex items-center gap-1.5 bg-primary-accent/10 border border-primary-accent/30 text-primary-accent hover:bg-primary-accent/20 px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {isTestingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        Send Test Payload
                      </button>
                    </div>

                    {/* Live Test Result Banner */}
                    {hasTestResult && (
                      <div
                        className={`p-3 rounded-xl border text-[11px] flex items-center justify-between gap-3 ${
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

        {/* Platform OAuth / Authenticate Action Grid */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Authenticate & Connect Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {platformSpecs.map((p) => {
              const Icon = p.icon;
              const isConnected = integrations.some((ti) => ti.ti_platform === p.id);

              return (
                <div
                  key={p.id}
                  className={`border rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all bg-card/60 shadow-sm ${
                    isConnected ? 'border-primary-accent/30 bg-primary-accent/5' : p.borderClass
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-11 w-11 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      {isConnected && (
                        <span className="text-[8px] bg-green-500/15 border border-green-500/30 text-green-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Connected
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>

                  {/* 1-Click Authenticate Action Button */}
                  <button
                    onClick={() => openAuthenticateModal(p.id)}
                    className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${p.colorClass}`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isConnected ? `Re-authenticate ${p.name}` : p.authLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Authenticate & Connect Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-in scale-in duration-150">
            <div className="px-6 py-4 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary-accent" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider capitalize">
                  {isEditing ? 'Re-authenticate' : 'Authenticate & Connect'} {selectedSpec?.name || form.platform}
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
                  {selectedSpec?.name} Authorization / Webhook URL
                </label>
                <input
                  type="url"
                  placeholder={selectedSpec?.placeholderUrl || 'https://...'}
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary-accent/50 font-mono text-[10px]"
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
                    placeholder="#support-notifications"
                    value={form.channelName}
                    onChange={(e) => setForm({ ...form, channelName: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground focus:outline-none focus:border-primary-accent/50"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="block font-bold text-muted-foreground uppercase tracking-wider text-[9px]">
                  Trigger Automated Alerts On Events
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
                  className="px-4 py-2 border border-border hover:bg-muted rounded-xl text-muted-foreground font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${selectedSpec?.colorClass}`}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Authenticate ${selectedSpec?.name}`}
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
