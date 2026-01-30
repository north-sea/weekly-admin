export type RssSourceType = 'normal' | 'aggregator';

export type RssSource = {
  id: number;
  name: string;
  feed_url: string;
  type: RssSourceType;
  enabled: boolean;
  content_type_id?: number;
  category_id?: number | null;
  config?: unknown;
  last_fetched_at?: string | null;
  fetch_count?: number;
  error_count?: number;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RssFetchResult = {
  source_id: number;
  feed_title?: string;
  fetched_at: string;
  total_items: number;
  created: number;
  created_content_ids: Array<number | string | bigint>;
  dedup_report: {
    total: number;
    new: number;
    duplicates: {
      from_inbox: number;
      from_contents: number;
      from_similarity: number;
      from_drafts?: number;
    };
    details: Array<{
      url: string;
      normalized_url: string;
      title?: string;
      reason: 'inbox' | 'content' | 'similar';
      existing_id?: number | string | bigint;
      existing_title?: string;
    }>;
  };
  errors: string[];
};
