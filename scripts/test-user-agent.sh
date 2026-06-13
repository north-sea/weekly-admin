#!/bin/bash

echo "测试 1: 无 User-Agent"
echo "===================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST https://muyuan.do/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-opus-4-8","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}' \
  2>&1 | head -10

echo ""
echo ""
echo "测试 2: 带浏览器 User-Agent"
echo "============================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST https://muyuan.do/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -d '{"model":"claude-opus-4-8","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}' \
  2>&1 | head -10

echo ""
echo ""
echo "测试 3: 带 Anthropic SDK User-Agent"
echo "===================================="
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST https://muyuan.do/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "User-Agent: anthropic-sdk-js/0.21.0" \
  -d '{"model":"claude-opus-4-8","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}' \
  2>&1 | head -10
