/**
 * ContentFormatAdapter - 内容格式适配器
 * 
 * 用于处理新老内容格式:
 * - 老格式: Markdown 字符串
 * - 新格式: JSON 结构化数据
 * 
 * 提供统一的检测、转换和渲染接口
 */

export type ContentFormat = 'markdown' | 'json';

export interface StructuredContent {
  title: string;
  description?: string;
  sections: Array<{
    heading?: string;
    content: string;
    type?: 'text' | 'code' | 'image' | 'quote';
    language?: string; // for code blocks
    imageUrl?: string; // for images
  }>;
  metadata?: Record<string, any>;
}

export interface ContentMetadata {
  format: ContentFormat;
  wordCount: number;
  estimatedReadingTime: number; // in minutes
  hasCode: boolean;
  hasImages: boolean;
}

/**
 * 内容格式适配器
 */
export class ContentFormatAdapter {
  /**
   * 检测内容格式
   * @param content - 内容字符串
   * @returns 格式类型
   */
  static detectFormat(content: string): ContentFormat {
    if (!content || content.trim().length === 0) {
      return 'markdown';
    }

    // 尝试解析为 JSON
    try {
      const parsed = JSON.parse(content);
      // 检查是否符合 StructuredContent 结构
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed.title || parsed.sections) &&
        Array.isArray(parsed.sections)
      ) {
        return 'json';
      }
    } catch {
      // 不是 JSON,继续判断
    }

    // 默认为 Markdown
    return 'markdown';
  }

  /**
   * 转换为结构化格式
   * @param content - 内容字符串
   * @returns 结构化内容
   */
  static toStructured(content: string): StructuredContent {
    const format = this.detectFormat(content);

    if (format === 'json') {
      try {
        return JSON.parse(content) as StructuredContent;
      } catch (error) {
        console.error('Failed to parse JSON content:', error);
        // fallback to markdown parsing
      }
    }

    // Markdown 转结构化
    return this.markdownToStructured(content);
  }

  /**
   * Markdown 转结构化
   * @param markdown - Markdown 字符串
   * @returns 结构化内容
   */
  private static markdownToStructured(markdown: string): StructuredContent {
    const lines = markdown.split('\n');
    const sections: StructuredContent['sections'] = [];
    let currentSection: { heading?: string; content: string; type?: 'text' | 'code' | 'image' | 'quote' } = {
      content: '',
    };
    let inCodeBlock = false;
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 代码块处理
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // 开始代码块
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
          currentSection = { content: '', type: 'code' };
        } else {
          // 结束代码块
          inCodeBlock = false;
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { content: '' };
        }
        continue;
      }

      if (inCodeBlock) {
        currentSection.content += line + '\n';
        continue;
      }

      // 标题处理
      if (line.startsWith('## ')) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        currentSection = {
          heading: line.replace('## ', '').trim(),
          content: '',
        };
      } else if (line.startsWith('# ')) {
        // 主标题不作为 section,可能是整体标题
        continue;
      } else {
        currentSection.content += line + '\n';
      }
    }

    // 添加最后一个 section
    if (currentSection.content.trim()) {
      sections.push({ ...currentSection });
    }

    // 提取标题(第一个 # 或第一个 section 的 heading)
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : sections[0]?.heading || 'Untitled';

    return {
      title,
      sections: sections.filter((s) => s.content.trim() || s.heading),
    };
  }

  /**
   * 结构化转 Markdown
   * @param structured - 结构化内容
   * @returns Markdown 字符串
   */
  static toMarkdown(structured: StructuredContent): string {
    let markdown = '';

    // 标题
    if (structured.title) {
      markdown += `# ${structured.title}\n\n`;
    }

    // 描述
    if (structured.description) {
      markdown += `${structured.description}\n\n`;
    }

    // Sections
    for (const section of structured.sections) {
      if (section.heading) {
        markdown += `## ${section.heading}\n\n`;
      }

      if (section.type === 'code') {
        markdown += `\`\`\`${section.language || ''}\n${section.content}\`\`\`\n\n`;
      } else if (section.type === 'quote') {
        const quotedLines = section.content.split('\n').map((line) => `> ${line}`);
        markdown += quotedLines.join('\n') + '\n\n';
      } else if (section.type === 'image' && section.imageUrl) {
        markdown += `![${section.heading || ''}](${section.imageUrl})\n\n`;
        if (section.content) {
          markdown += section.content + '\n\n';
        }
      } else {
        markdown += section.content.trim() + '\n\n';
      }
    }

    return markdown.trim();
  }

  /**
   * 提取内容元数据
   * @param content - 内容字符串
   * @returns 元数据
   */
  static extractMetadata(content: string): ContentMetadata {
    const format = this.detectFormat(content);
    const structured = this.toStructured(content);

    // 计算字数
    const fullText = structured.sections.map((s) => s.content).join(' ');
    const wordCount = fullText.split(/\s+/).filter((word) => word.length > 0).length;

    // 估算阅读时间(假设每分钟 200 字)
    const estimatedReadingTime = Math.ceil(wordCount / 200);

    // 检查是否有代码
    const hasCode = structured.sections.some((s) => s.type === 'code');

    // 检查是否有图片
    const hasImages = structured.sections.some((s) => s.type === 'image' || fullText.includes('!['));

    return {
      format,
      wordCount,
      estimatedReadingTime,
      hasCode,
      hasImages,
    };
  }

  /**
   * 验证结构化内容
   * @param data - 数据对象
   * @returns 是否有效
   */
  static isValidStructured(data: any): data is StructuredContent {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.title === 'string' &&
      Array.isArray(data.sections) &&
      data.sections.every(
        (section: any) =>
          typeof section === 'object' &&
          typeof section.content === 'string' &&
          (!section.type || ['text', 'code', 'image', 'quote'].includes(section.type))
      )
    );
  }

  /**
   * 迁移辅助:批量转换
   * @param contents - 内容数组
   * @returns 转换后的内容数组
   */
  static batchConvert(contents: Array<{ id: string; content: string }>): Array<{
    id: string;
    originalContent: string;
    structuredContent: StructuredContent;
    format: ContentFormat;
  }> {
    return contents.map((item) => ({
      id: item.id,
      originalContent: item.content,
      structuredContent: this.toStructured(item.content),
      format: this.detectFormat(item.content),
    }));
  }
}

/**
 * 内容渲染辅助函数
 */
export class ContentRenderHelper {
  /**
   * 为特定平台生成内容
   * 例如:为邮件生成纯文本,为 RSS 生成 HTML
   */
  static toPlainText(structured: StructuredContent): string {
    let text = structured.title + '\n\n';

    if (structured.description) {
      text += structured.description + '\n\n';
    }

    for (const section of structured.sections) {
      if (section.heading) {
        text += section.heading + '\n';
      }
      text += section.content.trim() + '\n\n';
    }

    return text.trim();
  }

  /**
   * 生成内容摘要
   * @param structured - 结构化内容
   * @param maxLength - 最大长度
   * @returns 摘要
   */
  static generateSummary(structured: StructuredContent, maxLength: number = 200): string {
    const description = structured.description;
    if (description && description.length <= maxLength) {
      return description;
    }

    // 从第一个 section 提取
    const firstSection = structured.sections[0];
    if (!firstSection) {
      return '';
    }

    const content = firstSection.content.trim();
    if (content.length <= maxLength) {
      return content;
    }

    return content.slice(0, maxLength - 3) + '...';
  }

  /**
   * 提取所有图片 URL
   * @param structured - 结构化内容
   * @returns 图片 URL 数组
   */
  static extractImages(structured: StructuredContent): string[] {
    const images: string[] = [];

    for (const section of structured.sections) {
      if (section.type === 'image' && section.imageUrl) {
        images.push(section.imageUrl);
      }

      // 从 Markdown 内容中提取图片
      const imgRegex = /!\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = imgRegex.exec(section.content)) !== null) {
        images.push(match[1]);
      }
    }

    return images;
  }
}
