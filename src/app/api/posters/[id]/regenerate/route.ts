import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { posterApprovalService } from '@/services/posterApprovalService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let instruction: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.instruction === 'string' && body.instruction.trim()) {
        instruction = body.instruction.trim().slice(0, 500);
      }
    } catch {
      // No body or invalid JSON - instruction is optional
    }

    const result = await posterApprovalService.regeneratePoster(params.id, instruction);
    return NextResponse.json({ success: true, poster: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to regenerate poster';
    logger.error('api', 'Failed to regenerate poster', { error, posterId: params.id });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}