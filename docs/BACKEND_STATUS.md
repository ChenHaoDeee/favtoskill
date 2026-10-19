# 后端完成情况与接入说明

更新时间：2026-10-19。这里区分代码实现、模拟演示和真实服务验收，不把配置存在等同于服务可用。

## 当前完成情况

| 能力 | 当前状态 |
| --- | --- |
| 分类、资料、Skill 管理 | SQLite 持久化、软删除、版本保护及撤回已实现 |
| 收藏问答、摘要、AI解析 | 已接真实对话模型；检索原文、校验引用，失败不回退假结果 |
| Skill 创建、调整、试运行、导出 | 统一对话与引用确认、生成保存防重、ZIP及原文引用已实现 |
| AI整理 | 预览、选中应用、重复保留、分类移动/有事实依据的合并、整体撤回已实现 |
| 文本导入 | **本轮新增后端**，无需密钥；先预览，再确认持久化 |
| 抖音真实链接导入 | **本轮新增 TikHub 后端适配**，需 TIKHUB_API_KEY，未做真实付费联调；目前仅帖子文案 |
| 语义向量检索 | 已有分块/缓存/范围隔离；本轮补独立服务商密钥和校验，未配置时仅关键词检索 |
| 抖音分享/灵动岛 | 现有界面仍为 Web 模拟；演示收录实际写入独立演示库 |

## 还没有完成的部分

| 优先级 | 项目 | 下一步技术路线 |
| --- | --- | --- |
| 演示补强 | 真实导入界面连接 | 当前顶栏仍进入模拟分享；后续将真实文本/链接表单连接本轮预览与确认接口，不需要先购买 API |
| 真实内容效果 | TikHub/Embedding 联调 | 填入各自密钥后，用新作品、新问题验收响应结构、额度/权限、相关性和失败情况；本轮仅使用隔离测试服务返回 |
| 多模态 | 视频ASR、图片OCR | 独立任务队列→合法媒体来源→ASR/OCR→带来源的片段；现阶段不把帖子文案当完整视频文字稿 |
| 平台扩展 | 小红书、B站真实导入 | 增加平台识别和各自TikHub适配/测试；目前展示平台标志不代表已接入真实采集 |
| 对话体验 | Token流式、刷新恢复交互卡片 | SSE需处理断开/重连/最终来源校验；问题卡/引用卡状态需单独持久化，当前历史仅保存文本与来源，Skill最终数据已持久化 |
| 正式上线 | 登录与用户隔离、限流、备份恢复、监控、HTTPS部署 | 当前保持本机单用户；确定部署目标后添加账号体系、服务端用户范围校验及运维，不直接把本机开发API公开 |
| 实机验证 | 手机键盘、安全区域、系统分享扩展 | Web模拟无法替代原生系统分享和灵动岛，需要原生壳/扩展与真机验收 |

对于笔试演示，优先验证「新资料→问答引用→生成Skill→导出」的真实闭环。无需先补齐所有正式上线能力。

## 不填新密钥时

- 不修改已有 `.env`；新增的 TikHub/Embedding 配置均可留空。
- 文本导入、管理、持久化、导出不依赖新 API。
- 真正的AI回答仍需要已有对话模型；无模型配置时可在演示库服务设置中明确选择离线演示，离线结果不冒充模型输出。
- `GET /api/capabilities`（演示库 `/api/demo/capabilities`）只检查配置，不调用外部接口、不返回密钥。

## 文本导入接口示例（PowerShell）

启动 `npm run dev`，在另一终端执行。以下例子只写入演示库，确认步骤会新增一条收藏；若希望只预览，停在第一步。

```powershell
$importBase = 'http://127.0.0.1:3001/api/demo'
$previewBody = @{ kind='text'; title='项目讲述清单'; text='先说明项目背景与目标，再说明个人行动，最后用结果与反馈证明价值。' } | ConvertTo-Json
$preview = Invoke-RestMethod "$importBase/imports/preview" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($previewBody))
$preview
# 明确确认保存，默认未分类；也可将categoryId设为现有分类ID。
$saved = Invoke-RestMethod "$importBase/imports/preview/$($preview.id)/confirm" -Method Post -ContentType 'application/json' -Body '{"categoryId":null}'
$saved
# 需要撤回时，仅在没有后续资料修改的情况下：
# Invoke-RestMethod "$importBase/undo/$($saved.undoId)" -Method Post -ContentType 'application/json' -Body '{}'
```

`GET /imports/preview/:id` 可读取持久化预览。重复确认不会重复保存；同原文导入返回已有收藏。已撤回/移除后再确认旧预览返回409，重新预览才可再次导入。

## TikHub 抖音链接

仅在服务端 `.env` 中填写 `TIKHUB_API_KEY` 并重启API。调用 `POST /imports/preview`：

```json
{"kind":"link","shareText":"这里粘贴一条含 https://v.douyin.com/.../ 的真实分享文本"}
```

预览返回后用同一确认接口保存。当前默认未分类；确认时可选择已有分类，AI重点解析和分类建议沿用现有接口，尚未自动编排成导入流水线。

实现依据：[TikHub官方分享链接接口](https://docs.tikhub.io/257556744e0)，路径 `GET /api/v1/douyin/web/fetch_one_video_by_share_url?share_url=...`，服务端Bearer鉴权。只提取作品ID和文案；受限/已删除/无文案明确失败，不自动重试计费请求。不接收其他平台URL，不下载视频，也不伪造转录内容。

## 独立向量服务

```dotenv
AI_EMBEDDING_MODEL=
AI_EMBEDDING_BASE_URL=
AI_EMBEDDING_API_KEY=
AI_SIMILARITY_THRESHOLD=0.3
```

向量和对话平台不同必须填写独立向量密钥；只有API根地址一致时允许沿用对话密钥。填写后会在首次检索生成原文片段缓存；配置校验通过仍不等于服务已连通或检索质量达标。

本轮新增接口与向量分支已通过隔离自动化测试；未使用用户TikHub/向量付费服务，未修改用户的模型配置或知识数据。


## 后续更新：可重复演示与原文更新
已新增服务设置内“刷新演示数据”，确认后恢复预设收藏/Skill、轮换三条待分类样例和平台展示、准备重复副本与模拟版本更新，可选择同时切离线模式。普通浏览器刷新不丢修改；演示重置覆盖演示库编辑，个人库和密钥不变，历史保留，完成提示可撤回（仍受后续写入版本保护）。
资料编辑支持手动补充原文→AI整理中预览→确认替换；TikHub导入资料可主动检查原帖文案更新，需配置服务。模拟更新明确标识，不冒充联网抓取。关联Skill不会自动重写，应用后提示可重新生成。暂无自动定时抓取、ASR/OCR。
28项测试和隔离浏览器验证已通过；可运行 `npx tsx scripts/demo-sandbox.ts` 在5174/3002启动纯内存无密钥测试环境，关闭进程即丢弃，原项目仍使用5173/3001。
