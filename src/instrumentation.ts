export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.DISABLE_INBOX_SCORING_CRON !== '1' &&
    process.env.NODE_ENV !== 'test' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { startInboxScoringScheduler } = await import('@/lib/scheduling/inbox-scoring-scheduler');
    startInboxScoringScheduler();
  }
}
