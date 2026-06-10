import { describe, expect, it } from 'vitest';
import {
  createAdminWeeklySuggestionPreviewResult,
  normalizeWeeklySuggestionArtifact,
  parseWeeklySuggestionPreviewResult,
} from './hermes-artifacts';

describe('Hermes weekly artifacts', () => {
  it('normalizes a Hermes suggestion artifact', () => {
    const artifact = normalizeWeeklySuggestionArtifact({
      artifactVersion: 'weekly-suggestion.v1',
      provider: 'hermes',
      weeklyIssueId: 7,
      agentRunId: 'hermes_1',
      confidence: 0.82,
      evidenceRefs: [{ label: 'feedback digest', runId: 'auto_1' }],
      items: [{ content_id: 10, section: 'AI', reason: 'fits preference', confidence: 0.9 }],
    });

    expect(artifact.generatedAt).toEqual(expect.any(String));
    expect(artifact.items[0]).toMatchObject({
      content_id: 10,
      featured: false,
      evidenceRefs: [],
    });
  });

  it('rejects Hermes artifacts without an agent run id', () => {
    expect(() => normalizeWeeklySuggestionArtifact({
      provider: 'hermes',
      weeklyIssueId: 7,
      items: [{ content_id: 10, section: 'AI' }],
    })).toThrow(/agentRunId/);
  });

  it('rejects secret-like fields before persistence', () => {
    expect(() => normalizeWeeklySuggestionArtifact({
      provider: 'hermes',
      weeklyIssueId: 7,
      agentRunId: 'hermes_1',
      token: 'wa_secret',
      items: [{ content_id: 10, section: 'AI' }],
    })).toThrow(/secret-like/);
  });

  it('parses legacy admin suggestion previews', () => {
    const parsed = parseWeeklySuggestionPreviewResult({
      status: 'preview',
      weeklyIssueId: 7,
      suggestion: { items: [{ content_id: 10, section: 'AI' }] },
    });

    expect(parsed).toMatchObject({
      provider: 'admin',
      weeklyIssueId: 7,
    });
  });

  it('creates admin fallback previews with provider metadata', () => {
    const preview = createAdminWeeklySuggestionPreviewResult({
      weeklyIssueId: 7,
      suggestion: { items: [{ content_id: 10, section: 'AI' }] },
    });

    expect(preview).toMatchObject({
      status: 'preview',
      provider: 'admin',
      artifactVersion: 'weekly-suggestion.v1',
    });
  });
});
