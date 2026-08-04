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
      const rawData = lead.rawData as Record<string, any>;
      
      // Use AI to map columns
      const headers = Object.keys(rawData);
      const mappings = await columnMapper.mapColumns(headers, rawData);
      const mappedLead = await columnMapper.enrichLead(rawData, mappings);

      // Generate missing offer if needed
      if (!mappedLead.offer || mappedLead.offer === 'No Offer') {
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
    connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
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
        address: lead.address,
        phone: lead.phone,
        customerName: lead.name,
        theme: posterPrompt.theme,
      });

      // Save poster to file system (in production, use S3 or similar)
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', 'posters');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const fileName = `${posterId}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, posterBuffer);

      // Update poster record
      await prisma.poster.update({
        where: { id: posterId },
        data: {
          status: 'completed',
          finalPosterUrl: `/uploads/posters/${fileName}`,
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

      // Queue WhatsApp message
      await queueService.addSendMessageJob(campaignId, leadId);

      await logger.info('worker', 'Poster generated successfully', { posterId, leadId });
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
    connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
    concurrency: 3,
  }
);

// Send WhatsApp Message Worker
const sendMessageWorker = new Worker(
  'send-message',
  async (job) => {
    const { campaignId, leadId } = job.data;
    await logger.info('worker', 'Sending WhatsApp message', { campaignId, leadId });

    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          posters: {
            where: { status: 'completed' },
            take: 1,
          },
        },
      });

      if (!lead || !lead.posters[0]) {
        throw new Error('Lead or poster not found');
      }

      const poster = lead.posters[0];

      // Create message record
      const message = await prisma.message.create({
        data: {
          leadId,
          campaignId,
          toNumber: lead.phone || '',
          messageBody: `Hello ${lead.name || ''}, We created this exclusive poster for your business. Hope you like it!`,
          mediaUrl: poster.finalPosterUrl,
          status: 'pending',
        },
      });

      // Send WhatsApp message
      const result = await whatsappSender.sendMessage({
        to: lead.phone || '',
        body: message.messageBody || '',
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

      // Update lead status
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'completed' },
      });

      await logger.info('worker', 'WhatsApp message sent', { messageId: message.id, success: result.success });
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
    connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
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