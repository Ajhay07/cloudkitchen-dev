import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

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
            address: true,
            city: true,
            offer: true,
            favoriteItem: true,
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
