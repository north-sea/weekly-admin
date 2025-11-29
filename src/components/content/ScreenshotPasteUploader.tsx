'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ImageUploadService } from '@/lib/services/image-upload';
import { ClipboardPaste, RotateCcw, RotateCw, UploadCloud, X } from 'lucide-react';

type AspectValue = number | 'free';

const aspectOptions: Array<{ label: string; value: AspectValue }> = [
  { label: '自由', value: 'free' },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
];

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function getCanvasWithEdits(
  image: HTMLImageElement,
  crop: PixelCrop | undefined,
  rotation: number
): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const cropX = crop ? crop.x * scaleX : 0;
  const cropY = crop ? crop.y * scaleY : 0;
  const cropWidth = crop ? crop.width * scaleX : image.naturalWidth;
  const cropHeight = crop ? crop.height * scaleY : image.naturalHeight;

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  const rotatedWidth = cropWidth * cos + cropHeight * sin;
  const rotatedHeight = cropWidth * sin + cropHeight * cos;

  canvas.width = rotatedWidth;
  canvas.height = rotatedHeight;

  ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    -cropWidth / 2,
    -cropHeight / 2,
    cropWidth,
    cropHeight
  );

  return canvas;
}

interface ScreenshotPasteUploaderProps {
  value?: string;
  onChange?: (url: string) => void;
  label?: string;
  helperText?: string;
}

export default function ScreenshotPasteUploader({
  value,
  onChange,
  label = '主图',
  helperText = '支持粘贴 / 拖拽截图，裁剪、旋转后上传',
}: ScreenshotPasteUploaderProps) {
  const { toast } = useToast();
  const [source, setSource] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('pasted-image.png');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<AspectValue>('free');
  const [rotation, setRotation] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const resetState = useCallback(() => {
    if (source) {
      URL.revokeObjectURL(source);
    }
    setSource(null);
    setOriginalFile(null);
    setFileName('pasted-image.png');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setRotation(0);
    setProgress(0);
  }, [source]);

  useEffect(() => {
    return () => {
      if (source) {
        URL.revokeObjectURL(source);
      }
    };
  }, [source]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: '仅支持图片',
        description: '请粘贴或选择图片文件',
        variant: 'destructive',
      });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    if (source) {
      URL.revokeObjectURL(source);
    }
    setSource(objectUrl);
    setOriginalFile(file);
    setFileName(file.name || 'pasted-image.png');
    setProgress(0);
  }, [source, toast]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (file) {
      event.preventDefault();
      handleFile(file);
      toast({
        title: '已捕获截图',
        description: '请调整后上传',
      });
    }
  }, [handleFile, toast]);

  const handleFileInput = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    imageRef.current = event.currentTarget;
    if (typeof aspect === 'number') {
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspect));
    }
  };

  const handleAspectChange = (value: AspectValue) => {
    setAspect(value);
    if (imageRef.current && typeof value === 'number') {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, value));
    } else {
      setCrop(undefined);
    }
  };

  const handleUpload = async () => {
    if (!originalFile || !imageRef.current) {
      toast({
        title: '暂无可上传的图片',
        description: '请先粘贴或选择截图',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      setProgress(0);

      const canvas = await getCanvasWithEdits(imageRef.current, completedCrop, rotation);
      const blob: Blob | null = canvas
        ? await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
        : null;

      const uploadFile = blob
        ? new File([blob], fileName, { type: blob.type || 'image/png', lastModified: Date.now() })
        : originalFile;

      const response = await ImageUploadService.uploadImage({
        file: uploadFile,
        onProgress: (val) => setProgress(val),
      });

      if (response.success) {
        onChange?.(response.data.url);
        toast({
          title: '上传成功',
          description: '链接已回填到输入框',
        });
        resetState();
      } else {
        throw new Error(response.message || '上传失败');
      }
    } catch (error: any) {
      toast({
        title: '上传失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const currentPreview = source || value || '';

  return (
    <div
      className="rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 shadow-sm"
      onPaste={handlePaste}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleFileInput}>
          <ClipboardPaste className="h-4 w-4 mr-2" />
          选择/粘贴
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
        />
      </div>
      {value && !source && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">已填入 URL</Badge>
          <span className="truncate">{value}</span>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {source ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">长宽比</Label>
                <Select
                  value={aspect.toString()}
                  onValueChange={(val) => handleAspectChange(val === 'free' ? 'free' : Number(val))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aspectOptions.map((option) => (
                      <SelectItem key={option.label} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  逆时针
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  顺时针
                </Button>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  <X className="h-4 w-4 mr-1" />
                  清除
                </Button>
              </div>
            </div>

            <div className="rounded border bg-muted/30 p-2">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={typeof aspect === 'number' ? aspect : undefined}
                keepSelection
                ruleOfThirds
              >
                <img
                  src={source}
                  alt="pasted"
                  onLoad={handleImageLoad}
                  className="max-h-[380px] object-contain"
                />
              </ReactCrop>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
              >
                <UploadCloud className="h-4 w-4 mr-2" />
                {uploading ? '上传中...' : '上传并回填'}
              </Button>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-32 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span>{progress}%</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">操作提示</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>在截图工具复制后，直接在此卡片粘贴即可捕获图片</li>
              <li>如需手动选择文件，点击右上角「选择/粘贴」</li>
              <li>支持裁剪、旋转后上传，上传成功自动回填主图链接</li>
            </ul>
          </div>
        )}

        {currentPreview && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">当前预览</Label>
            <div className="rounded border bg-muted/30 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPreview}
                alt="current-preview"
                className="max-h-56 w-full rounded object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
