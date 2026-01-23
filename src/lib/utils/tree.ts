import { CategoryWithStats } from '@/types/category';

export interface TreeNode extends CategoryWithStats {
  children: TreeNode[];
  level: number;
}

export function buildCategoryTree(categories: CategoryWithStats[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  // 初始化所有节点
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [], level: 0 });
  });

  // 构建树结构
  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      const parent = map.get(cat.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 按 sort_order 排序
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

export function flattenTree(nodes: TreeNode[], expandedIds: Set<number>): TreeNode[] {
  const result: TreeNode[] = [];

  const traverse = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      result.push(node);
      if (expandedIds.has(node.id) && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(nodes);
  return result;
}
