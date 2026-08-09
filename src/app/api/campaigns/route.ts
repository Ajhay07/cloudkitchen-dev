import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SheetReader } from '@/services/sheetReader';
import queueService from '@/services/queue';
import { serializeJson } from '@/lib/json';

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            leads: true,
            posters: true,
            messages: true,
          },
        },
      },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    logger.error('api', 'Failed to fetch campaigns', { error });
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const sheetType = formData.get('sheetType') as string;
    const sheetUrl = formData.get('sheetUrl') as string | null;
    const file = formData.get('file') as File | null;

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        name,
        sheetType: sheetType as any,
        sheetUrl: sheetUrl || undefined,
        status: 'draft',
      },
    });

    let sheetData;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const sheetReader = new SheetReader();
      sheetData = await sheetReader.readFromFile(buffer, file.name);
    } else if (sheetUrl) {
      const sheetReader = new SheetReader();
      sheetData = await sheetReader.readFromUrl(sheetUrl);
    } else {
      return NextResponse.json({ error: 'Either file or sheet URL is required' }, { status: 400 });
    }

    // Create leads
    for (const row of sheetData.rows) {
      await prisma.lead.create({
        data: {
          campaignId: campaign.id,
          rawData: serializeJson(row) || '{}',
        },
      });
    }

    // Update campaign stats
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        totalLeads: sheetData.rows.length,
        status: 'ready',
      },
    });

    logger.info('api', 'Campaign created', { campaignId: campaign.id, totalLeads: sheetData.rows.length });

    return NextResponse.json(campaign);
  } catch (error) {
    logger.error('api', 'Failed to create campaign', { error });
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}