'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trash2, Edit2, ArrowLeft, Loader2, LogOut, RefreshCw, Layers, ShieldAlert, Send, Plus, X, Globe } from 'lucide-react';
import Link from 'next/link';
import { ZConnectLogo } from '../../../components/ZConnectLogo';
import { useTheme } from '../../ThemeProvider';

// Custom SVG Icons to avoid Lucide version compatibility discrepancies
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
  has_credentials: boolean;
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
    { id: 'custom_webhook', name: 'Outgoing Webhook', desc: 'Post JSON event payloads to any custom server URL.', type: 'webhook', icon: Globe }
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
      const res = await fetch(`/api/dashboard?projectId=${projectId}&action=integrations`, { headers });
      const data = await res.json();
      if (data.success) {
        setIntegrations(data.integrations);
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

  // 3. Open Form for Creation or Editing
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
      webhookUrl: '', // Hide raw credentials
      channelName: integration.ti_config.channel_name || '',
      events: integration.ti_config.events || ['chat_started', 'message_received', 'ticket_resolved'],
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  // 4. Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;

    // Check configuration
    if (!form.webhookUrl.trim() && !isEditing) {
      alert('Webhook URL is required.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        projectId,
        action: 'upsert_integration',
        integrationId: form.integrationId || undefined,
        platform: form.platform,
        type: form.type,
        config: {
          events: form.events,
          channel_name: form.channelName || null,
          webhook_url: form.webhookUrl ? form.webhookUrl : undefined,
        },
      };

      if (form.webhookUrl.trim()) {
        payload.credentials = form.webhookUrl; // Store URL in ti_credentials securely
      }

      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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

  // 5. Delete Integration
  const handleDelete = async (integrationId: string) => {
    if (!token || !projectId || !confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          action: 'delete_integration',
          integrationId,
        }),
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
    setForm(prev => {
      const events = prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
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
      <div className="flex h-screen flex-col bg-[#050510] text-slate-100 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="mt-2 text-xs font-mono uppercase text-purple-500 tracking-wider">Verifying security clearance...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Header */}
      <header className="border-b border-purple-950/40 bg-slate-950/40 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard?token=${token}`}
              className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              title="Return to Inbox"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <ZConnectLogo showText size={25} />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold font-mono text-purple-500 bg-purple-950/30 border border-purple-500/20 px-2.5 py-1 rounded-md hidden sm:block">
              Project Config
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-red-400 p-2 font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-950/20 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <SlackIcon className="h-6 w-6 text-purple-500" />
              Tenant Integrations
            </h1>
            <p className="text-xs text-slate-400">
              Integrate external platforms to notify your team when customers start support threads or send messages.
            </p>
          </div>
          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="self-start md:self-auto border border-purple-950/50 bg-slate-900/50 text-slate-300 hover:text-slate-100 hover:bg-slate-900 px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Currently Connected Integrations */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Connected Platforms</h2>
          
          {loading && integrations.length === 0 ? (
            <div className="flex py-12 items-center justify-center text-slate-500 text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" /> Loading...
            </div>
          ) : integrations.length === 0 ? (
            <div className="border border-dashed border-purple-950/30 rounded-xl p-8 text-center text-xs text-slate-500 space-y-2 bg-slate-950/10">
              <ShieldAlert className="h-8 w-8 mx-auto text-purple-950/50" />
              <p>No external platform integrations configured for this project yet.</p>
              <p className="text-[10px] text-slate-600">Select a platform below to configure alerts.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((ti) => {
                const spec = platforms.find(p => p.id === ti.ti_platform);
                const Icon = spec?.icon || Globe;
                return (
                  <div key={ti.ti_id} className="border border-purple-950/20 bg-slate-950/40 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-purple-500/20 transition-all shadow-md shadow-purple-950/5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-purple-950/20 border border-purple-500/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-xs font-bold text-slate-200 capitalize">{ti.ti_platform}</h3>
                        <p className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
                          Webhook: {ti.ti_config.webhook_url}
                        </p>
                        <p className="text-[9px] text-purple-500 font-semibold uppercase tracking-wider">
                          Events: {ti.ti_config.events.join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEditModal(ti)}
                        className="p-2 hover:bg-slate-900 border border-purple-950/30 rounded-lg text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                        title="Edit config"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ti.ti_id)}
                        className="p-2 hover:bg-red-950/30 border border-red-950/30 rounded-lg text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Disconnect"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Supported Platforms Grid */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Integrations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {platforms.map((p) => {
              const Icon = p.icon;
              const isConfigured = integrations.some((ti) => ti.ti_platform === p.id);
              return (
                <div
                  key={p.id}
                  className={`border rounded-xl p-5 flex flex-col justify-between h-44 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-950/5 transition-all bg-slate-950/20 ${
                    isConfigured ? 'border-purple-500/20 bg-purple-950/5' : 'border-purple-950/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center border border-purple-950/20">
                        <Icon className="h-4.5 w-4.5 text-purple-500" />
                      </div>
                      {isConfigured && (
                        <span className="text-[8px] bg-purple-950/40 border border-purple-500/30 text-purple-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openCreateModal(p.id)}
                    disabled={isConfigured}
                    className={`mt-4 w-full py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isConfigured
                        ? 'border border-purple-950/20 text-slate-600 cursor-not-allowed'
                        : 'bg-purple-900 hover:bg-purple-800 text-purple-100 hover:-translate-y-0.5'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    Configure Alerts
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Configuration Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0b0c16] border border-purple-950/50 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-in scale-in duration-150">
            <div className="px-6 py-4 bg-slate-950 border-b border-purple-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlackIcon className="h-4.5 w-4.5 text-purple-500" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider capitalize">
                  {isEditing ? 'Modify' : 'Setup'} {form.platform}
                </h3>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="p-1 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px]">
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
                  className="w-full bg-slate-950 border border-purple-950/40 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-purple-500/50 font-mono text-[10px]"
                  required={!isEditing}
                />
                {isEditing && (
                  <p className="text-[9px] text-slate-500 leading-relaxed italic mt-0.5">
                    Leave blank to preserve current credentials. Overwrite by inputting a new URL.
                  </p>
                )}
              </div>

              {(form.platform === 'slack' || form.platform === 'discord' || form.platform === 'teams') && (
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px]">Channel / Room Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="#support-alerts"
                    value={form.channelName}
                    onChange={(e) => setForm({ ...form, channelName: e.target.value })}
                    className="w-full bg-slate-950 border border-purple-950/40 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px]">Trigger Alerts on Events</label>
                <div className="space-y-2">
                  {[
                    { id: 'chat_started', label: 'Ticket / Conversation Created' },
                    { id: 'message_received', label: 'Customer Message Sent' },
                    { id: 'ticket_resolved', label: 'Ticket Status Marked Resolved' }
                  ].map((evt) => (
                    <label key={evt.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.events.includes(evt.id)}
                        onChange={() => handleToggleEvent(evt.id)}
                        className="rounded border-purple-950 text-purple-600 bg-slate-950 focus:ring-purple-500/50"
                      />
                      <span className="text-slate-300">{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-purple-950/20">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-purple-950/40 hover:bg-slate-900 rounded-lg text-slate-400 font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 font-bold rounded-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-900/10"
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
    <Suspense fallback={
      <div className="flex h-screen flex-col bg-[#050510] text-slate-100 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="mt-2 text-xs font-mono uppercase text-purple-500 tracking-wider">Loading panel...</span>
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
