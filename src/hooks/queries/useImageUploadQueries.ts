/**
 * 图片上传相关的 React Query Hooks
 * 用于管理图片上传的mutations和状态
 */

import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { ImageUploadService, ImageUploadResponse, ImageUploadOptions } from '@/lib/services/image-upload';

// ============================================================================
// Hooks
// ============================================================================

/**
 * 上传单个图片
 */
export function useImageUpload(
  options?: Omit<UseMutationOptions<ImageUploadResponse, Error, ImageUploadOptions>, 'mutationFn'>
) {
  return useMutation({
    mutationFn: ImageUploadService.uploadImage,
    ...options,
  });
}

/**
 * 批量上传图片
 */
export function useMultipleImageUpload(
  options?: Omit<
    UseMutationOptions<
      ImageUploadResponse[],
      Error,
      { files: File[]; onProgress?: (fileIndex: number, progress: number) => void }
    >,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: ({ files, onProgress }) => ImageUploadService.uploadMultipleImages(files, onProgress),
    ...options,
  });
}

/**
 * 压缩图片
 */
export function useCompressImage(
  options?: Omit<
    UseMutationOptions<File, Error, { file: File; quality?: number }>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: ({ file, quality }) => ImageUploadService.compressImage(file, quality),
    ...options,
  });
}

/**
 * 生成缩略图
 */
export function useGenerateThumbnail(
  options?: Omit<
    UseMutationOptions<string, Error, { file: File; size?: number }>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: ({ file, size }) => ImageUploadService.generateThumbnail(file, size),
    ...options,
  });
}

// 导出图片上传服务的工具方法
export { ImageUploadService } from '@/lib/services/image-upload';

// 导出便捷hooks别名
export const useUploadImage = useImageUpload;
export const useUploadImages = useMultipleImageUpload;
