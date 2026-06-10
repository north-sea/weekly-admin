// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { menuConfig, type NavItem } from './MenuConfig';

const flatten = (items: NavItem[]): NavItem[] => items.flatMap((item) => [
  item,
  ...(item.children ? flatten(item.children) : []),
]);

describe('menuConfig', () => {
  it('organizes primary navigation by weekly production stages', () => {
    expect(menuConfig.map((item) => item.name)).toEqual([
      '驾驶舱',
      '采集',
      '筛选',
      '组刊',
      '发布',
      '复盘',
      '设置',
    ]);
  });

  it('keeps existing core routes reachable through production navigation', () => {
    const paths = flatten(menuConfig)
      .map((item) => item.path)
      .filter(Boolean);

    expect(paths).toEqual(expect.arrayContaining([
      '/dashboard',
      '/sources',
      '/rss',
      '/inbox',
      '/content/list',
      '/search',
      '/weekly',
      '/publish',
      '/analytics',
      '/operation-logs',
      '/settings/categories',
      '/settings/tags',
      '/settings/ai',
    ]));
  });

  it('does not expose legacy image production entries as navigation labels', () => {
    const labels = flatten(menuConfig).map((item) => item.name).join(' ');

    expect(labels).not.toMatch(/图片|封面|截图|裁剪|AI 图片/);
  });
});
