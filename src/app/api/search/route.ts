import { NextRequest, NextResponse } from 'next/server';
import { searchContentsWithFallback, getSearchSuggestions, SearchOptions } from '@/lib/search';
import { z } from 'zod';

// Search request validation schema
const SearchRequestSchema = z.object({
  q: z.string().optional().default(''),
  contentType: z.enum(['blog', 'weekly']).optional(),
  status: z.array(z.string()).optional(),
  categoryIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
  dateRange: z.array(z.string()).length(2).optional(),
  sources: z.array(z.string()).optional(),
  userId: z.number().optional(),
  sort: z.array(z.string()).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  highlight: z.boolean().optional().default(true),
});

// Search suggestions request schema
const SuggestionsRequestSchema = z.object({
  q: z.string().min(1),
  limit: z.number().min(1).max(20).optional().default(5),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Handle search suggestions
    if (action === 'suggestions') {
      const query = searchParams.get('q');
      const limit = parseInt(searchParams.get('limit') || '5');
      
      const validation = SuggestionsRequestSchema.safeParse({ q: query, limit });
      if (!validation.success) {
        return NextResponse.json({
          success: false,
          error: 'Invalid request parameters',
          details: validation.error.issues,
        }, { status: 400 });
      }
      
      const suggestions = await getSearchSuggestions(validation.data.q, validation.data.limit);
      
      return NextResponse.json({
        success: true,
        data: {
          suggestions,
          query: validation.data.q,
        },
      });
    }
    
    // Handle main search
    const params: any = {
      q: searchParams.get('q') || '',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      highlight: searchParams.get('highlight') !== 'false',
    };
    
    // Parse optional parameters
    if (searchParams.get('contentType')) {
      params.contentType = searchParams.get('contentType');
    }
    
    if (searchParams.get('status')) {
      params.status = searchParams.get('status')?.split(',');
    }
    
    if (searchParams.get('categoryIds')) {
      params.categoryIds = searchParams.get('categoryIds')?.split(',').map(Number);
    }
    
    if (searchParams.get('tagIds')) {
      params.tagIds = searchParams.get('tagIds')?.split(',').map(Number);
    }
    
    if (searchParams.get('sources')) {
      params.sources = searchParams.get('sources')?.split(',');
    }
    
    if (searchParams.get('userId')) {
      params.userId = parseInt(searchParams.get('userId')!);
    }
    
    if (searchParams.get('dateRange')) {
      params.dateRange = searchParams.get('dateRange')?.split(',');
    }
    
    if (searchParams.get('sort')) {
      params.sort = searchParams.get('sort')?.split(',');
    }
    
    // Validate request
    const validation = SearchRequestSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: validation.error.issues,
      }, { status: 400 });
    }
    
    const { q, contentType, status, categoryIds, tagIds, dateRange, sources, userId, sort, page, limit, highlight } = validation.data;
    
    // Build search options
    const searchOptions: SearchOptions = {
      query: q,
      filters: {
        contentType,
        status,
        categoryIds,
        tagIds,
        dateRange: dateRange as [string, string] | undefined,
        sources,
        userId,
      },
      sort,
      page,
      limit,
      attributesToHighlight: highlight ? ['title', 'description', 'content'] : [],
    };
    
    // Perform search
    const result = await searchContentsWithFallback(searchOptions);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error) {
    console.error('Search API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      message: errorMessage,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = SearchRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.issues,
      }, { status: 400 });
    }
    
    const { q, contentType, status, categoryIds, tagIds, dateRange, sources, userId, sort, page, limit, highlight } = validation.data;
    
    // Build search options
    const searchOptions: SearchOptions = {
      query: q,
      filters: {
        contentType,
        status,
        categoryIds,
        tagIds,
        dateRange: dateRange as [string, string] | undefined,
        sources,
        userId,
      },
      sort,
      page,
      limit,
      attributesToHighlight: highlight ? ['title', 'description', 'content'] : [],
    };
    
    // Perform search
    const result = await searchContentsWithFallback(searchOptions);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error) {
    console.error('Search API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      message: errorMessage,
    }, { status: 500 });
  }
}
