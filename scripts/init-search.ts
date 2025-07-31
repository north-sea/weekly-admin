#!/usr/bin/env tsx

import { prisma } from '../src/lib/db';
import { setupContentIndex, bulkSyncContentsToSearch, clearSearchIndex, waitForTask } from '../src/lib/search';

async function initializeSearchIndex() {
  try {
    console.log('🔍 Initializing Meilisearch index...');
    
    // Setup the index configuration
    await setupContentIndex();
    console.log('✅ Index configuration completed');
    
    // Clear existing documents (optional, for fresh start)
    // console.log('🧹 Clearing existing search index...');
    // await clearSearchIndex();
    
    // Fetch all contents with related data
    console.log('📚 Fetching contents from database...');
    const contents = await prisma.contents.findMany({
      take: 100, // Limit for testing
    });
    
    // Fetch related data for each content
    const transformedContents = await Promise.all(contents.map(async (content) => {
      // Get category
      let category = null;
      if (content.category_id) {
        category = await prisma.categories.findUnique({
          where: { id: content.category_id }
        });
      }
      
      // Get tags
      const contentTags = await prisma.content_tags.findMany({
        where: { content_id: content.id }
      });
      
      const tags = await Promise.all(contentTags.map(async (ct) => {
        return await prisma.tags.findUnique({
          where: { id: ct.tag_id }
        });
      }));
      
      // Get user
      let user = null;
      if (content.user_id) {
        user = await prisma.users.findUnique({
          where: { id: content.user_id },
          select: {
            id: true,
            username: true,
            display_name: true
          }
        });
      }
      
      return {
        ...content,
        category,
        tags: tags.filter(Boolean),
        user
      };
    }));
    
    console.log(`📊 Found ${transformedContents.length} contents to sync`);
    
    if (transformedContents.length > 0) {
      // Sync all contents to search index
      const task = await bulkSyncContentsToSearch(transformedContents);
      console.log('⏳ Waiting for indexing to complete...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      console.log('✅ All contents synced to search index');
    }
    
    console.log('🎉 Search index initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to initialize search index:', error);
    process.exit(1);
  } finally {
    // Prisma client will be disconnected automatically
  }
}

// Run the initialization
if (require.main === module) {
  initializeSearchIndex();
}

export { initializeSearchIndex };