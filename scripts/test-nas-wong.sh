#!/bin/bash

# 在 NAS 容器内测试 wong 渠道的完整评分请求

ssh nas 'docker exec weekly-admin node <<'"'"'EOF'"'"'
const fetch = require("node:fetch");

const API_KEY = "9cpMCQ80IBOkKwraZvALYfxNc0CYgtZ3whoae5CmQ1FnGztH";
const BASE_URL = "https://wzw.pp.ua";

const prompt = `你是一个内容评分助手。评估技术文章的质量并返回 JSON 格式的评分。

评分维度（0-10分）：
- topic: 主题价值
- content: 内容质量
- depth: 深度
- practical: 实用性
- innovation: 创新性
- expression: 表达质量

返回格式：
{
  "dimensions": {
    "topic": 数字,
    "content": 数字,
    "depth": 数字,
    "practical": 数字,
    "innovation": 数字,
    "expression": 数字
  },
  "overall": 数字,
  "reasons": ["理由1", "理由2"]
}

标题：GitHub - lazygophers/ccplugin
URL：https://github.com/lazygophers/ccplugin
摘要：一个 Go 语言插件`;

fetch(`${BASE_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: "claude-opus-4-8",
    messages: [
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 512,
  }),
})
  .then((r) => r.text())
  .then((text) => {
    console.log("=== Response ===");
    console.log(text);

    try {
      const json = JSON.parse(text);
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        console.log("\n=== Extracted Content ===");
        console.log(content);

        const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        console.log("\n=== Cleaned JSON ===");
        console.log(cleaned);

        const parsed = JSON.parse(cleaned);
        console.log("\n=== Parsed Object ===");
        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.error("\n=== Parse Error ===");
      console.error(e.message);
    }
  })
  .catch((e) => {
    console.error("=== Fetch Error ===");
    console.error(e.message);
  });
EOF
'
