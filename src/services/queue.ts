import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export interface JobData {
  campaignId: string;
  leadId?: string;
  posterId?: string;
  type: 'process_lead' | 'generate_poster' | 'send_message';
}

class QueueService {
  private processQueue: Queue;
  private posterQueue: Queue;
  private messageQueue: Queue;

  constructor() {
    this.processQueue = new Queue('process-lead', {
      connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    this.posterQueue = new Queue('generate-poster', {
      connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    this.messageQueue = new Queue('send-message', {
      connection: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    const queues = [this.processQueue, this.posterQueue, this.messageQueue] as any[];
    queues.forEach(queue => {
      queue.on('completed', (job: any) => {
        logger.info('queue', `Job completed: ${job.id}`, { type: job.data.type });
      });
      queue.on('failed', (job: any, err: any) => {
        logger.error('queue', `Job failed: ${job?.id}`, { error: err?.message, type: job?.data?.type });
      });
    });
  }

  async addProcessLeadJob(campaignId: string, leadId: string) {
    const job = await this.processQueue.add('process-lead', { campaignId, leadId, type: 'process_lead' });
    await this.createJobRecord(campaignId, 'process_lead', leadId, job.id!);
    return job;
  }

  async addGeneratePosterJob(campaignId: string, leadId: string, posterId: string) {
    const job = await this.posterQueue.add('generate-poster', { campaignId, leadId, posterId, type: 'generate_poster' });
    await this.createJobRecord(campaignId, 'generate_poster', leadId, job.id!, posterId);
    return job;
  }

  async addSendMessageJob(campaignId: string, leadId: string) {
    const job = await this.messageQueue.add('send-message', { campaignId, leadId, type: 'send_message' });
    await this.createJobRecord(campaignId, 'send_message', leadId, job.id!);
    return job;
  }

  private async createJobRecord(
    campaignId: string,
    type: string,
    leadId: string,
    jobId: string,
    posterId?: string
  ) {
    try {
      const queueName = type === 'process_lead' ? 'process-lead' : type === 'generate_poster' ? 'generate-poster' : 'send-message';
      await prisma.job.create({
        data: { campaignId, type, leadId, posterId, queueName, jobId, status: 'pending' },
      });
    } catch (error) {
      logger.error('queue', 'Failed to create job record', { error });
    }
  }

  async getQueueStats() {
    try {
      const [processWaiting, processActive, posterWaiting, posterActive, messageWaiting, messageActive] = await Promise.all([
        this.processQueue.getWaitingCount(),
        this.processQueue.getActiveCount(),
        this.posterQueue.getWaitingCount(),
        this.posterQueue.getActiveCount(),
        this.messageQueue.getWaitingCount(),
        this.messageQueue.getActiveCount(),
      ]);

      return {
        processLead: { waiting: processWaiting, active: processActive },
        generatePoster: { waiting: posterWaiting, active: posterActive },
        sendMessage: { waiting: messageWaiting, active: messageActive },
      };
    } catch (error) {
      logger.error('queue', 'Failed to get queue stats', { error });
      return null;
    }
  }

  async close() {
    await Promise.all([
      this.processQueue.close(),
      this.posterQueue.close(),
      this.messageQueue.close(),
    ]);
  }
}

export const queueService = new QueueService();
export default queueService;