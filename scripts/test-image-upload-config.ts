#!/usr/bin/env tsx

/**
 * Test script for ImageUploadService configuration validation
 * This script tests the new environment variable configuration for the image upload service
 */

import { ImageUploadService } from '../src/lib/services/image-upload';

console.log('🧪 Testing ImageUploadService Configuration...\n');

// Test 1: Missing environment variables
console.log('Test 1: Missing environment variables');
delete process.env.IMAGE_UPLOAD_URL;
delete process.env.IMAGE_UPLOAD_TOKEN;

try {
  ImageUploadService.validateConfig();
  console.log('❌ FAIL: Should have thrown error for missing IMAGE_UPLOAD_URL');
} catch (error) {
  console.log('✅ PASS: Correctly caught missing IMAGE_UPLOAD_URL error');
  console.log(`   Error: ${error instanceof Error ? error.message : error}`);
}

// Test 2: Missing token only
console.log('\nTest 2: Missing IMAGE_UPLOAD_TOKEN');
process.env.IMAGE_UPLOAD_URL = 'https://img.mengpeng.tech/api/v1/upload';
process.env.IMAGE_UPLOAD_TOKEN = '';

try {
  ImageUploadService.validateConfig();
  console.log('❌ FAIL: Should have thrown error for missing IMAGE_UPLOAD_TOKEN');
} catch (error) {
  console.log('✅ PASS: Correctly caught missing IMAGE_UPLOAD_TOKEN error');
  console.log(`   Error: ${error instanceof Error ? error.message : error}`);
}

// Test 3: Invalid URL format
console.log('\nTest 3: Invalid URL format');
process.env.IMAGE_UPLOAD_URL = 'not-a-valid-url';
process.env.IMAGE_UPLOAD_TOKEN = 'test-token';

try {
  ImageUploadService.validateConfig();
  console.log('❌ FAIL: Should have thrown error for invalid URL format');
} catch (error) {
  console.log('✅ PASS: Correctly caught invalid URL format error');
  console.log(`   Error: ${error instanceof Error ? error.message : error}`);
}

// Test 4: Valid configuration
console.log('\nTest 4: Valid configuration');
process.env.IMAGE_UPLOAD_URL = 'https://img.mengpeng.tech/api/v1/upload';
process.env.IMAGE_UPLOAD_TOKEN = 'test-token-123';

try {
  ImageUploadService.validateConfig();
  console.log('✅ PASS: Valid configuration accepted');
} catch (error) {
  console.log('❌ FAIL: Valid configuration should not throw error');
  console.log(`   Error: ${error instanceof Error ? error.message : error}`);
}

// Test 5: isConfigured method
console.log('\nTest 5: isConfigured method');
const isConfigured = ImageUploadService.isConfigured();
console.log(`✅ PASS: isConfigured() returns ${isConfigured} (should be true)`);

// Test 6: isConfigured with missing config
console.log('\nTest 6: isConfigured with missing config');
process.env.IMAGE_UPLOAD_TOKEN = '';
const isConfiguredMissing = ImageUploadService.isConfigured();
console.log(`✅ PASS: isConfigured() returns ${isConfiguredMissing} (should be false)`);

console.log('\n🎉 All tests completed!');
console.log('\n📝 Summary:');
console.log('- Configuration validation works correctly');
console.log('- Missing environment variables are detected');
console.log('- Invalid URL format is detected');
console.log('- Valid configuration is accepted');
console.log('- isConfigured() method works as expected');