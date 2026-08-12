import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import queueService from '@/services/queue';
import { PosterPromptGenerator } from '@/services/posterPromptGenerator';

const promptGenerator = new PosterPromptGenerator();

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

    // Always rebuild a clean base prompt from the lead's fields rather than
    // reusing poster.prompt - that field accumulates every previous
    // instruction verbatim, so a second regenerate would stack a new
    // override on top of the last one (two conflicting "IMPORTANT OVERRIDE
    // INSTRUCTION" blocks fighting each other, plus the stale food item
    // still mentioned underneath). Each regenerate call starts fresh and
    // applies only the instruction given this time.
    const { prompt: basePrompt } = await promptGenerator.generatePrompt(
      {
        businessName: lead.businessName || undefined,
        name: lead.name || undefined,
        offer: lead.offer || undefined,
        address: lead.address || undefined,
        phone: lead.phone || undefined,
        restaurantType: lead.restaurantType || undefined,
        favoriteItem: lead.favoriteItem || undefined,
      },
      { forCustomInstruction: !!instruction }
    );
    const promptWithInstruction = instruction
      ? `IMPORTANT OVERRIDE INSTRUCTION - this is a mandatory requirement, not a suggestion, and takes absolute priority over every other line in this prompt, including composition/layout/subject details below: ${instruction}\n\n${basePrompt}`
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