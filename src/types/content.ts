export type ContentStatus = 'draft' | 'ready' | 'published' | 'archived' | 'hidden';

export interface ContentWithRelations {
  id: string | number;
  title: string;
  slug: string;
  description?: string;
  summary?: string | null;
  original_score?: number | null;
  summary_score?: number | null;
  ai_metadata?: unknown | null;
  image_url?: string | null;
  image_source?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  cover_image?: string | null;
  content?: string | null;
  content_format?: string | null;
  source?: string | null;
  source_url?: string | null;
  status: ContentStatus;
  meta_title?: string | null;
  meta_description?: string | null;
  word_count?: number | null;
  reading_time?: number | null;
  view_count?: number | null;
  screenshot_api?: string | null;
  recommendation_reason?: string | null;
  featured?: boolean;
  collected_at?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  content_type: {
    id: number;
    name: string;
    slug: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  attributes: Array<{
    attribute_name: string;
    attribute_value: string;
    attribute_type: string;
  }>;
}

export interface ContentListResponse {
  data: ContentWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
