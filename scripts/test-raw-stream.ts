import OpenAI from 'openai';

async function test() {
  const client = new OpenAI({
    apiKey: 'sk-TOk3ezSmgLZRxBuaeFosXqBKYe8DnPkuyf90lyrBzmXEAhj4',
    baseURL: 'https://elysiver.h-e.top',
  });

  console.log('测试原始流式响应\n');

  const stream = await client.chat.completions.create({
    model: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: 'Say hi' }],
    temperature: 0,
    max_tokens: 50,
    stream: true,
  });

  let count = 0;
  for await (const chunk of stream) {
    count++;
    console.log('Chunk', count, ':', JSON.stringify(chunk, null, 2));
    if (count > 10) break;
  }
}

test();
