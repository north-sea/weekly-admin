import { z } from 'zod';

const SECRET_KEY_PATTERN = /(authorization|token|token_hash|tokenhash|password|secret|api[_-]?key|provider[_-]?key|database[_-]?url|db[_-]?url|redis[_-]?password)/i;

export const EvidenceRefSchema = z.object({
  type: z.string().min(1).max(80).optional(),
  sourceType: z.string().min(1).max(80).optional(),
  sourceId: z.union([z.string().min(1).max(160), z.number().int()]).optional(),
  label: z.string().min(1).max(160).optional(),
  summary: z.string().min(1).max(500).optional(),
  runId: z.string().min(1).max(160).optional(),
}).strict();

export const WeeklySuggestionArtifactItemSchema = z.object({
  content_id: z.number().int().positive(),
  section: z.string().min(1).max(100),
  featured: z.boolean().optional().default(false),
  reason: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidenceRefs: z.array(EvidenceRefSchema).max(20).optional().default([]),
  title: z.string().max(300).optional(),
  source_url: z.string().max(1000).nullable().optional(),
  original_score: z.number().nullable().optional(),
  summary_score: z.number().nullable().optional(),
}).strict();

export const WeeklySuggestionArtifactStatusSchema = z.enum(['preview', 'empty', 'stale', 'rejected']);

export const WeeklySuggestionArtifactSchema = z.object({
  artifactVersion: z.literal('weekly-suggestion.v1').optional().default('weekly-suggestion.v1'),
  provider: z.enum(['hermes', 'admin']).optional().default('hermes'),
  weeklyIssueId: z.number().int().positive(),
  agentRunId: z.string().min(1).max(160).optional(),
  sourceRunId: z.string().min(1).max(160).optional(),
  status: WeeklySuggestionArtifactStatusSchema.optional().default('preview'),
  intro: z.string().max(1000).optional(),
  items: z.array(WeeklySuggestionArtifactItemSchema).max(30).optional().default([]),
  confidence: z.number().min(0).max(1).optional(),
  evidenceRefs: z.array(EvidenceRefSchema).max(30).optional().default([]),
  preferenceRefs: z.array(z.string().min(1).max(160)).max(20).optional().default([]),
  generatedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
}).strict().superRefine((artifact, ctx) => {
  if (artifact.provider === 'hermes' && !artifact.agentRunId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['agentRunId'],
      message: 'Hermes artifacts require agentRunId',
    });
  }

  if (artifact.status === 'preview' && artifact.items.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['items'],
      message: 'Preview artifacts require at least one item',
    });
  }
});

const WeeklySuggestionPreviewResultSchema = z.object({
  status: WeeklySuggestionArtifactStatusSchema,
  weeklyIssueId: z.number().int().positive(),
  provider: z.enum(['hermes', 'admin']),
  artifactVersion: z.literal('weekly-suggestion.v1').optional(),
  agentRunId: z.string().min(1).max(160).optional(),
  sourceRunId: z.string().min(1).max(160).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidenceRefs: z.array(EvidenceRefSchema).max(30).optional().default([]),
  preferenceRefs: z.array(z.string().min(1).max(160)).max(20).optional().default([]),
  generatedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  suggestion: z.object({
    intro: z.string().max(1000).optional(),
    items: z.array(WeeklySuggestionArtifactItemSchema).max(30),
  }).strict(),
}).strict();

export const WeeklyOpsReportArtifactSchema = z.object({
  artifactVersion: z.literal('weekly-ops-report.v1'),
  weeklyIssueId: z.number().int().positive().optional(),
  agentRunId: z.string().min(1).max(160),
  status: z.enum(['succeeded', 'empty', 'skipped', 'failed', 'dependency_unavailable', 'history_only', 'stale_data']),
  summary: z.string().min(1).max(1000),
  risks: z.array(z.string().min(1).max(300)).max(10).optional().default([]),
  nextActions: z.array(z.string().min(1).max(300)).max(10).optional().default([]),
  runRefs: z.array(z.string().min(1).max(160)).max(20).optional().default([]),
  jobRefs: z.array(z.string().min(1).max(160)).max(20).optional().default([]),
  healthRefs: z.array(z.string().min(1).max(160)).max(20).optional().default([]),
  generatedAt: z.string().datetime(),
}).strict();

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type WeeklySuggestionArtifact = z.infer<typeof WeeklySuggestionArtifactSchema>;
export type WeeklySuggestionPreviewResult = z.infer<typeof WeeklySuggestionPreviewResultSchema>;
export type WeeklyOpsReportArtifact = z.infer<typeof WeeklyOpsReportArtifactSchema>;

export function normalizeWeeklySuggestionArtifact(input: unknown): WeeklySuggestionArtifact {
  assertNoSecretLikeKeys(input);
  const artifact = WeeklySuggestionArtifactSchema.parse(input);
  return {
    ...artifact,
    generatedAt: artifact.generatedAt ?? new Date().toISOString(),
  };
}

export function toWeeklySuggestionPreviewResult(
  artifact: WeeklySuggestionArtifact,
  sourceRunId?: string
): WeeklySuggestionPreviewResult {
  return WeeklySuggestionPreviewResultSchema.parse({
    status: artifact.status,
    weeklyIssueId: artifact.weeklyIssueId,
    provider: artifact.provider,
    artifactVersion: artifact.artifactVersion,
    agentRunId: artifact.agentRunId,
    sourceRunId: artifact.sourceRunId ?? sourceRunId,
    confidence: artifact.confidence,
    evidenceRefs: artifact.evidenceRefs,
    preferenceRefs: artifact.preferenceRefs,
    generatedAt: artifact.generatedAt,
    expiresAt: artifact.expiresAt,
    suggestion: {
      intro: artifact.intro,
      items: artifact.items,
    },
  });
}

export function createAdminWeeklySuggestionPreviewResult(input: {
  weeklyIssueId: number;
  suggestion: {
    intro?: string;
    items: unknown[];
  };
}): WeeklySuggestionPreviewResult {
  return WeeklySuggestionPreviewResultSchema.parse({
    status: 'preview',
    weeklyIssueId: input.weeklyIssueId,
    provider: 'admin',
    artifactVersion: 'weekly-suggestion.v1',
    generatedAt: new Date().toISOString(),
    suggestion: {
      intro: input.suggestion.intro,
      items: input.suggestion.items.map((item) => WeeklySuggestionArtifactItemSchema.parse(item)),
    },
  });
}

export function parseWeeklySuggestionPreviewResult(input: unknown): WeeklySuggestionPreviewResult | null {
  const direct = WeeklySuggestionPreviewResultSchema.safeParse(input);
  if (direct.success) return direct.data;

  const legacy = z.object({
    status: WeeklySuggestionArtifactStatusSchema,
    weeklyIssueId: z.number().int().positive(),
    suggestion: z.object({
      intro: z.string().max(1000).optional(),
      items: z.array(WeeklySuggestionArtifactItemSchema).max(30),
    }).strict(),
  }).strict().safeParse(input);
  if (legacy.success) {
    return WeeklySuggestionPreviewResultSchema.parse({
      ...legacy.data,
      provider: 'admin',
      artifactVersion: 'weekly-suggestion.v1',
    });
  }

  const artifact = WeeklySuggestionArtifactSchema.safeParse(input);
  if (artifact.success) return toWeeklySuggestionPreviewResult(artifact.data);

  return null;
}

export function parseWeeklyOpsReportArtifact(input: unknown): WeeklyOpsReportArtifact | null {
  const direct = WeeklyOpsReportArtifactSchema.safeParse(input);
  if (direct.success) return direct.data;

  if (input && typeof input === 'object' && 'opsReport' in input) {
    const nested = WeeklyOpsReportArtifactSchema.safeParse((input as { opsReport?: unknown }).opsReport);
    if (nested.success) return nested.data;
  }

  return null;
}

function assertNoSecretLikeKeys(value: unknown, path: string[] = []): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretLikeKeys(item, [...path, String(index)]));
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: [...path, key],
        message: 'Artifact must not include secret-like fields',
      }]);
    }
    assertNoSecretLikeKeys(nested, [...path, key]);
  }
}
