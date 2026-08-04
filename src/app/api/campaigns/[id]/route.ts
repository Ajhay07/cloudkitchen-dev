import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import queueService from '@/services/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        leads: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        posters: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    logger.error('api', 'Failed to fetch campaign', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'start') {
      // Start processing campaign
      const campaign = await prisma.campaign.findUnique({
        where: { id: params.id },
        include: {
          leads: {
            where: { status: 'pending' },
          },
        },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Update campaign status
      await prisma.campaign.update({
        where: { id: params.id },
        data: { status: 'processing' },
      });

      // Queue all pending leads
      for (const lead of campaign.leads) {
        await queueService.addProcessLeadJob(campaign.id, lead.id);
      }

      logger.info('api', 'Campaign started', { campaignId: params.id, leadsCount: campaign.leads.length });

      return NextResponse.json({ success: true, message: 'Campaign started' });
    }

    if (action === 'pause') {
      await prisma.campaign.update({
        where: { id: params.id },
        data: { status: 'paused' },
      });

      logger.info('api', 'Campaign paused', { campaignId: params.id });
      return NextResponse.json({ success: true, message: 'Campaign paused' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('api', 'Failed to update campaign', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.campaign.delete({
      where: { id: params.id },
    });

    logger.info('api', 'Campaign deleted', { campaignId: params.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('api', 'Failed to delete campaign', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}