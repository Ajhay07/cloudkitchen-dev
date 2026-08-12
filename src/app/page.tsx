'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Upload, Play, Pause, Users, Image as ImageIcon, CheckCircle2, XCircle, Clock3,
  Eye, ThumbsUp, ThumbsDown, RefreshCcw, X, Sparkles,
} from 'lucide-react';
// Prisma-backed lib/logger.ts must never be imported into a client
// ('use client') component - it crashes on every call in the browser and
// masks the real error. Use console.error directly instead.
const logger = { error: (...args: unknown[]) => console.error('[dashboard]', ...args) };

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
  processedLeads: number;
  successCount: number;
  failedCount: number;
  approvedCount: number;
  rejectedCount: number;
  createdAt: string;
  sheetType: string;
}

interface Lead {
  id: string;
  name?: string;
  businessName?: string;
  phone?: string;
  offer?: string;
  status: string;
}

interface Poster {
  id: string;
  finalPosterUrl?: string;
  status: string;
  theme?: string;
  qualityScore?: number;
  detectedFoodType?: string;
  updatedAt?: string;
  lead?: {
    name?: string;
    businessName?: string;
    phone?: string;
    address?: string;
    city?: string;
    offer?: string;
  };
}

// Regenerating a poster overwrites the same Blob URL - without a
// cache-busting query param, browsers keep showing the old cached image
// even after the src is "changed" to the (identical) URL.
function posterImageSrc(poster: Poster): string | undefined {
  if (!poster.finalPosterUrl) return undefined;
  const v = poster.updatedAt ? new Date(poster.updatedAt).getTime() : Date.now();
  return `${poster.finalPosterUrl}?v=${v}`;
}

const posterStatusStyles: Record<string, string> = {
  pending: 'bg-surface3 text-text-muted',
  generating: 'bg-info/10 text-info',
  ready_for_review: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  regenerating: 'bg-accent/10 text-accent',
  sending: 'bg-info/10 text-info',
  sent: 'bg-success/10 text-success',
  failed: 'bg-danger/10 text-danger',
};

const posterStatusLabel: Record<string, string> = {
  pending: 'Pending',
  generating: 'Generating',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  rejected: 'Rejected',
  regenerating: 'Regenerating',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

const campaignStatusStyles: Record<string, string> = {
  draft: 'bg-surface3 text-text-muted',
  ready: 'bg-info/10 text-info',
  processing: 'bg-warning/10 text-warning',
  paused: 'bg-surface3 text-text-muted',
  completed: 'bg-success/10 text-success',
  failed: 'bg-danger/10 text-danger',
};

const leadStatusStyles: Record<string, string> = {
  pending: 'bg-surface3 text-text-muted',
  processing: 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  failed: 'bg-danger/10 text-danger',
};

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPoster, setSelectedPoster] = useState<Poster | null>(null);
  const [regenerateInstruction, setRegenerateInstruction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'leads' | 'posters'>('leads');
  const [stats, setStats] = useState({ total: 0, processing: 0, completed: 0, failed: 0 });

  const [campaignName, setCampaignName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [uploadType, setUploadType] = useState<'url' | 'file'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/campaigns');
      const data = await response.json();
      setCampaigns(data);
      const total = data.reduce((sum: number, c: Campaign) => sum + c.totalLeads, 0);
      const processing = data.filter((c: Campaign) => c.status === 'processing').length;
      const completed = data.filter((c: Campaign) => c.status === 'completed').length;
      const failed = data.filter((c: Campaign) => c.status === 'failed').length;
      setStats({ total, processing, completed, failed });
    } catch (error) {
      logger.error('dashboard', 'Failed to fetch campaigns', { error });
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  useEffect(() => {
    if (!selectedCampaign) return;
    const interval = setInterval(() => {
      fetchLeads(selectedCampaign.id);
      fetchPosters(selectedCampaign.id);
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?.id]);

  // Keep the selected campaign's header (progress bar, counts, Start/Pause
  // button) in sync with the polled campaigns list - without this it was a
  // frozen snapshot from the moment it was clicked, requiring a manual
  // reselect/refresh to see any progress at all.
  useEffect(() => {
    if (!selectedCampaign) return;
    const fresh = campaigns.find((c) => c.id === selectedCampaign.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedCampaign)) {
      setSelectedCampaign(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  // Keep the open "Review Poster" modal in sync with the background poster
  // list as it refreshes - without this, regenerating shows no visible
  // change because the modal keeps rendering the stale snapshot it was
  // opened with, even after the new image is ready.
  useEffect(() => {
    if (!selectedPoster) return;
    const fresh = posters.find((p) => p.id === selectedPoster.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedPoster)) {
      setSelectedPoster(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posters]);

  const fetchLeads = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`);
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      logger.error('dashboard', 'Failed to fetch leads', { error });
    }
  }, []);

  const fetchPosters = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/posters`);
      const data = await response.json();
      setPosters(data);
    } catch (error) {
      logger.error('dashboard', 'Failed to fetch posters', { error });
    }
  }, []);

  const handleSelectCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setActiveTab('leads');
    await fetchLeads(campaign.id);
    await fetchPosters(campaign.id);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadType === 'file' && !selectedFile) {
      alert('Please choose a file to upload');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', campaignName);

      if (uploadType === 'url') {
        formData.append('sheetType', 'google_sheets');
        formData.append('sheetUrl', sheetUrl);
      } else if (selectedFile) {
        formData.append('sheetType', selectedFile.name.endsWith('.csv') ? 'csv' : 'excel');
        formData.append('file', selectedFile);
      }

      const response = await fetch('/api/campaigns', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Failed to create campaign');
      const campaign = await response.json();
      setCampaignName('');
      setSheetUrl('');
      setSelectedFile(null);
      await fetchCampaigns();
      setSelectedCampaign(campaign);
    } catch (error) {
      logger.error('Failed to create campaign', { error });
      alert('Failed to create campaign');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const handleStartCampaign = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      await fetchCampaigns();
    } catch (error) {
      logger.error('Failed to start campaign', { error });
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      await fetchCampaigns();
    } catch (error) {
      logger.error('Failed to pause campaign', { error });
    }
  };

  const handleUpdateLeadOffer = async (leadId: string, offer: string) => {
    if (!selectedCampaign) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, offer } : l)));
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, offer }),
      });
    } catch (error) {
      logger.error('Failed to update lead offer', { error });
    }
  };

  const handleUpdateLeadBusinessName = async (leadId: string, businessName: string) => {
    if (!selectedCampaign) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, businessName } : l)));
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, businessName }),
      });
    } catch (error) {
      logger.error('Failed to update lead business name', { error });
    }
  };

  const handleApprovePoster = async (poster: Poster) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/posters/${poster.id}/approve`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve');
      if (selectedCampaign) await fetchPosters(selectedCampaign.id);
      setSelectedPoster(null);
    } catch (error) {
      logger.error('dashboard', 'Failed to approve poster', { error });
      alert(error instanceof Error ? error.message : 'Failed to approve poster');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPoster = async (poster: Poster) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/posters/${poster.id}/reject`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reject');
      if (selectedCampaign) await fetchPosters(selectedCampaign.id);
      setSelectedPoster(null);
    } catch (error) {
      logger.error('dashboard', 'Failed to reject poster', { error });
      alert(error instanceof Error ? error.message : 'Failed to reject poster');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegeneratePoster = async (poster: Poster) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/posters/${poster.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: regenerateInstruction || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to regenerate');
      // Regeneration takes ~15-20s in the background worker - keep the modal
      // open (rather than closing it) so the user can watch it update live;
      // the poster-list polling + selectedPoster sync effect pick up the
      // finished image automatically once it's ready.
      if (data.poster) setSelectedPoster(data.poster);
      if (selectedCampaign) await fetchPosters(selectedCampaign.id);
      setRegenerateInstruction('');
    } catch (error) {
      logger.error('dashboard', 'Failed to regenerate poster', { error });
      alert(error instanceof Error ? error.message : 'Failed to regenerate poster');
    } finally {
      setActionLoading(false);
    }
  };

  const getPosterStatusCount = (status: string) => posters.filter((p) => p.status === status).length;
  const canStart = selectedCampaign && ['draft', 'ready', 'paused'].includes(selectedCampaign.status);

  return (
    <div className="min-h-screen bg-bg text-text font-body">
      <div className="mx-auto flex max-w-[1600px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <div className="flex items-center gap-2.5 border-b border-border px-6 py-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
              <Sparkles className="h-4 w-4 text-bg" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-lg leading-none text-text">CloudKitchen</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-text-dim">Marketing Automation</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">New campaign</p>
            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Campaign name"
                required
                className="w-full rounded-md border border-border bg-surface2 px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none transition-colors focus:border-accent"
              />

              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setUploadType('url')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    uploadType === 'url' ? 'bg-accent text-bg' : 'bg-surface2 text-text-muted hover:text-text'
                  }`}
                >
                  Sheets URL
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType('file')}
                  className={`flex-1 border-l border-border px-3 py-2 text-xs font-medium transition-colors ${
                    uploadType === 'file' ? 'bg-accent text-bg' : 'bg-surface2 text-text-muted hover:text-text'
                  }`}
                >
                  Upload File
                </button>
              </div>

              {uploadType === 'url' ? (
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/…"
                  required={uploadType === 'url'}
                  className="w-full rounded-md border border-border bg-surface2 px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none transition-colors focus:border-accent"
                />
              ) : (
                <div className="rounded-md border border-dashed border-border-strong bg-surface2 px-3 py-3 text-center transition-colors hover:border-accent/50">
                  <label className="cursor-pointer text-xs text-text-muted">
                    {selectedFile ? (
                      <span className="text-text">{selectedFile.name}</span>
                    ) : (
                      <>Drop or <span className="text-accent">browse</span> .xlsx / .csv</>
                    )}
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Creating…' : 'Create campaign'}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">Campaigns</p>
              <span className="text-[11px] text-text-dim">{campaigns.length}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {campaigns.map((campaign) => {
                const isActive = selectedCampaign?.id === campaign.id;
                return (
                  <button
                    key={campaign.id}
                    onClick={() => handleSelectCampaign(campaign)}
                    className={`group flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-accent/40 bg-accent/[0.06]'
                        : 'border-transparent hover:border-border hover:bg-surface2'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${isActive ? 'text-accent' : 'text-text'}`}>{campaign.name}</p>
                      <p className="text-[11px] text-text-dim">{campaign.totalLeads} leads</p>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${campaignStatusStyles[campaign.status] || 'bg-surface3 text-text-muted'}`}>
                      {campaign.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
          {/* Stat strip */}
          <div className="mb-8 grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-surface md:grid-cols-4">
            {[
              { label: 'Total Leads', value: stats.total, icon: Users, tone: 'text-text' },
              { label: 'Processing', value: stats.processing, icon: Clock3, tone: 'text-warning' },
              { label: 'Completed', value: stats.completed, icon: CheckCircle2, tone: 'text-success' },
              { label: 'Failed', value: stats.failed, icon: XCircle, tone: 'text-danger' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center justify-between px-5 py-5 md:px-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] text-text-dim">{label}</p>
                  <p className={`font-display text-3xl ${tone}`}>{value}</p>
                </div>
                <Icon className={`h-5 w-5 ${tone} opacity-60`} strokeWidth={1.75} />
              </div>
            ))}
          </div>

          {selectedCampaign ? (
            <div className="space-y-6">
              {/* Campaign header */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl text-text">{selectedCampaign.name}</h1>
                    <p className="mt-1 text-sm text-text-muted">
                      {selectedCampaign.processedLeads} / {selectedCampaign.totalLeads} leads processed
                    </p>
                  </div>
                  {canStart ? (
                    <button
                      onClick={handleStartCampaign}
                      disabled={loading}
                      className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </button>
                  ) : selectedCampaign.status === 'processing' ? (
                    <button
                      onClick={handlePauseCampaign}
                      className="flex shrink-0 items-center gap-2 rounded-md border border-border-strong bg-surface2 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface3"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </button>
                  ) : null}
                </div>

                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${selectedCampaign.totalLeads ? (selectedCampaign.processedLeads / selectedCampaign.totalLeads) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
                  <span><span className="text-success">{selectedCampaign.successCount}</span> generated</span>
                  <span><span className="text-danger">{selectedCampaign.failedCount}</span> failed</span>
                  <span><span className="text-accent">{selectedCampaign.approvedCount}</span> approved</span>
                  <span><span className="text-text-dim">{selectedCampaign.rejectedCount}</span> rejected</span>
                </div>
              </div>

              {/* Poster status strip */}
              {posters.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { label: 'Ready for Review', status: 'ready_for_review', tone: 'text-warning' },
                    { label: 'Approved', status: 'approved', tone: 'text-success' },
                    { label: 'Regenerating', status: 'regenerating', tone: 'text-accent' },
                    { label: 'Rejected', status: 'rejected', tone: 'text-danger' },
                    { label: 'Sent', status: 'sent', tone: 'text-success' },
                  ].map(({ label, status, tone }) => (
                    <div key={status} className="rounded-lg border border-border bg-surface px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-text-dim">{label}</p>
                      <p className={`font-display text-2xl ${tone}`}>{getPosterStatusCount(status)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs + content */}
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="flex border-b border-border">
                  {(['leads', 'posters'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-3.5 text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'border-b-2 border-accent text-text'
                          : 'border-b-2 border-transparent text-text-dim hover:text-text-muted'
                      }`}
                    >
                      {tab} <span className="text-text-dim">({tab === 'leads' ? leads.length : posters.length})</span>
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {activeTab === 'leads' && (
                    <div>
                      <p className="mb-4 text-xs text-text-dim">
                        Edit the business name (shown as the poster title) or offer for any lead, then use Regenerate on its poster to apply the change. Leave offer blank on a new lead to let AI generate one automatically.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-text-dim">
                              <th className="py-2.5 pr-4 font-medium">Name</th>
                              <th className="py-2.5 pr-4 font-medium">Business</th>
                              <th className="py-2.5 pr-4 font-medium">Phone</th>
                              <th className="py-2.5 pr-4 font-medium">Offer</th>
                              <th className="py-2.5 pr-4 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leads.map((lead) => (
                              <tr key={lead.id} className="border-b border-border/60 last:border-0">
                                <td className="py-2.5 pr-4 text-text">{lead.name || '—'}</td>
                                <td className="py-2.5 pr-4">
                                  <input
                                    type="text"
                                    defaultValue={lead.businessName || ''}
                                    placeholder="Business name shown on poster"
                                    onBlur={(e) => {
                                      if (e.target.value !== (lead.businessName || '')) {
                                        handleUpdateLeadBusinessName(lead.id, e.target.value);
                                      }
                                    }}
                                    className="w-full rounded border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-text-dim outline-none transition-colors focus:border-accent"
                                  />
                                </td>
                                <td className="py-2.5 pr-4 text-text-muted">{lead.phone || '—'}</td>
                                <td className="py-2.5 pr-4">
                                  <input
                                    type="text"
                                    defaultValue={lead.offer || ''}
                                    placeholder="e.g. Flat 25% OFF"
                                    onBlur={(e) => {
                                      if (e.target.value !== (lead.offer || '')) {
                                        handleUpdateLeadOffer(lead.id, e.target.value);
                                      }
                                    }}
                                    className="w-full rounded border border-border bg-surface2 px-2 py-1.5 text-sm text-text placeholder:text-text-dim outline-none transition-colors focus:border-accent"
                                  />
                                </td>
                                <td className="py-2.5 pr-4">
                                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${leadStatusStyles[lead.status] || 'bg-surface3 text-text-muted'}`}>
                                    {lead.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'posters' && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {posters.map((poster) => (
                        <div
                          key={poster.id}
                          className="group overflow-hidden rounded-lg border border-border bg-surface2 transition-colors hover:border-border-strong"
                        >
                          {poster.finalPosterUrl ? (
                            <img
                              src={posterImageSrc(poster)}
                              alt={poster.lead?.businessName || 'Poster'}
                              className="aspect-square w-full cursor-pointer object-cover"
                              onClick={() => setSelectedPoster(poster)}
                            />
                          ) : (
                            <div
                              className="flex aspect-square w-full cursor-pointer items-center justify-center bg-surface3"
                              onClick={() => setSelectedPoster(poster)}
                            >
                              <ImageIcon className="h-10 w-10 text-text-dim" strokeWidth={1.5} />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <h4 className="truncate text-sm font-medium text-text">{poster.lead?.businessName || 'No business name'}</h4>
                              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${posterStatusStyles[poster.status] || 'bg-surface3 text-text-muted'}`}>
                                {posterStatusLabel[poster.status] || poster.status}
                              </span>
                            </div>
                            {poster.qualityScore !== undefined && (
                              <p className="text-[11px] text-text-dim">Quality: {poster.qualityScore}/100</p>
                            )}
                            <button
                              onClick={() => setSelectedPoster(poster)}
                              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-text"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Review
                            </button>
                          </div>
                        </div>
                      ))}
                      {posters.length === 0 && (
                        <div className="col-span-full py-16 text-center">
                          <ImageIcon className="mx-auto mb-3 h-10 w-10 text-text-dim" strokeWidth={1.5} />
                          <p className="text-sm text-text-dim">No posters generated yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-24 text-center">
              <Sparkles className="mb-4 h-10 w-10 text-accent/60" strokeWidth={1.5} />
              <h3 className="font-display text-xl text-text">No campaign selected</h3>
              <p className="mt-2 max-w-sm text-sm text-text-dim">
                Create a new campaign from the sidebar or select an existing one to review leads and posters.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Poster review modal */}
      {selectedPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPoster(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-display text-lg text-text">Review Poster</h3>
              <button
                onClick={() => setSelectedPoster(null)}
                className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface2 hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  {selectedPoster.finalPosterUrl ? (
                    <img src={posterImageSrc(selectedPoster)} alt="Poster preview" className="w-full rounded-lg border border-border shadow-lg" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-surface2">
                      <ImageIcon className="h-14 w-14 text-text-dim" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="space-y-3.5">
                  <Field label="Business" value={selectedPoster.lead?.businessName} large />
                  <Field label="Contact" value={selectedPoster.lead?.phone} />
                  <Field
                    label="Address"
                    value={[selectedPoster.lead?.address, selectedPoster.lead?.city].filter(Boolean).join(', ')}
                  />
                  <Field label="Offer" value={selectedPoster.lead?.offer} />
                  {selectedPoster.detectedFoodType && <Field label="Cuisine" value={selectedPoster.detectedFoodType} />}
                  {selectedPoster.theme && <Field label="Theme" value={selectedPoster.theme} />}
                  {selectedPoster.qualityScore !== undefined && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-dim">Quality Score</p>
                      <p className={`text-sm font-medium ${selectedPoster.qualityScore >= 70 ? 'text-success' : 'text-danger'}`}>
                        {selectedPoster.qualityScore}/100
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-dim">Status</p>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${posterStatusStyles[selectedPoster.status] || 'bg-surface3 text-text-muted'}`}>
                      {posterStatusLabel[selectedPoster.status] || selectedPoster.status}
                    </span>
                  </div>

                  {selectedPoster.status === 'ready_for_review' && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleApprovePoster(selectedPoster)}
                        disabled={actionLoading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-bg transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectPoster(selectedPoster)}
                        disabled={actionLoading}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  )}

                  {(['ready_for_review', 'rejected', 'approved', 'failed'].includes(selectedPoster.status)) && (
                    <div className="space-y-2 border-t border-border pt-3.5">
                      <p className="text-xs font-medium text-text-muted">Regenerate</p>
                      <textarea
                        value={regenerateInstruction}
                        onChange={(e) => setRegenerateInstruction(e.target.value)}
                        placeholder="Optional instruction — e.g. make the offer more prominent, use a premium style…"
                        rows={2}
                        className="w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none transition-colors focus:border-accent"
                      />
                      <button
                        onClick={() => handleRegeneratePoster(selectedPoster)}
                        disabled={actionLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
                      >
                        <RefreshCcw className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
                        {actionLoading ? 'Processing…' : 'Regenerate'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, large }: { label: string; value?: string; large?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={large ? 'text-lg font-medium text-text' : 'text-sm text-text-muted'}>{value || '—'}</p>
    </div>
  );
}
