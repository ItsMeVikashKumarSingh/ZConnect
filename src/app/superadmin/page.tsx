'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Eye, Loader2, Save, Trash2, Copy, Check, LogOut, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { ZConnectLogo } from '../../components/ZConnectLogo';
import { useTheme } from '../ThemeProvider';

interface Project {
  tp_id: string;
  tp_name: string;
  tp_domain: string;
  tp_api_key: string;
  tp_client_id: string | null;
  tp_widget_config: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    title: string;
    botName: string;
    defaultMode: 'faq' | 'chat';
    allowHandover: boolean;
    isDark: boolean;
  };
}

interface Client {
  tc_id: string;
  tc_client_name: string;
  tc_contact_email: string;
  tc_domain: string;
}

function SuperadminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProj, setSelectedProj] = useState<Project | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // New Project Form State
  const [newProj, setNewProj] = useState({
    name: '',
    domain: '',
    clientUUID: '',
  });

  // Edit Config State
  const [config, setConfig] = useState({
    primaryColor: '#0D2B5C',
    accentColor: '#D4A017',
    backgroundColor: '#050510',
    title: 'Support Hub',
    botName: 'Virtual Assistant',
    defaultMode: 'faq' as 'faq' | 'chat',
    allowHandover: true,
    isDark: true,
  });

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
        if (res.ok && data.success && data.session?.role === 'admin') {
          setToken(activeToken);
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

  // 2. Fetch Projects and Zorvik Tech Clients once authenticated
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [projRes, clientRes] = await Promise.all([
        fetch('/api/superadmin?action=projects', { headers }),
        fetch('/api/superadmin?action=clients', { headers }),
      ]);

      const projData = await projRes.json();
      const clientData = await clientRes.json();

      if (projData.success) setProjects(projData.projects);
      if (clientData.success) setClients(clientData.clients);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Load widget config when a project is selected
  useEffect(() => {
    if (selectedProj) {
      setConfig({
        primaryColor: selectedProj.tp_widget_config.primaryColor || '#0D2B5C',
        accentColor: selectedProj.tp_widget_config.accentColor || '#D4A017',
        backgroundColor: selectedProj.tp_widget_config.backgroundColor || '#050510',
        title: selectedProj.tp_widget_config.title || 'Support Hub',
        botName: selectedProj.tp_widget_config.botName || 'Virtual Assistant',
        defaultMode: selectedProj.tp_widget_config.defaultMode || 'faq',
        allowHandover: selectedProj.tp_widget_config.allowHandover !== undefined ? selectedProj.tp_widget_config.allowHandover : true,
        isDark: selectedProj.tp_widget_config.isDark !== undefined ? selectedProj.tp_widget_config.isDark : true,
      });
    }
  }, [selectedProj]);

  // Handle Zorvik Tech Client Select (auto fills name and domain)
  const handleClientSelect = (clientId: string) => {
    const selected = clients.find((c) => c.tc_id === clientId);
    if (selected) {
      setNewProj({
        clientUUID: clientId,
        name: selected.tc_client_name,
        domain: selected.tc_domain || '',
      });
    } else {
      setNewProj({ clientUUID: '', name: '', domain: '' });
    }
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProj.name.trim() || !newProj.domain.trim() || !token) return;

    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create_project',
          name: newProj.name,
          domain: newProj.domain,
          clientUUID: newProj.clientUUID || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNewProj({ name: '', domain: '', clientUUID: '' });
        fetchData();
      } else {
        alert(data.error || 'Failed to register project');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Widget Config
  const handleSaveConfig = async () => {
    if (!selectedProj || !token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update_config',
          projectId: selectedProj.tp_id,
          widgetConfig: config,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProjects((prev) =>
          prev.map((p) =>
            p.tp_id === selectedProj.tp_id ? { ...p, tp_widget_config: { ...p.tp_widget_config, ...config } } : p
          )
        );
        alert('Configuration saved successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: string) => {
    if (!token || !confirm('Are you sure you want to delete this project? All associated chats will be archived.')) return;

    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'delete_project',
          projectId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (selectedProj?.tp_id === projectId) setSelectedProj(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zorvik_chat_token');
    router.push('/login');
  };

  const copyToClipboard = (text: string, type: 'key' | 'script') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  const getEmbedCode = (projId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002';
    return `<script 
  src="${origin}/widget.js" 
  data-project-id="${projId}"
  data-user-id="USER_ID"
  data-user-email="USER_EMAIL"
  data-user-name="USER_NAME"
  data-signature="HMAC_SIGNATURE"
  data-priority="false">
</script>`;
  };

  if (authChecking) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent">Verifying Admin clearance...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground transition-colors duration-300">
      
      {/* Header Top Navbar */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <ZConnectLogo showText size={28} />
          <span className="hidden sm:inline-block text-xs bg-muted border border-border px-2.5 py-1 rounded-full text-muted-foreground font-semibold">
            Superadmin Center
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
        
        {/* Project List Sidebar (Left) */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border flex flex-col shrink-0 bg-card/40">
          <div className="p-4 space-y-4 border-b border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Create Support Project</h2>
            {/* Create Project Form */}
            <form onSubmit={handleCreateProject} className="space-y-3 p-4 bg-background border border-border rounded-xl">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-muted-foreground uppercase font-mono">Link Zorvik Client</label>
                <select
                  value={newProj.clientUUID}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map((c) => (
                    <option key={c.tc_id} value={c.tc_id}>
                      {c.tc_client_name} ({c.tc_domain})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-muted-foreground uppercase font-mono">Project Name</label>
                <input
                  type="text"
                  placeholder="Project Name"
                  value={newProj.name}
                  onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-muted-foreground uppercase font-mono">Domain Name</label>
                <input
                  type="text"
                  placeholder="Domain (e.g. client.com)"
                  value={newProj.domain}
                  onChange={(e) => setNewProj({ ...newProj, domain: e.target.value })}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground rounded-lg text-xs font-bold tracking-wider uppercase font-mono transition-colors flex items-center justify-center gap-1.5 mt-4 cursor-pointer shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Register Widget
              </button>
            </form>
          </div>

          {/* Active Widgets Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-2 p-4 custom-scrollbar">
            <div className="flex justify-between items-center px-1 mb-2">
              <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold tracking-wider">Active Widgets</span>
              <button onClick={() => fetchData()} className="p-1 hover:bg-muted text-muted-foreground rounded transition-colors">
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary-accent" />
                <span className="text-[9px] mt-1 font-mono">Loading projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No registered projects.</p>
            ) : (
              projects.map((proj) => {
                const isSelected = selectedProj?.tp_id === proj.tp_id;
                return (
                  <div
                    key={proj.tp_id}
                    className={`group w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-primary-accent bg-primary-accent/5'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedProj(proj)}
                      className="flex-1 text-left flex flex-col gap-0.5 overflow-hidden"
                    >
                      <span className="font-bold text-xs text-foreground truncate">{proj.tp_name}</span>
                      <span className="text-[10px] text-muted-foreground truncate font-mono">{proj.tp_domain}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.tp_id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all ml-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Configurations workspace (Right) */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/20">
          {selectedProj ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Project Title bar */}
              <div className="premium-card bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground font-sans">{selectedProj.tp_name} Settings</h2>
                  <p className="text-xs text-muted-foreground mt-1">Configure widget feature triggers, colors, and capabilities.</p>
                </div>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex items-center justify-center gap-1.5 bg-primary-accent hover:bg-primary-accent-hover text-primary-accent-foreground px-4 py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Configuration
                </button>
              </div>

              {/* API Credentials */}
              <div className="premium-card bg-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono border-b border-border pb-2">API Authentication Credentials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold text-muted-foreground uppercase font-mono">Project UUID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary-accent select-all font-semibold bg-primary-accent/5 px-2.5 py-1 rounded border border-primary-accent/15 truncate flex-1 block">
                        {selectedProj.tp_id}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold text-muted-foreground uppercase font-mono">Secret API Key</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground select-all bg-muted px-2.5 py-1 rounded border border-border truncate flex-1 block">
                        {selectedProj.tp_api_key}
                      </span>
                      <button
                        onClick={() => copyToClipboard(selectedProj.tp_api_key, 'key')}
                        className="p-1.5 rounded bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        title="Copy API key"
                      >
                        {copiedKey ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Control Toggles */}
                <div className="premium-card bg-card p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono border-b border-border pb-2">Feature Controls</h3>
                  
                  {/* Default mode */}
                  <div className="flex items-center justify-between gap-4 py-1.5">
                    <div>
                      <span className="block text-xs font-bold">Default Mode</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">Landing interface of widget window.</span>
                    </div>
                    <select
                      value={config.defaultMode}
                      onChange={(e) => setConfig({ ...config, defaultMode: e.target.value as any })}
                      className="bg-background border border-border rounded-lg text-xs py-1.5 px-3.5 text-foreground"
                    >
                      <option value="faq">FAQ list search</option>
                      <option value="chat">Direct ticket chat</option>
                    </select>
                  </div>

                  {/* Allow Handover */}
                  <div className="flex items-center justify-between gap-4 py-1.5 border-t border-border/40">
                    <div>
                      <span className="block text-xs font-bold">Agent Handover</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">Let users handoff to a live human operator.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.allowHandover}
                      onChange={(e) => setConfig({ ...config, allowHandover: e.target.checked })}
                      className="h-4 w-4 accent-primary-accent rounded cursor-pointer"
                    />
                  </div>

                  {/* Dark mode styling */}
                  <div className="flex items-center justify-between gap-4 py-1.5 border-t border-border/40">
                    <div>
                      <span className="block text-xs font-bold">Force Dark Mode</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">Force the client widget to style in dark themes.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.isDark}
                      onChange={(e) => setConfig({ ...config, isDark: e.target.checked })}
                      className="h-4 w-4 accent-primary-accent rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Branding Config */}
                <div className="premium-card bg-card p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono border-b border-border pb-2">Branding Customization</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-muted-foreground uppercase font-mono">Widget Title</label>
                      <input
                        type="text"
                        value={config.title}
                        onChange={(e) => setConfig({ ...config, title: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-muted-foreground uppercase font-mono">Bot Name</label>
                      <input
                        type="text"
                        value={config.botName}
                        onChange={(e) => setConfig({ ...config, botName: e.target.value })}
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-muted-foreground uppercase font-mono">Primary color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={config.primaryColor}
                          onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                          className="h-7 w-7 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono">{config.primaryColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-muted-foreground uppercase font-mono">Accent color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={config.accentColor}
                          onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                          className="h-7 w-7 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono">{config.accentColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-muted-foreground uppercase font-mono">BG color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={config.backgroundColor}
                          onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                          className="h-7 w-7 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono">{config.backgroundColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Embed Script code snippet */}
              <div className="premium-card bg-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">HTML Integration Script</h3>
                  <button
                    onClick={() => copyToClipboard(getEmbedCode(selectedProj.tp_id), 'script')}
                    className="flex items-center justify-center gap-1.5 bg-primary-accent text-primary-accent-foreground px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-wider transition-colors shadow-sm cursor-pointer"
                  >
                    {copiedScript ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy embed script
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paste this script snippet immediately prior to the closing <code className="text-primary-accent font-semibold">&lt;/body&gt;</code> tag on the target web layout. Remember to sign client details server-side using your secret API key.
                </p>
                <pre className="bg-background border border-border rounded-xl p-4 text-[10px] font-mono text-primary-accent overflow-x-auto leading-relaxed select-all">
                  {getEmbedCode(selectedProj.tp_id)}
                </pre>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-5 p-6 text-center">
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 text-muted-foreground/15 mb-2" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Grid network nodes background */}
                  <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" opacity="0.3" />
                  <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="2" strokeDasharray="3 4" opacity="0.4" />
                  
                  {/* Nodes connection paths */}
                  <path d="M50 100 H150 M100 50 V150 M65 65 L135 135 M65 135 L135 65" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

                  {/* Active connecting nodes */}
                  <circle cx="100" cy="100" r="8" fill="var(--primary-accent)" />
                  <circle cx="100" cy="100" r="18" stroke="var(--primary-accent)" strokeWidth="1.5" opacity="0.25" className="animate-ping" style={{ transformOrigin: 'center' }} />
                  
                  <circle cx="50" cy="100" r="5" fill="currentColor" opacity="0.5" />
                  <circle cx="150" cy="100" r="5" fill="currentColor" opacity="0.5" />
                  <circle cx="100" cy="50" r="5" fill="currentColor" opacity="0.5" />
                  <circle cx="100" cy="150" r="5" fill="currentColor" opacity="0.5" />

                  <circle cx="65" cy="65" r="4.5" fill="var(--gold-accent)" opacity="0.6" />
                  <circle cx="135" cy="135" r="4.5" fill="var(--gold-accent)" opacity="0.6" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide text-foreground">Select a Support Project</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1.5 leading-relaxed">
                  Choose an active client widget project from the sidebar to inspect configuration parameters, copy HTML embed scripts, or adjust target brand themes.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function SuperadminPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent">Loading Admin dashboard...</span>
      </div>
    }>
      <SuperadminContent />
    </Suspense>
  );
}
