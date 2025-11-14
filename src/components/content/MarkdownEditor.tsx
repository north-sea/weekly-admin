'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Tooltip,
  Modal,
  message,
  Divider,
  Typography,
  Row,
  Col
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  PictureOutlined,
  BoldOutlined,
  ItalicOutlined,

  LinkOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CodeOutlined,
  TableOutlined,
  SaveOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  MobileOutlined,
  DesktopOutlined
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import MarkdownPreview from './MarkdownPreview';
import ImageManager from './ImageManager';
import { debounce } from 'lodash-es';
import './markdown-editor.css';

const { Text } = Typography;

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  height?: number;
  placeholder?: string;
  autoSave?: boolean;
  autoSaveInterval?: number;
  contentData?: {
    title?: string;
    content_type?: { id: number; name?: string };
    category?: { id: number; name: string };
    tags?: Array<{ id: number; name: string }>;
    created_at?: string;
    user?: { display_name?: string; username: string };
  }; // 用于预览的完整内容数据
  showPreview?: boolean;
  showToolbar?: boolean;
}

export default function MarkdownEditor({
  value = '',
  onChange,
  onSave,
  height = 500,
  placeholder = '请输入 Markdown 内容...',
  autoSave = true,
  autoSaveInterval = 30000, // 30秒
  contentData,
  showPreview = true,
  showToolbar = true
}: MarkdownEditorProps) {
  const [content, setContent] = useState(value);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [fullscreen, setFullscreen] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [imageManagerVisible, setImageManagerVisible] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const editorRef = useRef<{ textarea?: HTMLTextAreaElement } | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖的onChange处理
  const debouncedOnChange = useCallback(
    debounce((newValue: string) => {
      onChange?.(newValue);
      setHasUnsavedChanges(true);
    }, 300),
    [onChange]
  );

  // 内容变化处理
  const handleContentChange = (newValue?: string) => {
    const val = newValue || '';
    setContent(val);
    debouncedOnChange(val);
  };

  // 自动保存
  const handleAutoSave = useCallback(async () => {
    if (hasUnsavedChanges && onSave) {
      try {
        await onSave(content);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        message.success('自动保存成功', 1);
      } catch {
        message.error('自动保存失败', 1);
      }
    }
  }, [content, hasUnsavedChanges, onSave]);

  // 手动保存
  const handleManualSave = useCallback(async () => {
    if (onSave) {
      try {
        await onSave(content);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        message.success('保存成功');
      } catch {
        message.error('保存失败');
      }
    }
  }, [onSave, content]);

  // 设置自动保存定时器
  useEffect(() => {
    if (autoSave && autoSaveInterval > 0) {
      autoSaveTimerRef.current = setInterval(handleAutoSave, autoSaveInterval);
      return () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current);
        }
      };
    }
  }, [autoSave, autoSaveInterval, handleAutoSave]);

  // 同步外部value变化
  useEffect(() => {
    if (value !== content) {
      setContent(value);
      setHasUnsavedChanges(false);
    }
  }, [value, content]);

  // 插入文本到编辑器
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      const textarea = editorRef.current.textarea;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + text + content.substring(end);
        setContent(newContent);
        debouncedOnChange(newContent);
        
        // 设置光标位置
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      }
    }
  }, [content, debouncedOnChange]);

  // 快捷插入功能
  const insertBold = useCallback(() => insertText('**粗体文本**'), [insertText]);
  const insertItalic = useCallback(() => insertText('*斜体文本*'), [insertText]);
  const insertLink = useCallback(() => insertText('[链接文本](https://example.com)'), [insertText]);
  const insertCode = useCallback(() => insertText('`代码`'), [insertText]);
  // const insertCodeBlock = () => insertText('\n```javascript\n// 代码块\nconsole.log("Hello World");\n```\n');
  const insertTable = () => insertText('\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n');
  const insertOrderedList = () => insertText('\n1. 列表项1\n2. 列表项2\n3. 列表项3\n');
  const insertUnorderedList = () => insertText('\n- 列表项1\n- 列表项2\n- 列表项3\n');

  // 插入图片
  const handleInsertImage = (url: string) => {
    const imageMarkdown = `![图片描述](${url})`;
    insertText(imageMarkdown);
    setImageManagerVisible(false);
  };

  // 工具栏
  const renderToolbar = () => {
    if (!showToolbar) return null;

    return (
      <Card size="small" style={{ marginBottom: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space wrap>
              {/* 格式化工具 */}
              <Space.Compact>
                <Tooltip title="粗体 (Ctrl+B)">
                  <Button size="small" icon={<BoldOutlined />} onClick={insertBold} />
                </Tooltip>
                <Tooltip title="斜体 (Ctrl+I)">
                  <Button size="small" icon={<ItalicOutlined />} onClick={insertItalic} />
                </Tooltip>
                <Tooltip title="代码 (Ctrl+`)">
                  <Button size="small" icon={<CodeOutlined />} onClick={insertCode} />
                </Tooltip>
              </Space.Compact>

              <Divider type="vertical" />

              {/* 插入工具 */}
              <Space.Compact>
                <Tooltip title="插入链接">
                  <Button size="small" icon={<LinkOutlined />} onClick={insertLink} />
                </Tooltip>
                <Tooltip title="插入图片">
                  <Button 
                    size="small" 
                    icon={<PictureOutlined />} 
                    onClick={() => setImageManagerVisible(true)} 
                  />
                </Tooltip>
                <Tooltip title="插入表格">
                  <Button size="small" icon={<TableOutlined />} onClick={insertTable} />
                </Tooltip>
              </Space.Compact>

              <Divider type="vertical" />

              {/* 列表工具 */}
              <Space.Compact>
                <Tooltip title="有序列表">
                  <Button size="small" icon={<OrderedListOutlined />} onClick={insertOrderedList} />
                </Tooltip>
                <Tooltip title="无序列表">
                  <Button size="small" icon={<UnorderedListOutlined />} onClick={insertUnorderedList} />
                </Tooltip>
              </Space.Compact>

              <Divider type="vertical" />

              {/* 视图模式 */}
              {showPreview && (
                <Space.Compact>
                  <Tooltip title="编辑模式">
                    <Button 
                      size="small" 
                      icon={<EditOutlined />} 
                      type={previewMode === 'edit' ? 'primary' : 'default'}
                      onClick={() => setPreviewMode('edit')} 
                    />
                  </Tooltip>
                  <Tooltip title="分屏模式">
                    <Button 
                      size="small" 
                      icon={<EyeOutlined />} 
                      type={previewMode === 'split' ? 'primary' : 'default'}
                      onClick={() => setPreviewMode('split')} 
                    />
                  </Tooltip>
                  <Tooltip title="预览模式">
                    <Button 
                      size="small" 
                      icon={<EyeOutlined />} 
                      type={previewMode === 'preview' ? 'primary' : 'default'}
                      onClick={() => setPreviewMode('preview')} 
                    />
                  </Tooltip>
                </Space.Compact>
              )}
            </Space>
          </Col>

          <Col>
            <Space>
              {/* 预览设备切换 */}
              {previewMode !== 'edit' && (
                <Space.Compact>
                  <Tooltip title="桌面预览">
                    <Button 
                      size="small" 
                      icon={<DesktopOutlined />} 
                      type={!mobilePreview ? 'primary' : 'default'}
                      onClick={() => setMobilePreview(false)} 
                    />
                  </Tooltip>
                  <Tooltip title="移动端预览">
                    <Button 
                      size="small" 
                      icon={<MobileOutlined />} 
                      type={mobilePreview ? 'primary' : 'default'}
                      onClick={() => setMobilePreview(true)} 
                    />
                  </Tooltip>
                </Space.Compact>
              )}

              {/* 全屏切换 */}
              <Tooltip title={fullscreen ? '退出全屏' : '全屏编辑'}>
                <Button 
                  size="small" 
                  icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={() => setFullscreen(!fullscreen)} 
                />
              </Tooltip>

              {/* 保存按钮 */}
              {onSave && (
                <Tooltip title="保存 (Ctrl+S)">
                  <Button 
                    size="small" 
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleManualSave}
                    disabled={!hasUnsavedChanges}
                  />
                </Tooltip>
              )}
            </Space>
          </Col>
        </Row>

        {/* 状态信息 */}
        {(autoSave || lastSaved) && (
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            <Space>
              {hasUnsavedChanges && <Text type="warning">有未保存的更改</Text>}
              {lastSaved && (
                <Text type="secondary">
                  最后保存: {lastSaved.toLocaleTimeString()}
                </Text>
              )}
              {autoSave && (
                <Text type="secondary">
                  自动保存: {autoSaveInterval / 1000}秒
                </Text>
              )}
            </Space>
          </div>
        )}
      </Card>
    );
  };

  // 渲染编辑器内容
  const renderEditor = () => {
    const editorHeight = fullscreen ? 'calc(100vh - 200px)' : height;

    if (previewMode === 'edit') {
      return (
        <MDEditor
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          preview="edit"
          height={editorHeight}
          data-color-mode="light"
          hideToolbar
          textareaProps={{
            placeholder,
            style: { 
              fontSize: '14px', 
              lineHeight: '1.6',
              border: 'none',
              outline: 'none',
              resize: 'none'
            },
            spellCheck: false,
            autoComplete: 'off',
            autoCorrect: 'off',
            autoCapitalize: 'off'
          }}
          style={{
            backgroundColor: 'transparent'
          }}
        />
      );
    }

    if (previewMode === 'preview') {
      return (
        <div style={{ 
          height: editorHeight, 
          overflow: 'auto',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          padding: mobilePreview ? '0' : '16px',
          backgroundColor: '#fff'
        }}>
          {contentData ? (
            <MarkdownPreview 
              content={{
                ...contentData,
                title: contentData.title ?? '',
                content,
                content_type: contentData.content_type ? {
                  id: contentData.content_type.id,
                  name: contentData.content_type.name ?? '',
                } : undefined,
                category: contentData.category ? {
                  id: contentData.category.id,
                  name: contentData.category.name ?? '',
                } : contentData.category,
                tags: contentData.tags?.map(tag => ({
                  id: tag.id,
                  name: tag.name ?? '',
                })),
              }}
              mode={mobilePreview ? 'mobile' : 'desktop'}
              showMeta={true}
            />
          ) : (
            <MDEditor.Markdown 
              source={content} 
              style={{ 
                padding: '16px',
                backgroundColor: 'transparent'
              }}
            />
          )}
        </div>
      );
    }

    // 分屏模式
    return (
      <div style={{ display: 'flex', gap: '8px', height: editorHeight }}>
        <div style={{ flex: 1 }}>
          <MDEditor
            ref={editorRef}
            value={content}
            onChange={handleContentChange}
            preview="edit"
            height="100%"
            data-color-mode="light"
            hideToolbar
            textareaProps={{
              placeholder,
              style: { fontSize: '14px', lineHeight: '1.6' }
            }}
          />
        </div>
        <div style={{ 
          flex: 1, 
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          overflow: 'auto',
          backgroundColor: '#fff'
        }}>
          {contentData ? (
            <div style={{ padding: mobilePreview ? '0' : '16px' }}>
              <MarkdownPreview 
                content={{
                  ...contentData,
                  title: contentData.title ?? '',
                  content,
                  content_type: contentData.content_type ? {
                    id: contentData.content_type.id,
                    name: contentData.content_type.name ?? '',
                  } : undefined,
                  category: contentData.category ? {
                    id: contentData.category.id,
                    name: contentData.category.name ?? '',
                  } : contentData.category,
                  tags: contentData.tags?.map(tag => ({
                    id: tag.id,
                    name: tag.name ?? '',
                  })),
                }}
                mode={mobilePreview ? 'mobile' : 'desktop'}
                showMeta={false}
              />
            </div>
          ) : (
            <MDEditor.Markdown 
              source={content} 
              style={{ 
                padding: '16px',
                backgroundColor: 'transparent'
              }}
            />
          )}
        </div>
      </div>
    );
  };

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleManualSave();
            break;
          case 'b':
            e.preventDefault();
            insertBold();
            break;
          case 'i':
            e.preventDefault();
            insertItalic();
            break;
          case '`':
            e.preventDefault();
            insertCode();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave, insertBold, insertItalic, insertCode]);

  const editorContent = (
    <div className="markdown-editor-container">
      {renderToolbar()}
      {renderEditor()}
      
      {/* 图片管理器 */}
      <ImageManager
        visible={imageManagerVisible}
        onCancel={() => setImageManagerVisible(false)}
        onInsertToEditor={handleInsertImage}
        mode="select"
      />
    </div>
  );

  // 全屏模式
  if (fullscreen) {
    return (
      <Modal
        open={fullscreen}
        onCancel={() => setFullscreen(false)}
        width="100%"
        style={{ top: 0, paddingBottom: 0 }}
        bodyStyle={{ height: '100vh', padding: '16px' }}
        footer={null}
        closable={false}
        maskClosable={false}
      >
        {editorContent}
      </Modal>
    );
  }

  return editorContent;
}