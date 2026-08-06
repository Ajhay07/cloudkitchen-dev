import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import queueService from '@/services/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const posters = await prisma.poster.findMany({
      where: { campaignId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        lead: {
          select: {
            name: true,
            businessName: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json(posters);
  } catch (error) {
    logger.error('api', 'Failed to fetch posters', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to fetch posters' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { posterId, action } = await request.json();

    if (!posterId || !['approve', 'reject', 'regenerate'].includes(action)) {
      return NextResponse.json({ error: 'posterId and a valid action are required' }, { status: 400 });
    }

    const poster = await prisma.poster.findUnique({ where: { id: posterId } });
    if (!poster || poster.campaignId !== params.id) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    if (action === 'approve') {
      await prisma.poster.update({
        where: { id: posterId },
        data: { status: 'approved', approvedAt: new Date() },
      });
      await prisma.campaign.update({
        where: { id: params.id },
        data: { approvedCount: { increment: 1 } },
      });
      await queueService.addSendMessageJob(params.id, poster.leadId);
      logger.info('api', 'Poster approved and queued for sending', { posterId });
    } else if (action === 'reject') {
      await prisma.poster.update({
        where: { id: posterId },
        data: { status: 'rejected', rejectedAt: new Date() },
      });
      await prisma.campaign.update({
        where: { id: params.id },
        data: { rejectedCount: { increment: 1 } },
      });
      logger.info('api', 'Poster rejected', { posterId });
    } else if (action === 'regenerate') {
      await prisma.poster.update({
        where: { id: posterId },
        data: { status: 'generating', approvedAt: null, rejectedAt: null },
      });
      await queueService.addGeneratePosterJob(params.id, poster.leadId, posterId);
      logger.info('api', 'Poster regeneration queued', { posterId });
    }

    const updated = await prisma.poster.findUnique({ where: { id: posterId } });
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('api', 'Failed to update poster', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to update poster' }, { status: 500 });
  }
}