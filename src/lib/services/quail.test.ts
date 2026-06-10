import { describe, expect, it } from 'vitest';
import { QuailService } from './quail';

describe('QuailService image retirement', () => {
  it('does not generate image markdown or cover_image payload fields', () => {
    const service = new QuailService();
    const postData = (service as any).generateQuailContent({
      title: 'Weekly 1',
      slug: '1',
      desc: '本期摘要',
      cover: 'https://cdn.example.com/cover.png',
      weekly_content_items: [
        {
          section: 'Tech',
          content: {
            title: 'With legacy image',
            source_url: 'https://example.com/a',
            image_url: 'https://cdn.example.com/a.png',
            description: '简介',
            summary: '摘要',
            content_tags: [{ tag: { name: 'AI' } }],
          },
        },
      ],
    });

    expect(postData.cover_image).toBeUndefined();
    expect(postData.content).not.toContain('![With legacy image]');
    expect(postData.content).not.toContain('https://cdn.example.com/a.png');
    expect(postData.slug).toBe('weekly-1');
  });
});
