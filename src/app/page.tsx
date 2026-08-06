'use client';

import { useState, useEffect } from 'react';
import { Upload, Play, Pause, Trash2, Download, RefreshCw, BarChart3, Users, Image as ImageIcon, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';


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
  lead?: {
    name?: string;
    businessName?: string;
    phone?: string;
  };
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'posters' | 'logs'>('leads');
  const [posterActionLoading, setPosterActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedCampaign) return;
    const interval = setInterval(() => {
      fetchLeads(selectedCampaign.id);
      fetchPosters(selectedCampaign.id);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?.id]);

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
      console.error('[dashboard]', 'Failed to fetch campaigns', { error });
    }
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

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create campaign');

      const campaign = await response.json();
      setCampaignName('');
      setSheetUrl('');
      setSelectedFile(null);
      await fetchCampaigns();
      setSelectedCampaign(campaign);
    } catch (error) {
      console.error('[dashboard]', 'Failed to create campaign', { error });
      alert('Failed to create campaign');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
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
      console.error('[dashboard]', 'Failed to fetch leads', { error });
    }
  };

  const handlePosterAction = async (posterId: string, action: 'approve' | 'reject' | 'regenerate') => {
    if (!selectedCampaign) return;
    setPosterActionLoading(posterId);
    try {
      await fetch(`/api/campaigns/${selectedCampaign.id}/posters`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId, action }),
      });
      await fetchPosters(selectedCampaign.id);
    } catch (error) {
      console.error('[dashboard]', `Failed to ${action} poster`, { error });
    } finally {
      setPosterActionLoading(null);
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
      console.error('[dashboard]', 'Failed to update lead offer', { error });
    }
  };

  const fetchPosters = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/posters`);
      const data = await response.json();
      setPosters(data);
    } catch (error) {
      console.error('[dashboard]', 'Failed to fetch posters', { error });
    }
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
      console.error('[dashboard]', 'Failed to start campaign', { error });
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
      console.error('[dashboard]', 'Failed to pause campaign', { error });
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
                      onChange={handleFileSelect}
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
                      <button
                        onClick={() => setActiveTab('leads')}
                        className={`px-6 py-3 border-b-2 font-medium ${activeTab === 'leads' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                        Leads ({leads.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('posters')}
                        className={`px-6 py-3 border-b-2 font-medium ${activeTab === 'posters' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                        Posters ({posters.length})
                        {posters.some((p) => p.status === 'pending_approval') && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                            {posters.filter((p) => p.status === 'pending_approval').length} need review
                          </span>
                        )}
                      </button>
                    </nav>
                  </div>

                  <div className="p-6">
                    {activeTab === 'leads' && (
                      <>
                        {(selectedCampaign.status === 'draft' || selectedCampaign.status === 'ready') && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Edit the Offer for each lead before starting. Leave blank to let AI generate one automatically.
                          </p>
                        )}
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
                                  <td className="py-2 px-2">
                                    {selectedCampaign.status === 'draft' || selectedCampaign.status === 'ready' ? (
                                      <input
                                        type="text"
                                        defaultValue={lead.offer || ''}
                                        placeholder="e.g. Flat 25% OFF"
                                        onBlur={(e) => {
                                          if (e.target.value !== (lead.offer || '')) {
                                            handleUpdateLeadOffer(lead.id, e.target.value);
                                          }
                                        }}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                                      />
                                    ) : (
                                      lead.offer || '-'
                                    )}
                                  </td>
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
                      </>
                    )}

                    {activeTab === 'posters' && (
                      <div>
                        {posters.length === 0 ? (
                          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No posters generated yet</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {posters.map((poster) => (
                              <div key={poster.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                {poster.finalPosterUrl ? (
                                  <img src={poster.finalPosterUrl} alt="Poster" className="w-full aspect-square object-cover" />
                                ) : (
                                  <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <ImageIcon className="w-10 h-10 text-gray-400" />
                                  </div>
                                )}
                                <div className="p-3">
                                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                    {poster.lead?.businessName || poster.lead?.name || 'Lead'}
                                  </p>
                                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                                    poster.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    poster.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                                    poster.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    poster.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {poster.status}
                                  </span>

                                  {poster.status === 'pending_approval' && (
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={() => handlePosterAction(poster.id, 'approve')}
                                        disabled={posterActionLoading === poster.id}
                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium py-1.5 rounded disabled:opacity-50"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handlePosterAction(poster.id, 'regenerate')}
                                        disabled={posterActionLoading === poster.id}
                                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-1.5 rounded disabled:opacity-50"
                                      >
                                        Regenerate
                                      </button>
                                      <button
                                        onClick={() => handlePosterAction(poster.id, 'reject')}
                                        disabled={posterActionLoading === poster.id}
                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-1.5 rounded disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
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