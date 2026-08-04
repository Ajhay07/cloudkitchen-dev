import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {
      campaignId: params.id,
    };

    if (level) {
      where.level = level;
    }

    const logs = await prisma.log.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    logger.error('api', 'Failed to fetch logs', { error, campaignId: params.id });
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}