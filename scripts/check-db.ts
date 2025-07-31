import { prisma } from '../src/lib/db';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database structure...');
    
    // Check if all tables exist by querying them
    const users = await prisma.users.count();
    console.log(`✅ Users table: ${users} records`);
    
    const contentTypes = await prisma.content_types.count();
    console.log(`✅ ContentTypes table: ${contentTypes} records`);
    
    const categories = await prisma.categories.count();
    console.log(`✅ Categories table: ${categories} records`);
    
    const tags = await prisma.tags.count();
    console.log(`✅ Tags table: ${tags} records`);
    
    const contents = await prisma.contents.count();
    console.log(`✅ Contents table: ${contents} records`);
    
    const contentTags = await prisma.content_tags.count();
    console.log(`✅ ContentTags table: ${contentTags} records`);
    
    const weeklyIssues = await prisma.weekly_issues.count();
    console.log(`✅ WeeklyIssues table: ${weeklyIssues} records`);
    
    const weeklyIssueContents = await prisma.weekly_content_items.count();
    console.log(`✅ WeeklyIssueContents table: ${weeklyIssueContents} records`);
    
    const operationLogs = await prisma.operation_logs.count();
    console.log(`✅ OperationLogs table: ${operationLogs} records`);
    
    const contentVersions = await prisma.content_versions.count();
    console.log(`✅ ContentVersions table: ${contentVersions} records`);
    
    console.log('\n🎉 All required tables are present and accessible!');
    
    // Check specific fields that were mentioned in the task
    const sampleContent = await prisma.contents.findFirst({
      select: {
        id: true,
        user_id: true,
        view_count: true,
        word_count: true,
        reading_time: true,
        meta_title: true,
        meta_description: true,
        source: true,
        source_url: true,
        screenshot_api: true,
      }
    });
    
    if (sampleContent) {
      console.log('\n📋 Sample content fields verification:');
      console.log('- user_id:', sampleContent.user_id !== undefined ? '✅' : '❌');
      console.log('- view_count:', sampleContent.view_count !== undefined ? '✅' : '❌');
      console.log('- word_count:', sampleContent.word_count !== undefined ? '✅' : '❌');
      console.log('- reading_time:', sampleContent.reading_time !== undefined ? '✅' : '❌');
      console.log('- meta_title:', sampleContent.meta_title !== undefined ? '✅' : '❌');
      console.log('- meta_description:', sampleContent.meta_description !== undefined ? '✅' : '❌');
      console.log('- source:', sampleContent.source !== undefined ? '✅' : '❌');
      console.log('- source_url:', sampleContent.source_url !== undefined ? '✅' : '❌');
      console.log('- screenshot_api:', sampleContent.screenshot_api !== undefined ? '✅' : '❌');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();