#!/usr/bin/env node
/**
 * 调试 AI 网关请求，打印完整的请求/响应头
 */

async function debugRequest() {
  const baseUrl = 'https://muyuan.do';
  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    console.error('❌ Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }

  console.log('🔍 发送测试请求到:', baseUrl);
  console.log('');

  const testCases = [
    {
      name: '无 User-Agent（当前代码）',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
    {
      name: '模拟浏览器 User-Agent',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    },
    {
      name: '模拟 Anthropic SDK User-Agent',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'anthropic-sdk-js/0.21.0',
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${testCase.name}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: testCase.headers,
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      console.log(`✅ 状态码: ${response.status} ${response.statusText}`);
      console.log(`\n响应头:`);
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });

      const body = await response.text();
      console.log(`\n响应体前 200 字符:`);
      console.log(body.slice(0, 200));

      if (!response.ok) {
        console.log(`\n❌ 请求失败`);
        console.log(`完整响应体:`);
        console.log(body);
      } else {
        console.log(`\n✅ 请求成功`);
      }
    } catch (error) {
      console.error(`❌ 请求异常:`, error);
    }

    // 等待 2 秒避免触发限流
    if (testCase !== testCases[testCases.length - 1]) {
      console.log('\n⏳ 等待 2 秒...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 测试完成');
  console.log(`${'='.repeat(60)}`);
}

debugRequest().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
