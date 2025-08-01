import { NextRequest, NextResponse } from 'next/server';
import { initializeApplication, isApplicationInitialized } from '@/lib/startup';

/**
 * Health check endpoint that includes startup validation
 * This endpoint can be used by Docker health checks and monitoring systems
 */
export async function GET(request: NextRequest) {
  try {
    // Check if application is already initialized
    if (isApplicationInitialized()) {
      return NextResponse.json({
        success: true,
        status: 'healthy',
        message: 'Application is running and all services are connected',
        timestamp: new Date().toISOString(),
        initialized: true
      });
    }

    // Initialize application if not already done
    const config = await initializeApplication();

    return NextResponse.json({
      success: true,
      status: 'healthy',
      message: 'Application initialized successfully and all services are connected',
      timestamp: new Date().toISOString(),
      initialized: true,
      environment: config.nodeEnv,
      services: {
        database: 'connected',
        meilisearch: 'connected',
        imageUpload: config.imageUploadUrl ? 'configured' : 'not_configured'
      }
    });

  } catch (error) {
    console.error('Startup health check failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      message: 'Application startup validation failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
      initialized: false
    }, { status: 503 });
  }
}

/**
 * POST endpoint to force re-initialization (for development/debugging)
 */
export async function POST(request: NextRequest) {
  try {
    // Force re-initialization by resetting state
    const { resetApplicationState } = await import('@/lib/startup');
    resetApplicationState();

    // Re-initialize
    const config = await initializeApplication();

    return NextResponse.json({
      success: true,
      status: 'reinitialized',
      message: 'Application re-initialized successfully',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      services: {
        database: 'connected',
        meilisearch: 'connected',
        imageUpload: config.imageUploadUrl ? 'configured' : 'not_configured'
      }
    });

  } catch (error) {
    console.error('Application re-initialization failed:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      status: 'failed',
      message: 'Application re-initialization failed',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}