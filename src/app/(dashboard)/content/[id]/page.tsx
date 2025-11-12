'use client';

import React, { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useContentDetail, useUpdateContent } from '@/hooks/queries/useContentQueries';
import { useAllCategories } from '@/hooks/queries/useCategoryQueries';
import { useAllTags } from '@/hooks/queries/useTagQueries';
import SimplifiedEditor from '@/components/content/simplified-editor';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function ContentEditorContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;

  const { data: content, isLoading: isLoadingContent } = useContentDetail(id, true);
  const { data: categories } = useAllCategories();
  const { data: tags } = useAllTags();
  const updateContent = useUpdateContent();

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      await updateContent.mutateAsync({ id, ...(values as any) });
      toast({
        title: "保存成功",
        description: "内容已成功更新",
      });
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleCancel = () => {
    router.push('/content/list');
  };

  if (isLoadingContent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">加载内容中...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">内容不存在</p>
          <p className="text-sm text-muted-foreground">该内容可能已被删除</p>
        </div>
      </div>
    );
  }

  return (
    <SimplifiedEditor
      initialValues={content}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      loading={updateContent.isPending}
      categories={categories || []}
      tags={tags || []}
    />
  );
}

export default function ContentEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <ContentEditorContent />
    </Suspense>
  );
}
