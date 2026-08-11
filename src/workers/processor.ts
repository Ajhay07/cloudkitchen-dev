import { Worker } from 'bullmq';
import prisma from '@/lib/prisma';
import { logger, LogLevel } from '@/lib/logger';
import { SheetReader } from '@/services/sheetReader';
import { ColumnMapper } from '@/services/columnMapper';
import { PosterPromptGenerator } from '@/services/posterPromptGenerator';
import { ImageGenerator } from '@/services/imageGenerator';
import { PosterComposer } from '@/services/posterComposer';
import { WhatsAppSender } from '@/services/whatsappSender';
import queueService from '@/services/queue';
import { parseJson } from '@/lib/json';
import { redisConnection } from '@/lib/redis';

const sheetReader = new SheetReader();
const columnMapper = new ColumnMapper();
const promptGenerator = new PosterPromptGenerator();
const imageGenerator = new ImageGenerator();
const posterComposer = new PosterComposer();
const whatsappSender = new WhatsAppSender();

// Process Lead Worker
const processLeadWorker = new Worker(
  'process-lead',
  async (job) => {
    const { campaignId, leadId } = job.data;
    await logger.info('worker', 'Processing lead', { campaignId, leadId });

    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        throw new Error('Lead not found');
      }

      // Update lead status
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'processing' },
      });

      // Extract business info from raw data
      const rawData = parseJson<Record<string, any>>(lead.rawData) || {};

      // A user-edited offer (set via the leads review UI before starting the
      // campaign) takes precedence over the sheet/AI - captured before
      // enrichLead overwrites lead.offer below.
      const manualOffer = lead.offer || undefined;

      // Use AI to map columns
      const headers = Object.keys(rawData);
      const mappings = await columnMapper.mapColumns(headers, rawData);
      const mappedLead = await columnMapper.enrichLead(rawData, mappings);

      if (manualOffer) {
        mappedLead.offer = manualOffer;
      } else if (!mappedLead.offer || mappedLead.offer === 'No Offer') {
        // Generate missing offer if needed
        mappedLead.offer = await columnMapper.generateMissingOffer(
          mappedLead.businessName,
          mappedLead.restaurantType,
          mappedLead.address || mappedLead.city
        );
      }

      // Detect restaurant type if not present
      if (!mappedLead.restaurantType) {
        mappedLead.restaurantType = await columnMapper.detectRestaurantType(
          mappedLead.businessName,
          mappedLead.favoriteItem
        );
      }

      // Update lead with mapped data
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...mappedLead,
          status: 'completed',
          processedAt: new Date(),
        },
      });

      // Update job status
      await prisma.job.updateMany({
        where: { leadId, type: 'process_lead', status: 'pending' },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Queue poster generation
      const poster = await prisma.poster.create({
        data: {
          leadId,
          campaignId,
          status: 'pending',
          prompt: await promptGenerator.generatePrompt({
            businessName: mappedLead.businessName,
            name: mappedLead.name,
            offer: mappedLead.offer,
            address: mappedLead.address,
            phone: mappedLead.phone,
            restaurantType: mappedLead.restaurantType,
            favoriteItem: mappedLead.favoriteItem,
          }).then(p => p.prompt),
        },
      });

      await queueService.addGeneratePosterJob(campaignId, leadId, poster.id);

      await logger.info('worker', 'Lead processed successfully', { leadId, campaignId });
      return { success: true, leadId };
    } catch (error) {
      await logger.error('worker', 'Failed to process lead', { error, leadId, campaignId });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: { increment: 1 },
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Generate Poster Worker
const generatePosterWorker = new Worker(
  'generate-poster',
  async (job) => {
    const { campaignId, leadId, posterId } = job.data;
    await logger.info('worker', 'Generating poster', { campaignId, leadId, posterId });

    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      const poster = await prisma.poster.findUnique({
        where: { id: posterId },
      });

      if (!lead || !poster) {
        throw new Error('Lead or poster not found');
      }

      // Update poster status
      await prisma.poster.update({
        where: { id: posterId },
        data: { status: 'generating' },
      });

      // Generate poster prompt
      const posterPrompt = await promptGenerator.generatePrompt({
        businessName: lead.businessName || undefined,
        name: lead.name || undefined,
        offer: lead.offer || undefined,
        address: lead.address || undefined,
        phone: lead.phone || undefined,
        restaurantType: lead.restaurantType || undefined,
        favoriteItem: lead.favoriteItem || undefined,
      });

      // Generate background image
      const generatedImage = await imageGenerator.generateImage(posterPrompt.prompt);

      // Compose final poster
      const posterBuffer = await posterComposer.composePoster({
        backgroundImageUrl: generatedImage.url,
        businessName: lead.businessName || 'Restaurant',
        offer: lead.offer || 'Flat 20% OFF',
        address: lead.address || undefined,
        phone: lead.phone || undefined,
        customerName: lead.name || undefined,
        theme: posterPrompt.theme,
      });

      // Save poster locally too - whatsappSender's Meta media upload still
      // reads from local disk (fine, since it runs on the same machine as
      // this worker). The browser can't reach this machine's filesystem
      // though, so the poster is ALSO uploaded to Vercel Blob for a public
      // URL the deployed frontend can actually display.
      const fs = await import('fs/promises');
      const path = await import('path');

      const uploadsDir = path.join(process.cwd(), 'uploads', 'posters');
      await fs.mkdir(uploadsDir, { recursive: true });

      const fileName = `${posterId}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, posterBuffer);

      const { put } = await import('@vercel/blob');
      const blob = await put(`posters/${fileName}`, posterBuffer, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        // Regenerating a poster reuses the same posterId/filename - without
        // this, Blob refuses to overwrite and every regenerate attempt fails.
        allowOverwrite: true,
      });

      // Update poster record - poster is ready for human review, NOT auto-sent
      await prisma.poster.update({
        where: { id: posterId },
        data: {
          status: 'ready_for_review',
          finalPosterUrl: blob.url,
          prompt: posterPrompt.prompt,
          theme: posterPrompt.theme,
          detectedFoodType: posterPrompt.foodType,
        },
      });

      // Update campaign stats
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          processedLeads: { increment: 1 },
          successCount: { increment: 1 },
        },
      });

      // Update job status
      await prisma.job.updateMany({
        where: { posterId, type: 'generate_poster', status: 'pending' },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Do NOT queue WhatsApp message - poster must be approved by a human first
      await logger.info('worker', 'Poster generated and ready for review', { posterId, leadId });

      return { success: true, posterId };
    } catch (error) {
      await logger.error('worker', 'Failed to generate poster', { error, posterId });

      await prisma.poster.update({
        where: { id: posterId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          processedLeads: { increment: 1 },
          failedCount: { increment: 1 },
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Send WhatsApp Message Worker - with hard safety gate: only APPROVED posters can be sent
const sendMessageWorker = new Worker(
  'send-message',
  async (job) => {
    const { campaignId, leadId, posterId } = job.data;
    await logger.info('worker', 'Sending WhatsApp message', { campaignId, leadId, posterId });

    try {
      // SAFETY GATE: Re-read the latest poster state from the database.
      // A queued job is NOT proof of approval - the poster may have been
      // rejected or regenerated after the job was queued.
      let poster;
      if (posterId) {
        poster = await prisma.poster.findUnique({ where: { id: posterId } });
      } else {
        // Legacy fallback: find the most recent approved poster for this lead
        poster = await prisma.poster.findFirst({
          where: { leadId, status: 'approved' },
          orderBy: { updatedAt: 'desc' },
        });
      }

      if (!poster) {
        await logger.warn('worker', 'poster.whatsapp_blocked', {
          campaignId,
          leadId,
          posterId: posterId || undefined,
          reason: 'poster_not_found',
        });
        return { success: false, blocked: true, reason: 'poster_not_found' };
      }

      // Hard gate: status MUST be approved and approvedAt MUST exist
      if (poster.status !== 'approved' || !poster.approvedAt) {
        await logger.warn('worker', 'poster.whatsapp_blocked', {
          campaignId,
          leadId,
          posterId: poster.id,
          status: poster.status,
          reason: 'poster_not_approved',
        });
        // Return success (not throw) so BullMQ does not infinitely retry a permanently blocked job
        return { success: false, blocked: true, reason: 'poster_not_approved' };
      }

      // Check the poster's lead
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || !lead.phone) {
        await logger.warn('worker', 'poster.whatsapp_blocked', {
          campaignId,
          leadId,
          posterId: poster.id,
          reason: 'lead_or_phone_missing',
        });
        return { success: false, blocked: true, reason: 'lead_or_phone_missing' };
      }

      // Create message record
      const message = await prisma.message.create({
        data: {
          leadId,
          campaignId,
          toNumber: lead.phone,
          messageBody: `Hello ${lead.name || ''}, We created this exclusive poster for your business. Hope you like it!`,
          mediaUrl: poster.finalPosterUrl,
          status: 'pending',
        },
      });

      // Update poster to queued/sending state
      await prisma.poster.update({
        where: { id: poster.id },
        data: { status: 'sending' },
      });

      // Send WhatsApp message. The approved template's body already reads
      // "Hello {{1}}, We created this exclusive poster..." - only the
      // customer's name fills the placeholder, not the full sentence
      // (passing the full sentence duplicated the greeting on delivery).
      const result = await whatsappSender.sendMessage({
        to: lead.phone,
        body: lead.name || 'there',
        mediaUrl: message.mediaUrl || undefined,
      });

      // Update message status
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          messageSid: result.messageId,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : undefined,
        },
      });

      // Update poster status based on result
      await prisma.poster.update({
        where: { id: poster.id },
        data: {
          status: result.success ? 'sent' : 'failed',
        },
      });

      // Update lead status
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: result.success ? 'completed' : 'failed' },
      });

      await logger.info('worker', result.success ? 'poster.whatsapp_sent' : 'poster.whatsapp_failed', {
        messageId: message.id,
        posterId: poster.id,
        success: result.success,
      });
      return { success: result.success, messageId: message.id };
    } catch (error) {
      await logger.error('worker', 'Failed to send WhatsApp message', { error, leadId });

      await prisma.message.updateMany({
        where: { leadId, status: 'pending' },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

// Graceful shutdown
process.on('SIGINT', async () => {
  await logger.info('worker', 'Shutting down workers...');
  await Promise.all([
    processLeadWorker.close(),
    generatePosterWorker.close(),
    sendMessageWorker.close(),
  ]);
  process.exit(0);
});

logger.info('worker', 'All workers started successfully');