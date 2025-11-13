import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useOptimisticUpdate,
  useInvalidateQueries,
  queryKeys,
  PaginatedResponse,
} from '@/hooks/useApi';
import { createTestQueryClient } from '@/tests/test-utils';

interface TestItem {
  id: number;
  name: string;
}

type TestPaginatedResponse = PaginatedResponse<TestItem>;

const createWrapper = (queryClient: QueryClient) => ({
  children,
}: {
  children: React.ReactNode;
}) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

describe('useOptimisticUpdate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('updates an item within a paginated response', () => {
    const queryKey = ['test', 'paginated'];
    const initialData: TestPaginatedResponse = {
      data: [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
    };

    queryClient.setQueryData(queryKey, initialData);

    const { result } = renderHook(() => useOptimisticUpdate(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.updateItem<TestItem>(queryKey, 1, (item) => ({
        ...item,
        name: 'Updated',
      }));
    });

    const updated = queryClient.getQueryData<TestPaginatedResponse>(queryKey);
    expect(updated?.data[0]).toEqual({ id: 1, name: 'Updated' });
    expect(updated?.data[1]).toEqual({ id: 2, name: 'Second' });
    expect(updated?.pagination.total).toBe(2);
  });

  it('adds a new item and updates pagination metadata', () => {
    const queryKey = ['test', 'paginated'];
    const initialData: TestPaginatedResponse = {
      data: [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
    };

    queryClient.setQueryData(queryKey, initialData);

    const { result } = renderHook(() => useOptimisticUpdate(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.addItem<TestItem>(queryKey, { id: 3, name: 'Third' });
    });

    const updated = queryClient.getQueryData<TestPaginatedResponse>(queryKey);
    expect(updated?.data).toHaveLength(3);
    expect(updated?.data[0]).toEqual({ id: 3, name: 'Third' });
    expect(updated?.pagination.total).toBe(3);
  });

  it('removes an item from cached data', () => {
    const queryKey = ['test', 'paginated'];
    const initialData: TestPaginatedResponse = {
      data: [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
    };

    queryClient.setQueryData(queryKey, initialData);

    const { result } = renderHook(() => useOptimisticUpdate(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.removeItem<TestItem>(queryKey, 1);
    });

    const updated = queryClient.getQueryData<TestPaginatedResponse>(queryKey);
    expect(updated?.data).toHaveLength(1);
    expect(updated?.data[0]).toEqual({ id: 2, name: 'Second' });
    expect(updated?.pagination.total).toBe(1);
  });
});

describe('useInvalidateQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('invalidates content queries for specific content id', async () => {
    const wrapper = createWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateQueries(), { wrapper });

    await act(async () => {
      await result.current.invalidateContent(42);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.content.detail(42),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.content.versions(42),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.content.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });

  it('invalidates tag queries without specific id', async () => {
    const wrapper = createWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateQueries(), { wrapper });

    await act(async () => {
      await result.current.invalidateTags();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.tags.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });
});
