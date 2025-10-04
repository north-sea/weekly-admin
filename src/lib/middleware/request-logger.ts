import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../logger';

export function createRequestLogger() {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Add request ID to headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    
    // Log incoming request
    logger.info('Incoming request', {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      ip: request.ip || request.headers.get('x-forwarded-for'),
      type: 'request_start'
    });

    // Continue with the request
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Log response (this will be called after the request is processed)
    const duration = Date.now() - startTime;
    logger.request(
      request.method,
      request.url,
      response.status,
      duration,
      {
        requestId,
        ip: request.ip || request.headers.get('x-forwarded-for'),
      }
    );

    // Add request ID to response headers
    response.headers.set('x-request-id', requestId);
    
    return response;
  };
}

// Utility to get request ID from headers
export function getRequestId(request: Request): string | null {
  return request.headers.get('x-request-id');
}

// Utility to create context with request ID
export function createRequestContext(request: Request, additionalContext?: Record<string, any>) {
  const requestId = getRequestId(request);
  return {
    requestId,
    ...additionalContext,
  };
}