import { prisma } from '../src/lib/db';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database structure...');
    
    // Check if all tables exist by querying them
    const users = await prisma.user.count();
    console.log(`✅ Users table: ${users} records`);
    
    const contentTypes = await prisma.contentType.count();
    console.log(`✅ ContentTypes table: ${contentTypes} records`);
    
    const categories = await prisma.category.count();
    console.log(`✅ Categories table: ${categories} records`);
    
    const tags = await prisma.tag.count();
    console.log(`✅ Tags table: ${tags} records`);
    
    const contents = await prisma.content.count();
    console.log(`✅ Contents table: ${contents} records`);
    
    const contentTags = await prisma.contentTag.count();
    console.log(`✅ ContentTags table: ${contentTags} records`);
    
    const weeklyIssues = await prisma.weeklyIssue.count();
    console.log(`✅ WeeklyIssues table: ${weeklyIssues} records`);
    
    const weeklyIssueContents = await prisma.weeklyIssueContent.count();
    console.log(`✅ WeeklyIssueContents table: ${weeklyIssueContents} records`);
    
    const operationLogs = await prisma.operationLog.count();
    console.log(`✅ OperationLogs table: ${operationLogs} records`);
    
    const contentVersions = await prisma.contentVersion.count();
    console.log(`✅ ContentVersions table: ${contentVersions} records`);
    
    console.log('\n🎉 All required tables are present and accessible!');
    
    // Check specific fields that were mentioned in the task
    const sampleContent = await prisma.content.findFirst({
      select: {
        id: true,
        userId: true,
        viewCount: true,
        wordCount: true,
        readingTime: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        source: true,
        sourceUrl: true,
        screenshotApiType: true,
        recommendationReason: true,
        coverImage: true,
      }
    });
    
    if (sampleContent) {
      console.log('\n📋 Sample content fields verification:');
      console.log('- user_id:', sampleContent.userId !== undefined ? '✅' : '❌');
      console.log('- view_count:', sampleContent.viewCount !== undefined ? '✅' : '❌');
      console.log('- word_count:', sampleContent.wordCount !== undefined ? '✅' : '❌');
      console.log('- reading_time:', sampleContent.readingTime !== undefined ? '✅' : '❌');
      console.log('- seo_title:', sampleContent.seoTitle !== undefined ? '✅' : '❌');
      console.log('- seo_description:', sampleContent.seoDescription !== undefined ? '✅' : '❌');
      console.log('- seo_keywords:', sampleContent.seoKeywords !== undefined ? '✅' : '❌');
      console.log('- source:', sampleContent.source !== undefined ? '✅' : '❌');
      console.log('- source_url:', sampleContent.sourceUrl !== undefined ? '✅' : '❌');
      console.log('- screenshot_api_type:', sampleContent.screenshotApiType !== undefined ? '✅' : '❌');
      console.log('- recommendation_reason:', sampleContent.recommendationReason !== undefined ? '✅' : '❌');
      console.log('- cover_image:', sampleContent.coverImage !== undefined ? '✅' : '❌');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();