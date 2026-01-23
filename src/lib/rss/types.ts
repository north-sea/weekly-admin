export type RssSourceType = 'normal' | 'aggregator';

export type DeduplicationConfig = {
  normalize_url: boolean;
  check_similarity: boolean;
  similarity_threshold: number;
  check_days: number;
};

export type AggregatorConfig = {
  extract_links: boolean;
  max_links_per_item: number;
  exclude_domains: string[];
  allowed_domains: string[];
  keep_relation: boolean;
};

export type RssSourceConfig = {
  deduplication?: Partial<DeduplicationConfig>;
  aggregator?: Partial<AggregatorConfig>;
};

export type ParsedFeedItem = {
  title: string;
  link: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  publishedAt?: string;
};

export type ParsedFeed = {
  title?: string;
  items: ParsedFeedItem[];
};

export type DuplicateSource = 'drafts' | 'contents';

export type DuplicateCheckResult = {
  exists: boolean;
  normalized_url: string;
  source?: DuplicateSource;
  id?: number | string | bigint;
  title?: string;
  matched_url?: string;
};

export type DeduplicationReport = {
  total: number;
  new: number;
  duplicates: {
    from_drafts: number;
    from_contents: number;
    from_similarity: number;
  };
  details: Array<{
    url: string;
    normalized_url: string;
    title?: string;
    reason: 'draft' | 'content' | 'similar';
    existing_id?: number | string | bigint;
    existing_title?: string;
  }>;
};

export type RssFetchResult = {
  source_id: number;
  feed_title?: string;
  fetched_at: string;
  total_items: number;
  created: number;
  created_content_ids: Array<number | string | bigint>;
  dedup_report: DeduplicationReport;
  errors: string[];
};
