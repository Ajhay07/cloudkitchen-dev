import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import queueService from '@/services/queue';

export class PosterApprovalService {
  async approvePoster(posterId: string) {
    const poster = await prisma.poster.findUnique({
      where: { id: posterId },
      include: { lead: true },
    });

    if (!poster) {
      throw new Error('Poster not found');
    }

    if (poster.status !== 'ready_for_review') {
      throw new Error(`Poster cannot be approved from status: ${poster.status}`);
    }

    if (!poster.finalPosterUrl) {
      throw new Error('Poster has no generated image');
    }

    const updated = await prisma.poster.update({
      where: { id: posterId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        rejectedAt: null,
      },
    });

    await logger.info('poster', 'poster.approved', {
      posterId,
      campaignId: poster.campaignId,
      leadId: poster.leadId,
    });

    // Update campaign counters
    await prisma.campaign.update({
      where: { id: poster.campaignId },
      data: {
        approvedCount: { increment: 1 },
        rejectedCount: poster.rejectedAt ? { decrement: 1 } : undefined,
      },
    });

    // Queue WhatsApp send for this exact poster
    await queueService.addSendMessageJob(poster.campaignId, poster.leadId, posterId);
    await logger.info('poster', 'poster.whatsapp_queued', {
      posterId,
      campaignId: poster.campaignId,
      leadId: poster.leadId,
    });

    return updated;
  }

  async rejectPoster(posterId: string) {
    const poster = await prisma.poster.findUnique({
      where: { id: posterId },
    });

    if (!poster) {
      throw new Error('Poster not found');
    }

    if (poster.status !== 'ready_for_review') {
      throw new Error(`Poster cannot be rejected from status: ${poster.status}`);
    }

    const updated = await prisma.poster.update({
      where: { id: posterId },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
      },
    });

    await prisma.campaign.update({
      where: { id: poster.campaignId },
      data: {
        rejectedCount: { increment: 1 },
      },
    });

    await logger.info('poster', 'poster.rejected', {
      posterId,
      campaignId: poster.campaignId,
      leadId: poster.leadId,
    });

    return updated;
  }

  async regeneratePoster(posterId: string, instruction?: string) {
    const poster = await prisma.poster.findUnique({
      where: { id: posterId },
      include: { lead: true },
    });

    if (!poster || !poster.lead) {
      throw new Error('Poster or lead not found');
    }

    const allowedFrom = ['ready_for_review', 'rejected', 'approved', 'failed'];
    if (!allowedFrom.includes(poster.status)) {
      throw new Error(`Poster cannot be regenerated from status: ${poster.status}`);
    }

    const lead = poster.lead;

    // Mark as regenerating and clear approval
    await prisma.poster.update({
      where: { id: posterId },
      data: {
        status: 'regenerating',
        approvedAt: null,
        rejectedAt: null,
      },
    });

    await logger.info('poster', 'poster.regeneration_requested', {
      posterId,
      campaignId: poster.campaignId,
      leadId: poster.leadId,
      instruction: instruction || undefined,
    });

    // Store instruction in prompt for next generation
    const basePrompt = poster.prompt || '';
    const promptWithInstruction = instruction
      ? `${basePrompt}\n\nAdditional user instruction: ${instruction}`
      : basePrompt;

    // Update poster with instruction and queue regeneration through existing pipeline
    await prisma.poster.update({
      where: { id: posterId },
      data: {
        prompt: promptWithInstruction,
      },
    });

    await queueService.addGeneratePosterJob(poster.campaignId, lead.id, posterId);

    await logger.info('poster', 'poster.regeneration_queued', {
      posterId,
      campaignId: poster.campaignId,
      leadId: poster.leadId,
    });

    return poster;
  }
}

export const posterApprovalService = new PosterApprovalService();
export default posterApprovalService;