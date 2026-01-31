export interface CategoryWithStats {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  description?: string;
  sort_order: number;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
  content_count: number;
  children?: CategoryWithStats[];
  parent?: {
    id: number;
    name: string;
    slug: string;
  };
  depth?: number;
}
