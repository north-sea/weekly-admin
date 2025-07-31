import ky from 'ky';

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

// 图片上传服务
export class ImageUploadService {
  private static readonly UPLOAD_URL = 'https://img.mengpeng.tech/api/v1/upload';
  private static readonly AUTH_TOKEN = '3|RVzaqcbY5tCspfmpwc32gPVfW3K18sfjepbS2APA';

  /**
   * 上传图片到远程服务
   */
  static async uploadImage({ file, onProgress }: ImageUploadOptions): Promise<ImageUploadResponse> {
    try {
      // 验证文件类型
      if (!this.isValidImageType(file)) {
        throw new Error('不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式的图片');
      }

      // 验证文件大小 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('图片大小不能超过 5MB');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await ky.post(this.UPLOAD_URL, {
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.AUTH_TOKEN}`,
        },
        onUploadProgress: onProgress ? (progress) => {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        } : undefined,
      }).json<ImageUploadResponse>();

      return response;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error(error instanceof Error ? error.message : '图片上传失败');
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
   * 压缩图片
   */
  static async compressImage(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // 计算压缩后的尺寸
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // 绘制压缩后的图片
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
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