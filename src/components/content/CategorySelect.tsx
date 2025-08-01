'use client';

import React, { useCallback } from 'react';
import { TreeSelect, Spin } from 'antd';
import { CategoryWithStats } from '@/lib/services/category-api';
import { useCategoryTree } from '@/hooks/queries';

interface CategorySelectProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

interface TreeNode {
  title: string;
  value: number;
  key: number;
  children?: TreeNode[];
}

export default function CategorySelect({
  value,
  onChange,
  placeholder = '请选择分类',
  allowClear = true,
  disabled = false
}: CategorySelectProps) {
  // 使用react-query获取分类树数据
  const { data: categoriesData = [], isLoading: loading } = useCategoryTree();

  // 将分类数据转换为树形结构
  const convertToTreeData = useCallback((categories: CategoryWithStats[]): TreeNode[] => {
    return categories.map(category => ({
      title: `${category.name} (${category.content_count})`,
      value: category.id,
      key: category.id,
      children: category.children ? convertToTreeData(category.children) : undefined
    }));
  }, []);

  const categories = convertToTreeData(categoriesData);

  return (
    <TreeSelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      disabled={disabled}
      loading={loading}
      treeData={categories}
      showSearch
      treeDefaultExpandAll
      filterTreeNode={(search, node) => {
        return node.title?.toString().toLowerCase().includes(search.toLowerCase()) || false;
      }}
      style={{ width: '100%' }}
      styles={{ popup: { root: { maxHeight: 400, overflow: 'auto' } } }}
      notFoundContent={loading ? <Spin size="small" /> : '暂无数据'}
    />
  );
}