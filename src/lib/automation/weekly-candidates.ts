import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getWeekRange, getWeekRangeByOffset } from '@/lib/utils/weekly-date';

export const WeeklyCandidatesQuerySchema = z.object({
  weekOffset: z.coerce.number().int().min(-52).max(52).optional(),
  date: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(['ready', 'published', 'all']).default('ready'),
});

export type WeeklyCandidatesQuery = z.infer<typeof WeeklyCandidatesQuerySchema>;

export async function getWeeklyCandidates(query: WeeklyCandidatesQuery) {
  const range = query.date ? getWeekRange(query.date) : getWeekRangeByOffset(query.weekOffset ?? 0);
  const statusWhere = query.status === 'all' ? {} : { status: query.status };

  const candidates = await prisma.contents.findMany({
    where: {
      content_type_id: 3,
      ...statusWhere,
      created_at: {
        gte: range.startDate,
        lte: range.endDate,
      },
      weekly_content_items: { none: {} },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      source: true,
      source_url: true,
      original_score: true,
      summary_score: true,
      created_at: true,
    },
    orderBy: [{ original_score: 'desc' }, { summary_score: 'desc' }, { created_at: 'asc' }],
    take: query.limit,
  });

  const status: 'succeeded' | 'empty' = candidates.length > 0 ? 'succeeded' : 'empty';

  return {
    status,
    range: {
      startDate: range.startDateStr,
      endDate: range.endDateStr,
    },
    total: candidates.length,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      id: Number(candidate.id),
      created_at: candidate.created_at?.toISOString() ?? null,
      score: (candidate.original_score ?? 0) + (candidate.summary_score ?? 0),
    })),
  };
}
