# 周刊 Karakeep 迁移执行说明

## 环境变量
- `KARAKEEP_HOST` / `KARAKEEP_KEY`：Karakeep API 基础配置
- `KARAKEEP_MIGRATION_LIST_ID`：目标列表 ID，默认 `wbmsj4bsybjj1hz04517yg5z`
- `IMAGE_UPLOAD_URL` / `IMAGE_UPLOAD_TOKEN`：Lsky 图床上传地址与鉴权

## 脚本位置
均位于 `scripts/迁移/`：
- `extract-weekly-source-urls.ts`：从周刊 Markdown 解析链接，填充 `source_url`；冲突/缺失会生成报表。
- `push-weekly-to-karakeep.ts`：根据 `source_url` 创建书签并加入迁移列表，`karakeep_id` 写入 `content_attributes`。
- `sync-weekly-from-karakeep.ts`：按 `karakeep_id` 拉取 Karakeep 数据，上传截图到 Lsky，回写 `summary`/`image_url`，`screenshot_api` 设置为 `karakeep`，默认回写成功后调用 Karakeep 归档，可通过 `--no-archive` 关闭。

## 运行示例
```bash
# 预览（不写库/不调接口）
pnpm tsx scripts/迁移/extract-weekly-source-urls.ts --dry-run
pnpm tsx scripts/迁移/push-weekly-to-karakeep.ts --dry-run --concurrency=3 --delay=200
pnpm tsx scripts/迁移/sync-weekly-from-karakeep.ts --dry-run   # 默认回写成功后归档；如需关闭归档加 --no-archive

# 实际执行
pnpm tsx scripts/迁移/extract-weekly-source-urls.ts
pnpm tsx scripts/迁移/push-weekly-to-karakeep.ts --concurrency=3 --delay=200
pnpm tsx scripts/迁移/sync-weekly-from-karakeep.ts             # 可加 --no-archive 关闭归档
```

## 报表
- 生成于 `scripts/迁移/reports/`，文件名包含时间戳。
- 关键状态：
  - URL 脚本：`conflict`（已填值与解析不一致，人工处理），`missing`（未解析到链接）。
  - 推送脚本：`no-source-url`（需人工补），`exists`（已有 `karakeep_id`），`failed`。
  - 回写脚本：`no-summary`（Karakeep 未返回总结），`no-image`（未获取截图），`partial`（部分字段更新），`failed`。

## 注意
- `screenshot_api` 已支持 `karakeep`，回写脚本默认写入该值；如需关闭归档可加 `--no-archive`。
