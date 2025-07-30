import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export interface MeResponse {
  success: boolean;
  data?: {
    user: {
      id: number;
      username: string;
      email: string | null;
      displayName: string | null;
      role: string;
      status: string;
    };
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication required',
      } as MeResponse, { status: 401 });
    }

    const response: MeResponse = {
      success: true,
      data: {
        user: authResult.user,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Me API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    } as MeResponse, { status: 500 });
  }
}