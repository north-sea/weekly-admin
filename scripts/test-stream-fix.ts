import OpenAI from 'openai';

async function testStream() {
  const client = new OpenAI({
    apiKey: 'sk-TOk3ezSmgLZRxBuaeFosXqBKYe8DnPkuyf90lyrBzmXEAhj4',
    baseURL: 'https://elysiver.h-e.top',
  });

  console.log('测试修改后的流式处理\n');

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON.' },
        { role: 'user', content: 'Generate a JSON object with fields: name (string) and score (number 0-10)' },
      ],
      temperature: 0,
      max_tokens: 200,
      stream: true,
    });

    console.log('开始接收流式数据...\n');

    // 模拟修改后的逻辑
    let accumulatedText = '';
    let chunkCount = 0;
    let contentCount = 0;
    let reasoningCount = 0;

    for await (const chunk of stream) {
      chunkCount++;
      const delta = chunk.choices[0]?.delta;
      const content = delta?.content || (delta as any)?.reasoning_content;

      if (delta?.content) contentCount++;
      if ((delta as any)?.reasoning_content) reasoningCount++;

      if (content) {
        accumulatedText += content;
      }
    }

    console.log('✅ 流式接收完成');
    console.log('总 chunk 数:', chunkCount);
    console.log('content chunk 数:', contentCount);
    console.log('reasoning_content chunk 数:', reasoningCount);
    console.log('累积文本长度:', accumulatedText.length);
    console.log('累积文本:', accumulatedText);

    if (accumulatedText.length > 0) {
      const jsonText = accumulatedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      console.log('\n清理后的文本:', jsonText);

      try {
        const parsed = JSON.parse(jsonText);
        console.log('✅ JSON 解析成功:', parsed);
      } catch (e: any) {
        console.error('❌ JSON 解析失败:', e.message);
      }
    } else {
      console.error('\n❌ 累积文本为空！');
    }
  } catch (error: any) {
    console.error('❌ 失败:', error.message);
  }
}

testStream();
