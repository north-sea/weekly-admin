'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { TreeSelect, Spin } from 'antd';
import { CategoryWithStats } from '@/lib/services/category';
import { apiClient } from '@/lib/api-client';

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
  const [categories, setCategories] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  // 将分类数据转换为树形结构
  const convertToTreeData = useCallback((categories: CategoryWithStats[]): TreeNode[] => {
    return categories.map(category => ({
      title: `${category.name} (${category.content_count})`,
      value: category.id,
      key: category.id,
      children: category.children ? convertToTreeData(category.children) : undefined
    }));
  }, []);

  // 获取分类数据
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      // 为categories API设置更长的超时时间（60秒）
      const data = await apiClient.get<CategoryWithStats[]>(
        '/api/categories?include_children=true',
        { timeout: 60000 }
      );
      console.log('Categories data:', data); // 添加调试日志
      const treeData = convertToTreeData(data);
      setCategories(treeData);
    } catch (error) {
      console.error('获取分类失败:', error);
      // 添加更详细的错误信息
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [convertToTreeData]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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