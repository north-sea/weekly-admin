const text = `\`\`\`json
{
  "dimensions": {
    "topic": 3,
    "content": 2,
    "depth": 2,
    "practical": 3,
    "innovation": 3,
    "expression": 4
  },
  "overall": 3,
  "reasons": ["理由1", "理由2"]
}
\`\`\``;

console.log('Original:');
console.log(text);
console.log('\n---\n');

const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

console.log('Cleaned:');
console.log(cleaned);
console.log('\n---\n');

try {
  const parsed = JSON.parse(cleaned);
  console.log('✅ Parse OK');
  console.log(JSON.stringify(parsed, null, 2));
} catch (e) {
  console.error('❌ Parse failed:', e.message);
}
