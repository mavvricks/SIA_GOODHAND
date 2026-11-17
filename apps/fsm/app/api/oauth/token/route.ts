import { NextResponse, type NextRequest } from 'next/server';
import { createServiceToken } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { allowAuthAttempt } from '../../../../../../packages/database/rate-limit.mjs';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && (!process.env.STORE_SERVICE_CLIENT_SECRET || !process.env.FSM_SESSION_SECRET)) return createErrorResponse('SERVICE_UNAVAILABLE', 'Service authentication is not configured.');
  try {
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    let grantType: string | undefined;
    let scope: string | undefined;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      clientId = body.clientId || body.client_id;
      clientSecret = body.clientSecret || body.client_secret;
      grantType = body.grantType || body.grant_type;
      scope = body.scope;
    } else {
      const formData = await req.formData();
      clientId = formData.get('client_id')?.toString() || formData.get('clientId')?.toString();
      clientSecret = formData.get('client_secret')?.toString() || formData.get('clientSecret')?.toString();
      grantType = formData.get('grant_type')?.toString() || formData.get('grantType')?.toString();
      scope = formData.get('scope')?.toString();
    }

    if (typeof clientId !== 'string' || clientId.length > 128 || typeof clientSecret !== 'string' || clientSecret.length > 1024 || (scope !== undefined && (typeof scope !== 'string' || scope.length > 1000))) return createErrorResponse('VALIDATION_FAILED', 'Invalid client credentials or scope.');
    if (!(await allowAuthAttempt('fsm', 'oauth', req.headers.get('x-forwarded-for')?.split(',')[0] || '', clientId))) return createErrorResponse('RATE_LIMITED', 'Too many token requests. Try again in five minutes.');
    if (grantType !== 'client_credentials') {
      return createErrorResponse('VALIDATION_FAILED', 'Unsupported grant_type. Must be client_credentials.');
    }

    // Verify client credentials against configured environment or service client store
    const validStoreId = process.env.STORE_SERVICE_CLIENT_ID || 'store-service';
    const validStoreSecret = process.env.STORE_SERVICE_CLIENT_SECRET || 'change_me_store_service_secret_at_least_32_characters';

    if (clientId !== validStoreId || clientSecret !== validStoreSecret) {
      return createErrorResponse('AUTHENTICATION_REQUIRED', 'Invalid client credentials.');
    }

    const requestedScopes = scope ? scope.split(' ') : [
      'installations:create',
      'installations:read',
      'installations:update',
      'feedback:write',
      'stock:read',
      'webhooks:schedule',
      'webhooks:status',
      'webhooks:completion',
      'webhooks:inventory',
      'catalog:read'
    ];

    const allowedScopes = new Set(['installations:create', 'installations:read', 'installations:update', 'feedback:write', 'stock:read', 'webhooks:schedule', 'webhooks:status', 'webhooks:completion', 'webhooks:inventory', 'catalog:read']);
    if (requestedScopes.some(requested => !allowedScopes.has(requested))) return createErrorResponse('FORBIDDEN_SCOPE', 'Unsupported service scope.');

    const token = await createServiceToken(clientId, requestedScopes);

    return NextResponse.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 900,
      scope: requestedScopes.join(' ')
    });
  } catch (err: any) {
    return createErrorResponse('UNEXPECTED_ERROR', err?.message || 'Token generation failed');
  }
}
