import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface CampaignAnalytics {
  totalCampaigns: number;
  totalLeads: number;
  totalPosters: number;
  totalMessages: number;
  successRate: number;
  avgGenerationTime: number;
  avgAiCost: number;
  cuisineDistribution: Record<string, number>;
  layoutUsage: Record<string, number>;
  offerDistribution: Record<string, number>;
  failureReasons: Array<{ reason: string; count: number }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    successRate: number;
    totalLeads: number;
  }>;
}

export class AnalyticsService {
  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          leads: true,
          posters: true,
          messages: true,
          logs: true,
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const totalLeads = campaign.totalLeads;
      const successRate = totalLeads > 0 ? (campaign.successCount / totalLeads) * 100 : 0;
      
      // Cuisine distribution
      const cuisineDistribution: Record<string, number> = {};
      campaign.leads.forEach((lead: any) => {
        const cuisine = lead.cuisine || 'Unknown';
        cuisineDistribution[cuisine] = (cuisineDistribution[cuisine] || 0) + 1;
      });

      // Layout usage
      const layoutUsage: Record<string, number> = {};
      campaign.posters.forEach((poster: any) => {
        const layout = poster.layout || 'premium_dark';
        layoutUsage[layout] = (layoutUsage[layout] || 0) + 1;
      });

      // Offer distribution
      const offerDistribution: Record<string, number> = {};
      campaign.leads.forEach((lead: any) => {
        const offer = lead.offer || 'No Offer';
        offerDistribution[offer] = (offerDistribution[offer] || 0) + 1;
      });

      // Failure reasons
      const failureMap: Record<string, number> = {};
      campaign.leads.filter((l: any) => l.errorMessage).forEach((lead: any) => {
        const error = lead.errorMessage || 'Unknown';
        failureMap[error] = (failureMap[error] || 0) + 1;
      });
      const failureReasons = Object.entries(failureMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const analytics: CampaignAnalytics = {
        totalCampaigns: 1,
        totalLeads: campaign.totalLeads,
        totalPosters: campaign.posters.length,
        totalMessages: campaign.messages.length,
        successRate: Math.round(successRate * 100) / 100,
        avgGenerationTime: campaign.avgGenerationTime || 0,
        avgAiCost: campaign.avgAiCost || 0,
        cuisineDistribution,
        layoutUsage,
        offerDistribution,
        failureReasons,
        topCampaigns: [{
          id: campaign.id,
          name: campaign.name,
          successRate: Math.round(successRate * 100) / 100,
          totalLeads: campaign.totalLeads,
        }],
      };

      logger.info('analytics', 'Campaign analytics generated', { campaignId, successRate });
      return analytics;
    } catch (error) {
      logger.error('analytics', 'Failed to generate analytics', { error, campaignId });
      throw error;
    }
  }

  async getGlobalAnalytics(): Promise<{
    totalCampaigns: number;
    totalLeads: number;
    totalPosters: number;
    totalMessages: number;
    avgSuccessRate: number;
    topCuisines: Array<{ cuisine: string; count: number }>;
    recentCampaigns: Array<{
      id: string;
      name: string;
      status: string;
      createdAt: string;
      totalLeads: number;
    }>;
  }> {
    try {
      const [
        totalCampaigns,
        totalLeads,
        totalPosters,
        totalMessages,
        campaigns,
        leads,
      ] = await Promise.all([
        prisma.campaign.count(),
        prisma.lead.count(),
        prisma.poster.count(),
        prisma.message.count(),
        prisma.campaign.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            totalLeads: true,
          },
        }),
        prisma.lead.findMany({
          select: { cuisine: true },
        }),
      ]);

      const successRate = totalLeads > 0 
        ? (await prisma.lead.count({ where: { status: 'completed' } }) / totalLeads) * 100 
        : 0;

      const cuisineMap: Record<string, number> = {};
      leads.forEach((lead: any) => {
        const cuisine = lead.cuisine || 'Unknown';
        cuisineMap[cuisine] = (cuisineMap[cuisine] || 0) + 1;
      });
      const topCuisines = Object.entries(cuisineMap)
        .map(([cuisine, count]) => ({ cuisine, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalCampaigns,
        totalLeads,
        totalPosters,
        totalMessages,
        avgSuccessRate: Math.round(successRate * 100) / 100,
        topCuisines,
        recentCampaigns: campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
      };
    } catch (error) {
      logger.error('analytics', 'Failed to get global analytics', { error });
      throw error;
    }
  }
}