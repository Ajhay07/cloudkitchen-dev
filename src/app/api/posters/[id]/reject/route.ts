import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { posterApprovalService } from '@/services/posterApprovalService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await posterApprovalService.rejectPoster(params.id);
    return NextResponse.json({ success: true, poster: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject poster';
    logger.error('api', 'Failed to reject poster', { error, posterId: params.id });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}