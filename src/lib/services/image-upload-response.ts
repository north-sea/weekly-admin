export interface NormalizedImageUploadData {
  url: string;
  filename: string;
  size: number;
  type: string;
}

export interface NormalizedImageUploadResult {
  success: boolean;
  data?: NormalizedImageUploadData;
  message?: string;
  statusCode: number;
}

interface NormalizeImageUploadResponseOptions {
  upstreamStatus: number;
  payload: unknown;
  fallback: {
    filename: string;
    size: number;
    type: string;
  };
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function inferFilenameFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop();
    return filename || undefined;
  } catch {
    return undefined;
  }
}

function getPayloadMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return getString(payload);
  }

  return (
    getString(payload.message) ||
    getString(payload.error) ||
    (isRecord(payload.error) ? getString(payload.error.message) : undefined) ||
    getString(payload.msg)
  );
}

export function extractImageUrl(payload: unknown): string | null {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return payload.startsWith('http') ? payload : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const candidates = [
    payload.url,
    isRecord(payload.data) ? payload.data.url : undefined,
    isRecord(payload.data) && isRecord(payload.data.links) ? payload.data.links.url : undefined,
    isRecord(payload.data) && isRecord(payload.data.links) ? payload.data.links.image : undefined,
    isRecord(payload.data) && isRecord(payload.data.links) ? payload.data.links.thumbnail : undefined,
  ];

  for (const candidate of candidates) {
    const url = getString(candidate);
    if (url) {
      return url;
    }
  }

  if (Array.isArray(payload.links)) {
    const link = payload.links.find((item) => typeof item === 'string' && item.startsWith('http'));
    if (link) {
      return link;
    }
  }

  if (Array.isArray(payload)) {
    const link = payload.find((item) => typeof item === 'string' && item.startsWith('http'));
    if (link) {
      return link;
    }
  }

  return null;
}

export function normalizeImageUploadResponse(
  options: NormalizeImageUploadResponseOptions
): NormalizedImageUploadResult {
  const { upstreamStatus, payload, fallback } = options;
  const upstreamOk = upstreamStatus >= 200 && upstreamStatus < 300;
  const url = extractImageUrl(payload);
  const message = getPayloadMessage(payload);
  const explicitFailure =
    isRecord(payload) && (payload.success === false || payload.status === false);

  if (upstreamOk && url && !explicitFailure) {
    const payloadData = isRecord(payload) && isRecord(payload.data) ? payload.data : undefined;

    return {
      success: true,
      statusCode: 200,
      data: {
        url,
        filename:
          getString(payloadData?.filename) ||
          getString(payloadData?.name) ||
          inferFilenameFromUrl(url) ||
          fallback.filename,
        size: getNumber(payloadData?.size) ?? fallback.size,
        type:
          getString(payloadData?.type) ||
          getString(payloadData?.mimetype) ||
          fallback.type,
      },
      message,
    };
  }

  return {
    success: false,
    statusCode: upstreamOk ? 502 : upstreamStatus,
    message: message || `上传失败，状态码 ${upstreamStatus}`,
  };
}
