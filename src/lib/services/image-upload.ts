import ky from 'ky';
import imageCompression from 'browser-image-compression';

export interface ImageUploadResponse {
  success: boolean;
  data: {
    url: string;
    filename: string;
    size: number;
    type: string;
  };
  message?: string;
}

export interface ImageUploadOptions {
  file: File;
  onProgress?: (progress: number) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('图片读取失败'));
        return;
      }
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error('图片读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

// 图片上传服务
export class ImageUploadService {
  /**
   * 获取上传 URL（前端统一走内部 API 代理）
   */
  private static getUploadUrl(): string | undefined {
    return '/api/upload/image';
  }

  /**
   * 验证图片上传服务配置
   */
  static validateConfig(): void {
    const uploadUrl = this.getUploadUrl();
    if (!uploadUrl) {
      throw new Error('图片上传服务未配置');
    }
  }

  /**
   * 检查图片上传服务是否可用
   */
  static isConfigured(): boolean {
    return !!this.getUploadUrl();
  }

  /**
   * 上传图片到远程服务
   * 超过 5MB 的图片会自动压缩
   */
  static async uploadImage({ file, onProgress }: ImageUploadOptions): Promise<ImageUploadResponse> {
    try {
      // 验证服务配置
      this.validateConfig();

      // 验证文件类型
      if (!this.isValidImageType(file)) {
        throw new Error('不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式的图片');
      }

      let fileToUpload = file;
      const maxSize = 5 * 1024 * 1024; // 5MB

      // 超过 5MB 自动压缩
      if (file.size > maxSize) {
        console.log(`图片 ${file.name} 大小 ${this.formatFileSize(file.size)}，开始压缩...`);
        fileToUpload = await this.compressImage(file, {
          maxWidthOrHeight: 1200,  // 封面展示宽度约 400px，3 倍图 = 1200px
          maxSizeMB: 4, // 目标 4MB 以内，留点余量
          quality: 0.85,
        });
        console.log(`压缩后大小: ${this.formatFileSize(fileToUpload.size)}`);

        // 压缩后仍然超过限制
        if (fileToUpload.size > maxSize) {
          throw new Error(`图片压缩后仍超过 5MB (${this.formatFileSize(fileToUpload.size)})，请手动裁剪后重试`);
        }
      }

      const uploadUrl = this.getUploadUrl()!;
      const contentBase64 = await fileToBase64(fileToUpload);

      const response = await ky.post(uploadUrl, {
        json: {
          filename: fileToUpload.name,
          type: fileToUpload.type,
          contentBase64,
        },
      }).json<ImageUploadResponse>();

      onProgress?.(100);

      return response;
    } catch (error) {
      console.error('Image upload failed:', error);
      
      // 提供更具体的错误信息
      if (error instanceof Error) {
        if (error.message.includes('图片上传服务未配置')) {
          throw error; // 重新抛出配置错误
        }
        throw new Error(error.message);
      }
      
      throw new Error('图片上传失败');
    }
  }

  /**
   * 批量上传图片
   */
  static async uploadMultipleImages(
    files: File[], 
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<ImageUploadResponse[]> {
    const results: ImageUploadResponse[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await this.uploadImage({
          file,
          onProgress: onProgress ? (progress) => onProgress(i, progress) : undefined,
        });
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          data: {
            url: '',
            filename: file.name,
            size: file.size,
            type: file.type,
          },
          message: error instanceof Error ? error.message : '上传失败',
        });
      }
    }

    return results;
  }

  /**
   * 压缩图片（使用 browser-image-compression 库）
   * @param file 原始文件
   * @param options 压缩选项
   * @param options.maxWidthOrHeight 最大宽度或高度，默认 1200（适合封面展示，约 3 倍图）
   * @param options.maxSizeMB 目标最大文件大小（MB），默认 4MB
   * @param options.quality 压缩质量 0-1，默认 0.85
   */
  static async compressImage(
    file: File,
    options: {
      maxWidthOrHeight?: number;
      maxSizeMB?: number;
      quality?: number;
    } = {}
  ): Promise<File> {
    const { maxWidthOrHeight = 1200, maxSizeMB = 4, quality = 0.85 } = options;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB,
        maxWidthOrHeight,
        initialQuality: quality,
        useWebWorker: true,
        // 保持 EXIF 方向信息
        preserveExif: false,
        // 输出格式：PNG 转 JPEG 可以大幅减小体积
        fileType: file.type === 'image/png' ? 'image/jpeg' : undefined,
      });

      // 如果是 PNG 转 JPEG，更新文件名
      if (file.type === 'image/png') {
        const newName = file.name.replace(/\.png$/i, '.jpg');
        return new File([compressedFile], newName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }

      return compressedFile;
    } catch (error) {
      console.error('图片压缩失败:', error);
      throw new Error('图片压缩失败，请重试');
    }
  }

  /**
   * 验证图片类型
   */
  private static isValidImageType(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 生成缩略图
   */
  static async generateThumbnail(file: File, size: number = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = size;
        canvas.height = size;

        // 计算裁剪区域（居中裁剪）
        const { width, height } = img;
        const minDimension = Math.min(width, height);
        const x = (width - minDimension) / 2;
        const y = (height - minDimension) / 2;

        ctx?.drawImage(img, x, y, minDimension, minDimension, 0, 0, size, size);
        resolve(canvas.toDataURL());
      };

      img.onerror = () => reject(new Error('缩略图生成失败'));
      img.src = URL.createObjectURL(file);
    });
  }
}
