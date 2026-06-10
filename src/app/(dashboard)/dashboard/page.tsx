'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  WeeklyProductionDashboard,
  type JobWorkerSummary,
  type WorkbenchSummary,
} from '@/components/dashboard/weekly-production-dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = React.useState<WorkbenchSummary | null>(null);
  const [jobs, setJobs] = React.useState<JobWorkerSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [jobsError, setJobsError] = React.useState<string | null>(null);

  const fetchSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setJobsError(null);
    try {
      const [summaryResult, jobsResult] = await Promise.allSettled([
        fetch('/api/weekly/workbench/summary').then(async (response) => response.json()),
        fetch('/api/weekly/workbench/jobs').then(async (response) => response.json()),
      ]);

      if (summaryResult.status === 'rejected' || !summaryResult.value.success) {
        throw new Error(
          summaryResult.status === 'rejected'
            ? summaryResult.reason instanceof Error ? summaryResult.reason.message : '获取周刊驾驶舱失败'
            : summaryResult.value.error?.message || '获取周刊驾驶舱失败'
        );
      }

      setSummary(summaryResult.value.data);

      if (jobsResult.status === 'rejected' || !jobsResult.value.success) {
        setJobs(null);
        setJobsError(
          jobsResult.status === 'rejected'
            ? jobsResult.reason instanceof Error ? jobsResult.reason.message : '获取任务队列状态失败'
            : jobsResult.value.error?.message || '获取任务队列状态失败'
        );
      } else {
        setJobs(jobsResult.value.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取周刊驾驶舱失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      void fetchSummary();
    }
  }, [fetchSummary, user]);

  if (authLoading || !user) {
    return <LoadingSpinner text="加载中..." />;
  }

  return (
    <WeeklyProductionDashboard
      summary={summary}
      jobs={jobs}
      jobsError={jobsError}
      loading={loading && !summary}
      error={error}
      onRefresh={() => void fetchSummary()}
      onNavigate={(href) => router.push(href)}
    />
  );
}
