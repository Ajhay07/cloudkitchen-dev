import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leads = await prisma.lead.findMany({
      where: { campaignId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return NextResponse.json(leads);
  } catch (error) {
    logger.error('api', 'Failed to fetch leads', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}