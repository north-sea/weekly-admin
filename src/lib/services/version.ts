import { prisma } from '@/lib/db';

export interface ContentVersion {
  id: number;
  content_id: bigint;
  version_number: number;
  title?: string;
  content?: string;
  description?: string;
  source?: string;
  source_url?: string;
  changes_summary?: string;
  created_by: number;
  created_at?: Date;
  creator?: {
    id: number;
    username: string;
    display_name?: string;
  };
}

export interface VersionComparison {
  oldVersion: ContentVersion;
  newVersion: ContentVersion;
  changes: {
    title?: { old: string; new: string };
    content?: { old: string; new: string };
    description?: { old: string; new: string };
    source?: { old: string; new: string };
    source_url?: { old: string; new: string };
  };
}

export class VersionService {
  // 创建内容版本
  static async createVersion(
    contentId: bigint,
    data: {
      title?: string;
      content?: string;
      description?: string;
      source?: string;
      source_url?: string;
      changes_summary?: string;
    },
    userId: number
  ): Promise<ContentVersion> {
    // 获取下一个版本号
    const lastVersion = await prisma.content_versions.findFirst({
      where: { content_id: contentId },
      orderBy: { version_number: 'desc' }
    });
    
    const nextVersionNumber = (lastVersion?.version_number || 0) + 1;
    
    // 创建版本记录
    const version = await prisma.content_versions.create({
      data: {
        content_id: contentId,
        version_number: nextVersionNumber,
        title: data.title,
        content: data.content,
        description: data.description,
        source: data.source,
        source_url: data.source_url,
        changes_summary: data.changes_summary,
        created_by: userId
      }
    });
    
    return this.enrichVersionWithCreator(version);
  }
  
  // 获取内容的版本历史
  static async getVersionHistory(contentId: bigint): Promise<ContentVersion[]> {
    const versions = await prisma.content_versions.findMany({
      where: { content_id: contentId },
      orderBy: { version_number: 'desc' }
    });
    
    return Promise.all(versions.map(version => this.enrichVersionWithCreator(version)));
  }
  
  // 获取特定版本
  static async getVersion(contentId: bigint, versionNumber: number): Promise<ContentVersion | null> {
    const version = await prisma.content_versions.findUnique({
      where: {
        content_id_version_number: {
          content_id: contentId,
          version_number: versionNumber
        }
      }
    });
    
    if (!version) return null;
    
    return this.enrichVersionWithCreator(version);
  }
  
  // 比较两个版本
  static async compareVersions(
    contentId: bigint,
    oldVersionNumber: number,
    newVersionNumber: number
  ): Promise<VersionComparison | null> {
    const [oldVersion, newVersion] = await Promise.all([
      this.getVersion(contentId, oldVersionNumber),
      this.getVersion(contentId, newVersionNumber)
    ]);
    
    if (!oldVersion || !newVersion) return null;
    
    const changes: VersionComparison['changes'] = {};
    
    // 比较各个字段
    if (oldVersion.title !== newVersion.title) {
      changes.title = { old: oldVersion.title || '', new: newVersion.title || '' };
    }
    
    if (oldVersion.content !== newVersion.content) {
      changes.content = { old: oldVersion.content || '', new: newVersion.content || '' };
    }
    
    if (oldVersion.description !== newVersion.description) {
      changes.description = { old: oldVersion.description || '', new: newVersion.description || '' };
    }
    
    if (oldVersion.source !== newVersion.source) {
      changes.source = { old: oldVersion.source || '', new: newVersion.source || '' };
    }
    
    if (oldVersion.source_url !== newVersion.source_url) {
      changes.source_url = { old: oldVersion.source_url || '', new: newVersion.source_url || '' };
    }
    
    return {
      oldVersion,
      newVersion,
      changes
    };
  }
  
  // 回滚到指定版本
  static async rollbackToVersion(
    contentId: bigint,
    versionNumber: number,
    userId: number
  ): Promise<void> {
    const version = await this.getVersion(contentId, versionNumber);
    if (!version) {
      throw new Error('版本不存在');
    }
    
    // 获取当前内容以创建回滚前的版本
    const currentContent = await prisma.contents.findUnique({
      where: { id: contentId }
    });
    
    if (!currentContent) {
      throw new Error('内容不存在');
    }
    
    // 创建回滚前的版本快照
    await this.createVersion(
      contentId,
      {
        title: currentContent.title,
        content: currentContent.content ?? undefined,
        description: currentContent.description || undefined,
        source: currentContent.source || undefined,
        source_url: currentContent.source_url ?? undefined,
        changes_summary: `回滚前的版本快照 (回滚到版本 ${versionNumber})`
      },
      userId
    );
    
    // 更新内容到指定版本
    await prisma.contents.update({
      where: { id: contentId },
      data: {
        title: version.title || currentContent.title,
        content: version.content || currentContent.content,
        description: version.description || currentContent.description,
        source: version.source || currentContent.source,
        source_url: version.source_url || currentContent.source_url,
        updated_at: new Date()
      }
    });
    
    // 创建回滚操作的版本记录
    await this.createVersion(
      contentId,
      {
        title: version.title,
        content: version.content,
        description: version.description,
        source: version.source,
        source_url: version.source_url,
        changes_summary: `回滚到版本 ${versionNumber}`
      },
      userId
    );
  }
  
  // 删除版本历史（保留最近的几个版本）
  static async cleanupVersionHistory(contentId: bigint, keepCount: number = 10): Promise<void> {
    const versions = await prisma.content_versions.findMany({
      where: { content_id: contentId },
      orderBy: { version_number: 'desc' },
      skip: keepCount
    });
    
    if (versions.length > 0) {
      const versionIds = versions.map(v => v.id);
      await prisma.content_versions.deleteMany({
        where: { id: { in: versionIds } }
      });
    }
  }
  
  // 丰富版本数据，添加创建者信息
  private static async enrichVersionWithCreator(version: {
    id: number;
    content_id: bigint;
    version_number: number;
    title?: string | null;
    content?: string | null;
    description?: string | null;
    source?: string | null;
    source_url?: string | null;
    changes_summary?: string | null;
    created_by: number;
    created_at?: Date | null;
  }): Promise<ContentVersion> {
    const creator = await prisma.users.findUnique({
      where: { id: version.created_by },
      select: { id: true, username: true, display_name: true }
    });
    
    return {
      id: version.id,
      content_id: version.content_id,
      version_number: version.version_number,
      title: version.title || undefined,
      content: version.content || undefined,
      description: version.description || undefined,
      source: version.source || undefined,
      source_url: version.source_url || undefined,
      changes_summary: version.changes_summary || undefined,
      created_by: version.created_by,
      created_at: version.created_at || undefined,
      creator: creator
        ? { ...creator, display_name: creator.display_name ?? undefined }
        : undefined
    };
  }
}
