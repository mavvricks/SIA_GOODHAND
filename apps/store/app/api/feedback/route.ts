import { NextResponse, type NextRequest } from 'next/server';
import { feedbackService } from '@/lib/services/feedback-service';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@prototype/logger';

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { category: 'VALIDATION_FAILED', message: 'Invalid JSON request body' } },
      { status: 422 }
    );
  }

  // Session user if available
  const user = await getSessionUser(req);
  const userId = user ? user.email : 'anonymous';

  try {
    const result = await feedbackService.submitFeedback(
      {
        orderNumber: body.orderNumber,
        userId: body.userId || userId,
        technicianRating: body.technicianRating,
        technicianComment: body.technicianComment,
        technicianTags: body.technicianTags,
        storeRating: body.storeRating,
        storeComment: body.storeComment,
        storeTags: body.storeTags
      },
      correlationId
    );

    return NextResponse.json(
      {
        success: true,
        feedback: result.feedback,
        isUpdate: result.isUpdate,
        message: result.isUpdate ? 'Feedback updated successfully' : 'Thank you for your feedback!'
      },
      { status: result.isUpdate ? 200 : 201 }
    );
  } catch (err: any) {
    logger.warn({ correlationId, orderNumber: body.orderNumber, error: err.message }, 'Feedback submission error');
    const status = err.category === 'NOT_FOUND' ? 404
      : err.category === 'VALIDATION_FAILED' ? 422
      : err.category === 'BUSINESS_RULE_VIOLATED' ? 409
      : 500;

    return NextResponse.json(
      {
        error: {
          category: err.category || 'UNEXPECTED_ERROR',
          message: err.message,
          ...(err.field ? { field: err.field } : {}),
          correlationId
        }
      },
      { status }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('orderNumber');

  if (!orderNumber) {
    return NextResponse.json(
      { error: { category: 'VALIDATION_FAILED', message: 'orderNumber query parameter is required' } },
      { status: 422 }
    );
  }

  const user = await getSessionUser(req);
  const userId = user ? user.email : undefined;

  try {
    const feedback = feedbackService.getFeedback(orderNumber, userId);
    if (!feedback) {
      return NextResponse.json(
        { error: { category: 'NOT_FOUND', message: `Feedback for order ${orderNumber} not found` } },
        { status: 404 }
      );
    }
    return NextResponse.json({ feedback });
  } catch (err: any) {
    const status = err.category === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json(
      { error: { category: err.category || 'UNEXPECTED_ERROR', message: err.message } },
      { status }
    );
  }
}
