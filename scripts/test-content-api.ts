import { prisma } from '../src/lib/db';

async function testContentAPI() {
  try {
    console.log('测试数据库连接...');
    
    // 检查内容类型
    const contentTypes = await prisma.content_types.findMany();
    console.log('内容类型:', contentTypes);
    
    // 检查是否有Blog和Weekly类型
    const blogType = await prisma.content_types.findFirst({ where: { slug: 'blog' } });
    const weeklyType = await prisma.content_types.findFirst({ where: { slug: 'weekly' } });
    
    if (!blogType) {
      console.log('创建Blog内容类型...');
      await prisma.content_types.create({
        data: {
          name: 'Blog',
          slug: 'blog',
          description: 'Blog文章'
        }
      });
    }
    
    if (!weeklyType) {
      console.log('创建Weekly内容类型...');
      await prisma.content_types.create({
        data: {
          name: 'Weekly',
          slug: 'weekly',
          description: 'Weekly内容'
        }
      });
    }
    
    // 检查分类
    const categories = await prisma.categories.findMany();
    console.log('分类数量:', categories.length);
    
    // 检查标签
    const tags = await prisma.tags.findMany();
    console.log('标签数量:', tags.length);
    
    // 检查内容
    const contents = await prisma.contents.findMany();
    console.log('内容数量:', contents.length);
    
    console.log('数据库测试完成！');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testContentAPI();