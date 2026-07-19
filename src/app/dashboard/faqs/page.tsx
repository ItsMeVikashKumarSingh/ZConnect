'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Plus, Trash2, Edit2, ArrowLeft, Loader2, LogOut, RefreshCw, Compass } from 'lucide-react';
import Link from 'next/link';
import { ZConnectLogo } from '../../../components/ZConnectLogo';
import { useTheme } from '../../ThemeProvider';

interface FAQ {
  tf_id: string;
  tf_question: string;
  tf_answer: string;
  tf_category: string;
  tf_sort_order: number;
}

function FaqsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  
  const [token, setToken] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit/Create FAQ Form State
  const [form, setForm] = useState({
    faqId: '',
    question: '',
    answer: '',
    category: 'General',
    sortOrder: 0,
  });

  const [isEditing, setIsEditing] = useState(false);

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

  // 2. Fetch FAQs once authenticated
  const fetchFaqs = async () => {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/dashboard?projectId=${projectId}&action=faqs`, { headers });
      const data = await res.json();
      if (data.success) {
        setFaqs(data.faqs);
      }
    } catch (err) {
      console.error('Failed to fetch FAQs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && projectId) fetchFaqs();
  }, [token, projectId]);

  // 3. Submit Add / Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim() || !token || !projectId) return;

    setSaving(true);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          action: 'upsert_faq',
          faqId: form.faqId || undefined,
          question: form.question,
          answer: form.answer,
          category: form.category,
          sortOrder: Number(form.sortOrder),
        }),
      });

      const data = await res.json();
      if (data.success) {
        resetForm();
        fetchFaqs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // 4. Delete FAQ
  const handleDelete = async (faqId: string) => {
    if (!token || !projectId || !confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          action: 'delete_faq',
          faqId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchFaqs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Fill form for editing
  const startEdit = (faq: FAQ) => {
    setForm({
      faqId: faq.tf_id,
      question: faq.tf_question,
      answer: faq.tf_answer,
      category: faq.tf_category,
      sortOrder: faq.tf_sort_order,
    });
    setIsEditing(true);
    
    // Smooth scroll to form on mobile
    const formElement = document.getElementById('faq-form-container');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const resetForm = () => {
    setForm({
      faqId: '',
      question: '',
      answer: '',
      category: 'General',
      sortOrder: 0,
    });
    setIsEditing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('zorvik_chat_token');
    router.push('/login');
  };

  if (authChecking) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent">Verifying FAQ list clearance...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground transition-colors duration-300">
      
      {/* Top Header Navbar */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link
            href={`/dashboard?token=${token}`}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <ZConnectLogo showText size={28} />
          <span className="hidden sm:inline-block text-xs bg-muted border border-border px-2.5 py-1 rounded-full text-muted-foreground font-semibold">
            FAQ Editor
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:block text-xs text-muted-foreground">
            Project ID: <span className="font-mono text-foreground font-semibold">{projectId}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Panel */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
        
        {/* FAQs List Section */}
        <div className="flex-1 p-6 space-y-6 lg:overflow-y-auto custom-scrollbar lg:border-r border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">Predefined FAQs</h2>
            <button
              onClick={() => fetchFaqs()}
              title="Refresh FAQ list"
              className="p-1.5 border border-border hover:border-muted-foreground/30 hover:bg-muted text-muted-foreground rounded-lg transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
              <span className="text-xs mt-2 font-mono">Loading FAQs...</span>
            </div>
          ) : faqs.length === 0 ? (
            <div className="premium-card p-12 text-center text-muted-foreground space-y-3">
              <Compass className="h-8 w-8 mx-auto opacity-35" />
              <p className="text-sm">No FAQs created yet. Use the editor to add your first FAQ.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.tf_id}
                  className="premium-card bg-card p-5 flex items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-primary-accent/10 border border-primary-accent/20 text-primary-accent rounded text-[9px] font-bold uppercase tracking-wider font-mono">
                        {faq.tf_category}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono font-semibold">
                        Order Index: {faq.tf_sort_order}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground leading-snug">{faq.tf_question}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{faq.tf_answer}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(faq)}
                      title="Edit FAQ"
                      className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(faq.tf_id)}
                      title="Delete FAQ"
                      className="p-1.5 rounded-lg border border-border bg-card hover:bg-red-500/10 hover:border-red-500/20 text-muted-foreground hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAQ Form Section (Right side/Stacked on mobile) */}
        <div id="faq-form-container" className="w-full lg:w-96 p-6 bg-muted/20 flex flex-col gap-6 shrink-0 lg:overflow-y-auto custom-scrollbar border-t lg:border-t-0 border-border">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">
              {isEditing ? 'Edit FAQ Topic' : 'Add FAQ Topic'}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              FAQs populate the initial view on the widget to answer client questions instantly before human agent routing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Question</label>
              <input
                type="text"
                placeholder="What is the question?"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Answer</label>
              <textarea
                placeholder="Describe the detailed answer..."
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40 min-h-[140px] resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Billing"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sort Order</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary-accent/40"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-3">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-primary-accent-foreground bg-primary-accent hover:bg-primary-accent-hover shadow-sm cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isEditing ? (
                  'Update FAQ'
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create FAQ
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function FaqsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen flex-col bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
        <span className="mt-2 text-xs font-mono uppercase text-primary-accent">Loading FAQ list...</span>
      </div>
    }>
      <FaqsContent />
    </Suspense>
  );
}
