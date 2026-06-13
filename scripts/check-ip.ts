#!/usr/bin/env node
/**
 * 检查容器的出口 IP 地址
 */

async function checkIP() {
  console.log('=== 检查容器出口 IP ===\n');

  try {
    // 查询公网 IP
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    console.log(`容器出口 IP: ${data.ip}`);
  } catch (error) {
    console.error('查询 IP 失败:', error.message);
  }

  // 查询本地网络接口
  console.log('\n=== 本地网络接口 ===');
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // 跳过内部（即非 IPv4）和内部地址
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`${name}: ${net.address}`);
      }
    }
  }
}

checkIP().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
