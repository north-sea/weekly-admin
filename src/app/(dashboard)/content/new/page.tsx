'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCreateContent } from '@/hooks/queries/useContentQueries';
import { useAllCategories } from '@/hooks/queries/useCategoryQueries';
import { useAllTags } from '@/hooks/queries/useTagQueries';
import SimplifiedEditor from '@/components/content/simplified-editor';
import { useToast } from '@/components/ui/use-toast';

export default function ContentCreatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const createContent = useCreateContent();
  const { data: categories } = useAllCategories();
  const { data: tags } = useAllTags();

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      const created = await createContent.mutateAsync(values as any);
      toast({
        title: '创建成功',
        description: '内容已创建',
      });
      router.push(`/content/${created.id}`);
    } catch (error: any) {
      toast({
        title: '创建失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleCancel = () => {
    router.push('/content/list');
  };

  return (
    <SimplifiedEditor
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      loading={createContent.isPending}
      categories={categories || []}
      tags={tags || []}
    />
  );
}
