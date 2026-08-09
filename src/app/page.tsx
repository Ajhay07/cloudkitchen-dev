'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Upload, Play, Pause, Users, Image as ImageIcon, CheckCircle, XCircle, Clock,
  Eye, ThumbsUp, ThumbsDown, RefreshCcw, X,
} from 'lucide-react';
import { logger } from '@/lib/logger';

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
  lead?: {
    name?: string;
    businessName?: string;
    phone?: string;
    address?: string;
    city?: string;
    offer?: string;
  };
}

const statusStyles: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  generating: 'bg-blue-100 text-blue-800',
  ready_for_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  regenerating: 'bg-purple-100 text-purple-800',
  sending: 'bg-indigo-100 text-indigo-800',
  sent: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

const statusLabel: Record<string, string> = {
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
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', campaignName);
      formData.append('sheetType', uploadType === 'url' ? 'google_sheets' : 'excel');
      if (uploadType === 'url') formData.append('sheetUrl', sheetUrl);
      const response = await fetch('/api/campaigns', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Failed to create campaign');
      const campaign = await response.json();
      setCampaignName('');
      setSheetUrl('');
      await fetchCampaigns();
      setSelectedCampaign(campaign);
    } catch (error) {
      logger.error('dashboard', 'Failed to create campaign', { error });
      alert('Failed to create campaign');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', campaignName || 'Uploaded Campaign');
      formData.append('file', file);
      formData.append('sheetType', file.name.endsWith('.csv') ? 'csv' : 'excel');
      const response = await fetch('/api/campaigns', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Failed to upload file');
      const campaign = await response.json();
      await fetchCampaigns();
      setSelectedCampaign(campaign);
    } catch (error) {
      logger.error('dashboard', 'Failed to upload file', { error });
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}/start`, { method: 'POST' });
      await fetchCampaigns();
    } catch (error) {
      logger.error('dashboard', 'Failed to start campaign', { error });
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}/pause`, { method: 'POST' });
      await fetchCampaigns();
    } catch (error) {
      logger.error('dashboard', 'Failed to pause campaign', { error });
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
      if (selectedCampaign) await fetchPosters(selectedCampaign.id);
      setRegenerateInstruction('');
      setSelectedPoster(null);
    } catch (error) {
      logger.error('dashboard', 'Failed to regenerate poster', { error });
      alert(error instanceof Error ? error.message : 'Failed to regenerate poster');
    } finally {
      setActionLoading(false);
    }
  };

  const getPosterStatusCount = (status: string) => posters.filter((p) => p.status === status).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">CloudKitchen Dev</h1>
          <p className="text-gray-600 dark:text-gray-400">AI-Powered Marketing Poster Generator & WhatsApp Automation</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <Users className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Processing</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.processing}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
          </div>
        </div>

        {selectedCampaign && posters.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Ready for Review</p>
              <p className="text-2xl font-bold text-yellow-600">{getPosterStatusCount('ready_for_review')}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Approved</p>
              <p className="text-2xl font-bold text-green-600">{getPosterStatusCount('approved')}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Regenerating</p>
              <p className="text-2xl font-bold text-purple-600">{getPosterStatusCount('regenerating')}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{getPosterStatusCount('rejected')}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-4">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Sent</p>
              <p className="text-2xl font-bold text-emerald-600">{getPosterStatusCount('sent')}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create Campaign</h2>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Chennai Restaurants"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadType('url')}
                      className={`flex-1 px-3 py-2 rounded-md ${uploadType === 'url' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      Google Sheets URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadType('file')}
                      className={`flex-1 px-3 py-2 rounded-md ${uploadType === 'file' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>
                {uploadType === 'url' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Sheets URL</label>
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      required={uploadType === 'url'}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Excel/CSV</label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Creating...' : 'Create Campaign'}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Campaigns</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    onClick={() => handleSelectCampaign(campaign)}
                    className={`p-3 rounded-md cursor-pointer border-2 transition-all ${
                      selectedCampaign?.id === campaign.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{campaign.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{campaign.totalLeads} leads • {campaign.status}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        campaign.status === 'completed' ? 'bg-green-100 text-green-800' :
                        campaign.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        campaign.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedCampaign ? (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCampaign.name}</h2>
                      <p className="text-gray-600 dark:text-gray-400">{selectedCampaign.processedLeads} / {selectedCampaign.totalLeads} processed</p>
                    </div>
                    <div className="flex gap-2">
                      {selectedCampaign.status === 'draft' || selectedCampaign.status === 'paused' ? (
                        <button
                          onClick={handleStartCampaign}
                          disabled={loading}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      ) : selectedCampaign.status === 'processing' ? (
                        <button
                          onClick={handlePauseCampaign}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
                    <div
                      className="bg-blue-500 h-4 rounded-full transition-all"
                      style={{ width: `${selectedCampaign.totalLeads ? (selectedCampaign.processedLeads / selectedCampaign.totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{selectedCampaign.successCount} generated</span>
                    <span>{selectedCampaign.failedCount} failed</span>
                    <span>{selectedCampaign.approvedCount} approved</span>
                    <span>{selectedCampaign.rejectedCount} rejected</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex -mb-px">
                      <button
                        onClick={() => setActiveTab('leads')}
                        className={`px-6 py-3 border-b-2 text-sm font-medium ${
                          activeTab === 'leads' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Leads ({leads.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('posters')}
                        className={`px-6 py-3 border-b-2 text-sm font-medium ${
                          activeTab === 'posters' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Posters ({posters.length})
                      </button>
                    </nav>
                  </div>

                  <div className="p-6">
                    {activeTab === 'leads' && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-2 text-xs font-medium">Name</th>
                              <th className="text-left py-2 px-2 text-xs font-medium">Business</th>
                              <th className="text-left py-2 px-2 text-xs font-medium">Phone</th>
                              <th className="text-left py-2 px-2 text-xs font-medium">Offer</th>
                              <th className="text-left py-2 px-2 text-xs font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leads.map((lead) => (
                              <tr key={lead.id} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-2 px-2 text-sm">{lead.name || '-'}</td>
                                <td className="py-2 px-2 text-sm">{lead.businessName || '-'}</td>
                                <td className="py-2 px-2 text-sm">{lead.phone || '-'}</td>
                                <td className="py-2 px-2 text-sm">{lead.offer || '-'}</td>
                                <td className="py-2 px-2">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    lead.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    lead.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {lead.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'posters' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {posters.map((poster) => (
                          <div key={poster.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                            {poster.finalPosterUrl ? (
                              <img
                                src={poster.finalPosterUrl}
                                alt={poster.lead?.businessName || 'Poster'}
                                className="w-full h-48 object-cover cursor-pointer"
                                onClick={() => setSelectedPoster(poster)}
                              />
                            ) : (
                              <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer" onClick={() => setSelectedPoster(poster)}>
                                <ImageIcon className="w-12 h-12 text-gray-400" />
                              </div>
                            )}
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900 dark:text-white text-sm">{poster.lead?.businessName || 'No business name'}</h4>
                                <span className={`px-2 py-1 text-xs rounded-full ${statusStyles[poster.status] || 'bg-gray-100 text-gray-800'}`}>
                                  {statusLabel[poster.status] || poster.status}
                                </span>
                              </div>
                              {poster.qualityScore !== undefined && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">Quality: {poster.qualityScore}/100</p>
                              )}
                              <div className="mt-3">
                                <button
                                  onClick={() => setSelectedPoster(poster)}
                                  className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-xs font-medium py-1.5 px-3 rounded-md flex items-center justify-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  Review
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {posters.length === 0 && (
                          <div className="col-span-2 text-center py-12">
                            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 dark:text-gray-400">No posters generated yet</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Campaign Selected</h3>
                <p className="text-gray-600 dark:text-gray-400">Create a new campaign or select an existing one to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedPoster(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Review Poster</h3>
              <button onClick={() => setSelectedPoster(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  {selectedPoster.finalPosterUrl ? (
                    <img src={selectedPoster.finalPosterUrl} alt="Poster preview" className="w-full rounded-lg shadow-lg" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Business</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedPoster.lead?.businessName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{selectedPoster.lead?.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Address</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {selectedPoster.lead?.address || ''}{selectedPoster.lead?.city ? `, ${selectedPoster.lead.city}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Offer</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{selectedPoster.lead?.offer || '-'}</p>
                  </div>
                  {selectedPoster.detectedFoodType && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cuisine</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{selectedPoster.detectedFoodType}</p>
                    </div>
                  )}
                  {selectedPoster.theme && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Theme</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{selectedPoster.theme}</p>
                    </div>
                  )}
                  {selectedPoster.qualityScore !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quality Score</p>
                      <p className={`text-sm font-medium ${selectedPoster.qualityScore >= 70 ? 'text-green-600' : 'text-red-600'}`}>{selectedPoster.qualityScore}/100</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</p>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusStyles[selectedPoster.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabel[selectedPoster.status] || selectedPoster.status}
                    </span>
                  </div>

                  {selectedPoster.status === 'ready_for_review' && (
                    <div className="pt-4 space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprovePoster(selectedPoster)}
                          disabled={actionLoading}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectPoster(selectedPoster)}
                          disabled={actionLoading}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {(selectedPoster.status === 'ready_for_review' || selectedPoster.status === 'rejected' || selectedPoster.status === 'approved') && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Regenerate</p>
                      <textarea
                        value={regenerateInstruction}
                        onChange={(e) => setRegenerateInstruction(e.target.value)}
                        placeholder="Optional instruction, e.g., Make the offer more prominent, use a premium style..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
                      />
                      <button
                        onClick={() => handleRegeneratePoster(selectedPoster)}
                        disabled={actionLoading}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        {actionLoading ? 'Processing...' : 'Regenerate'}
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