'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input, AutoComplete, Dropdown, Button, Space, Typography, Empty } from 'antd';
import { SearchOutlined, HistoryOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSearchSuggestions, SearchHistoryItem } from '@/hooks/useSearch';

const { Text } = Typography;

interface SearchInputProps {
  value?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onInstantSearch?: (query: string) => void;
  searchHistory?: SearchHistoryItem[];
  onApplyHistory?: (item: SearchHistoryItem) => void;
  onRemoveHistory?: (id: string) => void;
  onClearHistory?: () => void;
  size?: 'small' | 'middle' | 'large';
  allowClear?: boolean;
  disabled?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value = '',
  placeholder = '搜索内容...',
  onSearch,
  onInstantSearch,
  searchHistory = [],
  onApplyHistory,
  onRemoveHistory,
  onClearHistory,
  size = 'middle',
  allowClear = true,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<any>(null);
  
  const { suggestions, isLoading, fetchSuggestions, clearSuggestions } = useSearchSuggestions();
  
  // Sync with external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);
  
  // Handle input change
  const handleInputChange = (val: string) => {
    setInputValue(val);
    
    if (val.trim()) {
      fetchSuggestions(val);
      setShowSuggestions(true);
      setShowHistory(false);
      
      // Trigger instant search
      if (onInstantSearch) {
        onInstantSearch(val);
      }
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  };
  
  // Handle search submission
  const handleSearch = (query?: string) => {
    const searchQuery = query || inputValue;
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
      setShowSuggestions(false);
      setShowHistory(false);
      inputRef.current?.blur();
    }
  };
  
  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setInputValue(suggestion);
    handleSearch(suggestion);
  };
  
  // Handle input focus
  const handleFocus = () => {
    if (!inputValue.trim() && searchHistory.length > 0) {
      setShowHistory(true);
      setShowSuggestions(false);
    } else if (inputValue.trim() && suggestions.length > 0) {
      setShowSuggestions(true);
      setShowHistory(false);
    }
  };
  
  // Handle input blur
  const handleBlur = () => {
    // Delay hiding to allow clicking on suggestions/history
    setTimeout(() => {
      setShowSuggestions(false);
      setShowHistory(false);
    }, 200);
  };
  
  // Handle history item click
  const handleHistoryClick = (item: SearchHistoryItem) => {
    setInputValue(item.query);
    if (onApplyHistory) {
      onApplyHistory(item);
    }
    setShowHistory(false);
  };
  
  // Handle history item removal
  const handleHistoryRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onRemoveHistory) {
      onRemoveHistory(id);
    }
  };
  
  // Format timestamp for history display
  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
  };
  
  // Prepare suggestions options
  const suggestionOptions = suggestions.map(suggestion => ({
    value: suggestion,
    label: (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <SearchOutlined style={{ marginRight: 8, color: '#999' }} />
        <span>{suggestion}</span>
      </div>
    ),
  }));
  
  // Prepare history dropdown menu
  const historyMenu = {
    items: [
      ...(searchHistory.length > 0 ? [
        {
          key: 'header',
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <Text strong>搜索历史</Text>
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={onClearHistory}
              >
                清空
              </Button>
            </div>
          ),
          disabled: true,
        },
        { type: 'divider' as const },
        ...searchHistory.slice(0, 10).map(item => ({
          key: item.id,
          label: (
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
              onClick={() => handleHistoryClick(item)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <HistoryOutlined style={{ marginRight: 8, color: '#999' }} />
                  <Text ellipsis style={{ flex: 1 }}>{item.query}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatTimestamp(item.timestamp)}
                </Text>
              </div>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={(e) => handleHistoryRemove(e, item.id)}
                style={{ marginLeft: 8 }}
              />
            </div>
          ),
        })),
      ] : [
        {
          key: 'empty',
          label: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无搜索历史"
              style={{ margin: '16px 0' }}
            />
          ),
          disabled: true,
        },
      ]),
    ],
  };
  
  return (
    <div style={{ position: 'relative' }}>
      {showSuggestions && suggestions.length > 0 ? (
        <AutoComplete
          value={inputValue}
          options={suggestionOptions}
          onSelect={handleSuggestionSelect}
          onChange={handleInputChange}
          open={showSuggestions}
          style={{ width: '100%' }}
        >
          <Input
            ref={inputRef}
            size={size}
            placeholder={placeholder}
            prefix={<SearchOutlined />}
            allowClear={allowClear}
            disabled={disabled}
            onPressEnter={() => handleSearch()}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </AutoComplete>
      ) : (
        <Dropdown
          menu={historyMenu}
          open={showHistory}
          placement="bottomLeft"
          trigger={[]}
          overlayStyle={{ minWidth: 300 }}
        >
          <Input
            ref={inputRef}
            value={inputValue}
            size={size}
            placeholder={placeholder}
            prefix={<SearchOutlined />}
            allowClear={allowClear}
            disabled={disabled}
            onChange={(e) => handleInputChange(e.target.value)}
            onPressEnter={() => handleSearch()}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </Dropdown>
      )}
    </div>
  );
};

export default SearchInput;