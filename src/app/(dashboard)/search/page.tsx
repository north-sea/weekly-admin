'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [contentType, setContentType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = () => {
    setIsSearching(true);
    // 模拟搜索
    setTimeout(() => {
      setResults([]);
      setIsSearching(false);
    }, 1000);
  };

  const handleClear = () => {
    setSearchQuery('');
    setContentType('all');
    setStatus('all');
    setResults([]);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:space-y-6 md:p-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">内容搜索</h2>
          <p className="text-sm text-muted-foreground md:text-base">
            搜索内容、草稿和周刊
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>搜索</CardTitle>
          <CardDescription>输入关键词搜索内容</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索标题、内容、标签..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={!searchQuery}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              {(searchQuery || contentType !== 'all' || status !== 'all') && (
                <Button variant="outline" onClick={handleClear}>
                  <X className="h-4 w-4 mr-2" />
                  清空
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-3">
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue placeholder="内容类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>搜索结果</CardTitle>
          <CardDescription>
            {isSearching ? '搜索中...' : `找到 ${results.length} 条结果`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSearching ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">暂无搜索结果</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchQuery ? '尝试使用不同的关键词' : '输入关键词开始搜索'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result: any) => (
                <div
                  key={result.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/content/${result.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">{result.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.summary || result.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">{result.content_type}</Badge>
                        <Badge variant="outline">{result.status}</Badge>
                        {result.tags?.map((tag: string) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
