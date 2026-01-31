export interface TagGroup {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  tag_count?: number;
}

export interface TagWithStats {
  id: number;
  name: string;
  slug: string;
  group_id?: number | null;
  aliases?: string[];
  count: number;
  created_at?: string;
  updated_at?: string;
  group?: TagGroup;
}
