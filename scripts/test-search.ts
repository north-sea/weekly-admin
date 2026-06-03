#!/usr/bin/env tsx

import { searchContentsWithFallback, getSearchSuggestions, getIndexStats } from '../src/lib/search';

async function testSearch() {
  try {
    console.log('🔍 Testing search functionality...');
    
    // Wait a bit for indexing to complete
    console.log('⏳ Waiting for indexing to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Get index stats
    console.log('\n📊 Getting index statistics...');
    try {
      const stats = await getIndexStats();
      console.log(`Index contains ${stats.numberOfDocuments} documents`);
    } catch (error) {
      console.warn('Meilisearch index stats unavailable; continuing with fallback-capable search test');
    }
    
    // Test 2: Basic search
    console.log('\n🔎 Testing basic search...');
    const searchResult = await searchContentsWithFallback({
      query: 'React',
      limit: 5,
    });
    console.log(`Found ${searchResult.total} results for "React"`);
    console.log(`Processing time: ${searchResult.processingTimeMs}ms`);
    console.log(`Search mode: ${searchResult.meta?.mode || 'unknown'}`);
    
    if (searchResult.hits.length > 0) {
      console.log('\nFirst result:');
      const firstHit = searchResult.hits[0];
      console.log(`- Title: ${firstHit.title}`);
      console.log(`- Type: ${firstHit.content_type_name}`);
      console.log(`- Status: ${firstHit.status}`);
    }
    
    // Test 3: Search with filters
    console.log('\n🎯 Testing filtered search...');
    const filteredResult = await searchContentsWithFallback({
      query: '',
      filters: {
        contentType: 'weekly',
        status: ['published'],
      },
      limit: 3,
    });
    console.log(`Found ${filteredResult.total} published weekly contents`);
    
    // Test 4: Search suggestions
    console.log('\n💡 Testing search suggestions...');
    const suggestions = await getSearchSuggestions('Java', 3);
    console.log(`Suggestions for "Java": ${suggestions.join(', ')}`);
    
    // Test 5: Empty search (should return all)
    console.log('\n📋 Testing empty search...');
    const allResults = await searchContentsWithFallback({
      query: '',
      limit: 10,
    });
    console.log(`Total documents available: ${allResults.total}`);
    
    console.log('\n✅ All search tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Search test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSearch();
}

export { testSearch };
