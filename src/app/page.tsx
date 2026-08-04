'use client';

import { useState, useEffect } from 'react';
import { Upload, Play, Pause, Trash2, Download, RefreshCw, BarChart3, Users, Image as ImageIcon, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalLeads: number;
  processedLeads: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  sheetType: string;
}

interface Lead {
  id: string;
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  offer?: string;
  status: string;
  errorMessage?: string;
}

interface Poster {
  id: string;
  finalPosterUrl?: string;
  status: string;
  theme?: string;
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ total: 0, processing: 0, completed: 0, failed: 0 });

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [uploadType, setUploadType] = useState<'url' | 'file'>('url');

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampaigns = async () => {
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
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('name', campaignName);
      formData.append('sheetType', uploadType === 'url' ? 'google_sheets' : 'excel');
      
      if (uploadType === 'url') {
        formData.append('sheetUrl', sheetUrl);
      }

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        body: formData,
      });

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

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        body: formData,
      });

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

  const handleSelectCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    await fetchLeads(campaign.id);
    await fetchPosters(campaign.id);
  };

  const fetchLeads = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`);
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      logger.error('dashboard', 'Failed to fetch leads', { error });
    }
  };

  const fetchPosters = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/posters`);
      const data = await response.json();
      setPosters(data);
    } catch (error) {
      logger.error('dashboard', 'Failed to fetch posters', { error });
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">CloudKitchen Dev</h1>
          <p className="text-gray-600 dark:text-gray-400">AI-Powered Marketing Poster Generator & WhatsApp Automation</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Create Campaign */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create Campaign</h2>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Campaign Name
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Upload Type
                  </label>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Google Sheets URL
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Upload Excel/CSV
                    </label>
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

            {/* Campaigns List */}
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
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {campaign.totalLeads} leads • {campaign.status}
                        </p>
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

          {/* Right Column - Campaign Details */}
          <div className="lg:col-span-2">
            {selectedCampaign ? (
              <div className="space-y-6">
                {/* Campaign Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCampaign.name}</h2>
                      <p className="text-gray-600 dark:text-gray-400">
                        {selectedCampaign.processedLeads} / {selectedCampaign.totalLeads} processed
                      </p>
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
                      <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
                    <div
                      className="bg-blue-500 h-4 rounded-full transition-all"
                      style={{ width: `${(selectedCampaign.processedLeads / selectedCampaign.totalLeads) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{selectedCampaign.successCount} success</span>
                    <span>{selectedCampaign.failedCount} failed</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex -mb-px">
                      <button className="px-6 py-3 border-b-2 border-blue-500 text-blue-600 font-medium">
                        Leads ({leads.length})
                      </button>
                      <button className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                        Posters ({posters.length})
                      </button>
                      <button className="px-6 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                        Logs
                      </button>
                    </nav>
                  </div>

                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-2">Name</th>
                            <th className="text-left py-2 px-2">Business</th>
                            <th className="text-left py-2 px-2">Phone</th>
                            <th className="text-left py-2 px-2">Offer</th>
                            <th className="text-left py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead) => (
                            <tr key={lead.id} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-2 px-2">{lead.name || '-'}</td>
                              <td className="py-2 px-2">{lead.businessName || '-'}</td>
                              <td className="py-2 px-2">{lead.phone || '-'}</td>
                              <td className="py-2 px-2">{lead.offer || '-'}</td>
                              <td className="py-2 px-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  lead.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  lead.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Campaign Selected</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Create a new campaign or select an existing one to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}