import { describe, expect, it } from 'vitest';
import { extractImageUrl, normalizeImageUploadResponse } from './image-upload-response';

describe('image-upload response helpers', () => {
  it('extracts url from legacy success payload', () => {
    expect(
      extractImageUrl({
        success: true,
        data: {
          url: 'https://cdn.example.com/image.png',
        },
      })
    ).toBe('https://cdn.example.com/image.png');
  });

  it('extracts url from lsky payload', () => {
    expect(
      extractImageUrl({
        status: true,
        data: {
          links: {
            url: 'https://cdn.example.com/uploads/image.png',
          },
        },
      })
    ).toBe('https://cdn.example.com/uploads/image.png');
  });

  it('normalizes lsky success response', () => {
    expect(
      normalizeImageUploadResponse({
        upstreamStatus: 200,
        payload: {
          status: true,
          data: {
            links: {
              url: 'https://cdn.example.com/uploads/image.png',
            },
            size: 1234,
            mimetype: 'image/png',
          },
        },
        fallback: {
          filename: 'fallback.png',
          size: 4321,
          type: 'image/png',
        },
      })
    ).toEqual({
      success: true,
      statusCode: 200,
      data: {
        url: 'https://cdn.example.com/uploads/image.png',
        filename: 'image.png',
        size: 1234,
        type: 'image/png',
      },
      message: undefined,
    });
  });

  it('maps upstream business failure to bad gateway', () => {
    expect(
      normalizeImageUploadResponse({
        upstreamStatus: 200,
        payload: {
          status: false,
          message: '服务异常，请稍后再试',
          data: {},
        },
        fallback: {
          filename: 'fallback.png',
          size: 4321,
          type: 'image/png',
        },
      })
    ).toEqual({
      success: false,
      statusCode: 502,
      message: '服务异常，请稍后再试',
    });
  });
});
