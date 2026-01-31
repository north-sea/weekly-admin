# Inbox expand image + source time sorting

## Goal
Add a small image preview to the inbox expanded row and ensure time sorting uses source-specific timestamps:
- RSS: use published time.
- Karakeep: use collected time.

## Decisions
- Use a small thumbnail in the expanded row; click opens original image in a new tab.
- Reuse `source_published_at` for Karakeep collected time (no new column).
- Keep existing default sort (AI score); the "time" sort option uses `source_published_at`.

## UI changes
- Expanded row shows a thumbnail when `image_url` exists.
- Thumbnail is 80x112-ish, `object-cover`, bordered, with a "click to view" hint.

## Data changes
- Karakeep sync writes `source_published_at` from `bookmark.createdAt` (collected time), falling back to `datePublished`.
- RSS continues to use feed `publishedAt` for `source_published_at`.

## Error handling
- If `image_url` is missing or invalid, the preview block is not shown (or the image fails to load without breaking layout).
- If `source_published_at` is null, DB sorting naturally places it after real timestamps.

## Testing
- Sync a RSS source and verify time sort aligns with feed published time.
- Sync a Karakeep source and verify time sort aligns with collected time.
- Expand an item with `image_url` and confirm thumbnail opens original image.
