# 技术架构与数据结构

响应式补充（2026-10-18）：前端以 Mobile First CSS 为基础，768/1100px 扩展布局；`src/hooks/useVisualViewport.ts` 管理可视区域及输入焦点变化，CSS Safe Area 处理系统边缘。对话使用独立滚动区和 fixed-body 锁滚动，接口/数据结构不变。验证与真机限制见 [RESPONSIVE_QA.md](RESPONSIVE_QA.md)。

更新：2026-10-18，第一轮。产品定义以 [PRD](PRD.md) 为准。

## 1. 当前架构
```
React 19 + TypeScript / Vite
  └─ src/api.ts → /api/*（开发代理或 VITE_API_BASE_URL）
       └─ Fastify 5 独立 Node.js API
            ├─ SQLite / node:sqlite → data/favtoskill.sqlite
            └─ server/ai.ts → 服务端配置的 Chat Completions API
```
本机 Node 24；最低要求 Node 22.13（node:sqlite）。数据库使用 Node 内置 node:sqlite，封装于 store.ts；部署需固定 Node 版本，升级或迁移时集中验证。首轮本机单用户、无预置收藏。前端构建产物 dist 可静态托管，后端独立部署；REDcowork 是否支持 HTTPS 外部请求/CORS/CSP 尚待实际验证。它不能代替后端存储密钥。

选型依据：React + TypeScript 满足需求；Fastify 自带请求生命周期与注入测试；SQLite 降低本机启动成本。当前只实现读取仓储和对话持久化，不能称为完整知识管理/RAG 产品。

官方参考：[Vite](https://vite.dev/guide/)、[Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)。依赖实际解析版本固定于 package-lock.json；使用 npm ci 复现。

## 2. 目录
- src：页面、样式、全局对话组件、API 客户端。
- server：启动、API 路由、模型适配、数据库仓储。
- shared/contracts.ts：跨端实体和契约。
- docs：PRD、架构、任务及验证结果。
- tests：API 集成测试；不访问真实收费模型。
- data：运行时数据库，忽略 Git；备份需覆盖数据库及 WAL/SHM 或执行 SQLite 备份。

## 3. 当前数据结构
| 实体 | 字段与约束 |
|---|---|
| Category | id、name（唯一）、createdAt；不设 parentId，保留 PRD 两级结构 |
| Knowledge | id、title、originalText、imagePath?、sourcePlatform?、sourceUrl?、summary、keyPoints[]、categoryId/null、tags[]、completeness、createdAt、updatedAt |
| Skill | id、name、description、scenarios[]、inputRequirements、steps[]、outputFormat、knowledgeIds[]、limitations[]、externalDependencies[]、createdAt、updatedAt |
| Conversation | id、title、createdAt |
| Message | id、conversationId（数据库外键）、role、content、sources[]、createdAt |

categories/conversations/messages 为列式存储。知识与 Skill 首轮只有空表和类型，后续写入模块前将拆出原文、解析版本、引用关系；不能在 JSON 中悄悄新增未校验写入。模型生成结果和原始资料分离。时间使用 ISO UTC，界面本地化展示。

## 4. 已实现 API
所有响应 JSON；错误统一 `{error:{code,message,retryable}}`。
| Method | 路径 | 响应/行为 |
|---|---|---|
| GET | /api/health | status、aiConfigured（仅配置是否存在，不代表模型可用）、phase |
| GET | /api/categories | `{items:Category[]}` |
| GET | /api/knowledge | `{items:Knowledge[]}` |
| GET | /api/skills | `{items:Skill[]}` |
| GET | /api/conversations | 最近 100 条对话 |
| GET | /api/conversations/:id/messages | `{items:Message[]}`，不存在 404 |
| POST | /api/chat | `{conversationId?,content,context:{page,categoryId?,knowledgeId?}}` → `{conversationId,message}` |

对话内容 1–8000 字；AI 缺配置返回 503 AI_NOT_CONFIGURED；真实调用超时 45 秒；不记录密钥或供应商原始错误。成功后用户/模型消息事务存储，失败保留前端输入；新对话模型失败可能保留空会话，后续可清理。上下文携带最近 20 条消息；完整历史保留于数据库。首轮未接入检索，系统指令明确无收藏来源，响应 sources=[]。不以空检索的通用回答声称 RAG 已完成。

## 5. 后续 API 约定（尚未实现，不返回伪成功）
| 模块 | 拟定接口 | 关键要求 |
|---|---|---|
| 分类/知识管理 | POST/PATCH/DELETE /categories、GET/PATCH/DELETE /knowledge/:id | 校验引用、删除确认、事务与撤回 |
| 采集 | POST /imports；GET /imports/:id | 接收类型 text/image/url；job 状态、原始内容、完整性、错误码；实际调用模型 |
| 深度整理 | POST /organize/plans；POST /organize/plans/:id/apply | 预览变化、用户确认、数据版本校验、事务、撤销 |
| RAG | POST /chat 扩展检索 | 意图识别、来源位置、片段引用与来源可追溯 |
| Skill | 对话生成 draft；PATCH /skills/:id；POST /skills/:id/run；GET /skills/:id/export | 统一创建对话、引用人工确认、文本试运行、导出目标显式指定 |
| 唤醒 | GET /suggestions；PATCH /suggestions/:id | 依据、忽略/关闭、冷却周期、无自动数据修改 |

## 6. AI 与检索演进
1. 服务端多模态适配器接收文本/截图，结构化 JSON 输出由 Zod 校验；只解析可见信息，失败不保存为“已解析成功”。截图文件大小、MIME、存储与保留策略在模块 3 实施。
2. 分类优先现有主题，无适配时建议新建或待整理；单篇默认保存与管理确认分开。
3. 原文分块，保留 cardId、chunkId、字符范围、完整性；服务端调用 embedding，记录模型及维度。初期 SQLite 存向量并在服务端余弦检索，结合关键词候选与阈值；数据量增加后迁移 PostgreSQL + pgvector。检索不得只索引摘要。
4. RAG 使用历史上下文重写问题、限制分类范围、检索、引用约束与来源校验。无依据明确无结果；片段提示不完整。
5. Skill 使用同一对话意图路由，草稿状态机：clarify → select_sources → generate → preview → trial → save/export。工具执行由服务端白名单验证，不把模型输出直接当 SQL/操作执行。
6. 唤醒依赖相似度与用户实际行为，规则生成候选，AI 解释价值；阈值/频控待确认。

## 7. 部署与安全边界
- 当前仅监听 127.0.0.1，适合本机验证；CORS 只允许 WEB_ORIGIN，不将 CORS 作为认证。
- .env 只在服务器；前端仅 VITE_API_BASE_URL，严禁 VITE_ 密钥。无钥匙不伪造结果。
- 本轮尚无登录、多用户隔离、限流/配额；公网部署前必须实现身份校验、隔离、TLS、请求限流、日志脱敏与备份恢复。
- 社媒链接解析后续必须采用合法可访问网页；拒绝内网/回环/云元数据地址、校验每次重定向和 DNS，限定大小/时间/MIME，不绕过登录或验证码。
- 系统级采集能力与 Web 分开验证；本轮没有原生接入。
- 导出暂定人类可读 Markdown + 结构化 JSON + 经授权参考资料，但未承诺目标工具兼容；在模块 6 实施前确认目标。



## 2026-10-18 演示库与后续功能实现

当前实现优先级依用户决定调整：解析最后验证，后续功能使用旧仓库固定资料。完整范围及数据来源见 [DEMO_WORKSPACE.md](DEMO_WORKSPACE.md)。

- `/api/*` 对应个人 SQLite `data/favtoskill.sqlite`；`/api/demo/*` 对应独立 SQLite `data/demo.sqlite`。首启幂等注入种子；后续修改不被启动覆盖。两者只是本机逻辑隔离，不是多用户权限边界。
- `server/routes.ts` 注册工作区通用接口；`workflows.ts` 处理检索、问答、Skill、整理及提醒；`semantic.ts` 是可选 Embeddings 原文分块索引与缓存。`shared/contracts.ts` 定义共享类型，写入由 Zod 验证。
- 分类、收藏、Skill 使用 JSON 正文与软删除标志；state 记录数据版本；undo 记录事务前快照与完成版本。只能撤回未被后续修改覆盖的操作。整理方案也绑定版本并要求 confirmed，事务失败回滚。
- `provenance` 追踪源仓库、提交、原文件/ID、文本类型；AI 摘要与原始文字分离。Skill 的 origin 区分 preset/template/ai/edited，并保存引用 ID。导出内嵌资料正文，避免只导出本地 ID。
- 规则模式只在演示工作区允许。真实模式统一调用服务端 AI，不使用预设答案兜底。对话成功才保存用户/助手消息；失败保留客户端输入。客户端不接触模型密钥。
- 检索默认对原文分块进行关键词加权，结合分类/单篇上下文；追问结合历史，真实模式可改写问题。配置 AI_EMBEDDING_MODEL 后通过服务端 `/embeddings` 建索引，按端点/模型/标题/原文 hash 缓存，和关键词结果合并。未配置不宣称语义检索。引用只允许检索范围内 ID。
- 模型端点需要 HTTPS（本机127.0.0.1例外），请求有超时；模型输出结构验证、来源校验、外部依赖约束。公开部署之前仍需鉴权、租户隔离、限流、备份和 HTTPS。

### 新增接口（两种前缀相同）

| 方法 / 相对路径 | 行为 |
|---|---|
| POST /categories；PATCH、DELETE /categories/:id | 新增、重命名、确认移除；移除保留内容至待整理 |
| PATCH、DELETE /knowledge/:id | 标题/标签/归类编辑，或确认软删除 |
| POST /undo/:id | 版本检查后恢复最近一次修改 |
| POST /organize/plans | 按 mode、可选 categoryId 产生版本化方案 |
| POST /organize/plans/:id/apply | confirmed + 用户调整的 moves，检查范围/版本后应用 |
| POST /skills/sources；POST /skills/draft | 目标检索、所选资料生成/调整结构化 Skill |
| POST /skills；PATCH、DELETE /skills/:id | 保存、编辑、确认软删除 |
| POST /skills/trial；POST /skills/:id/run | 当前草稿或保存版本文本试运行；外部依赖拒绝执行 |
| GET /skills/:id/export | Markdown 与 JSON bundle（定义、完整引用资料、许可） |
| GET /suggestions；POST /suggestions/:id/dismiss | 有据提醒及持久化关闭 |
| POST /activity | 浏览/使用记录，用于提醒 |
| POST /chat；GET /conversations；GET /conversations/:id/messages | 当前工作区问答、历史及消息 |

前端产物仍可纯静态托管，通过 VITE_API_BASE_URL 连接独立后端。REDcowork 外部 API 能力尚待验证，不把无后端平台视为能安全保存模型密钥。


## 文件夹外观持久化补充

Category新增可空icon/tone字段，由shared/categoryAppearance.ts限定10个图标ID与5个颜色ID。SQLite启动迁移只新增两列，旧分类保持NULL并按名称采用既有样式。POST /categories保存名称及外观，PATCH支持部分更新且不覆盖未提交字段；所有写入沿用事务/版本/撤回。前端categoryAppearance.ts统一供文件夹展示与设置预览使用；不接受任意HTML、SVG代码或颜色字符串。新增集成测试覆盖旧表迁移、非法ID拒绝、改名保留样式、撤回及关库重启后的读取。


## 核心 AI 链路补充（2026-10-18）
- GET health 增加 model / embeddingConfigured，仅返回非敏感配置状态。
- POST /ai/check 向服务商发送最小请求，返回 ok / latencyMs；缺密钥和提供商错误明确失败。
- POST /skills/sources 接收 mode，真实模式合并关键词与可选语义来源并去重。
- POST /skills/draft 可接收 currentDraft 和 conversationId，校验当前草稿引用与会话存在后，将当前草稿、最近6条对话和选定原文传入模型；历史回答不是原始证据。
- 密钥仍仅存在服务端 .env；无浏览器密钥输入或存储。配置验收流程见 AI_SETUP.md。


## 当前本机模型配置（2026-10-18）
使用 DeepSeek OpenAI 兼容 Chat Completions，base=https://api.deepseek.com，model=deepseek-flash。密钥仅存 .env；语义向量未启用，不将聊天模型用于 /embeddings。隔离演示库的核心链路已通过真实调用验证。详见 AI_SETUP.md。


## 分类概览检索补充（2026-10-18）
retrieve 通过限定问句识别当前分类概览（isScopedOverview），在分类范围内读取实际资料，无需依赖“这个分类”等词出现在原文。不对具体无关问题无条件兜底，不跨分类扩展。当前服务只返回最终模型 content，不传输 reasoning_content；前端显示静态真实操作说明而非虚构逐阶段进度。


## 分类摘要与平台展示补充（2026-10-18）
POST /categories/:id/overview 接收mode。真实模式对当前分类（包括unfiled）最多30条原文片段生成短概览，返回overview/mode/sampleCount/totalCount。SQLite state按category_overview_v1+分类存内容指纹缓存，分类名或原文/摘要变化失效；同一Store相同指纹并发去重，失败不缓存。演示模式仅返回mode提示，前端显示资料概览。
Knowledge新增可选demoPlatform，只有演示库一次性迁移赋值，sourcePlatform与provenance保持原始记录。UI通过platformName统一展示，导出保留原始来源和展示字段。


## 单篇资料解析（2026-10-18）
POST /knowledge/:id/analysis 接收mode。real分支校验原文，基于前12000字生成summary和points(title/description)，返回truncated；demo分支返回现有摘要/知识点并标记mode，不调用模型。独立SQLite state knowledge_analysis_v1缓存，原文或标题变化使指纹失效，同Store并发去重，失败不缓存。原始Knowledge资料不覆盖；前端KnowledgeDetail负责封面、原文折叠、生成状态、解析及分类入口。


## 对话内Skill创建（2026-10-19）
- POST /skills/intent 接收最近12条对话、context、mode、可选conversationId。服务端模型返回ready/goal/reply/options；明确目标直接推荐来源，模糊目标澄清。校验最后一条为用户输入，失败不写入；成功后事务保存用户与助手回复并返回conversationId。
- SkillFlow为统一ChatPanel内部的消息/卡片组件，通过ref接收同一composer的输入；不隐藏底部输入，不替换之前的问答消息。引用确认和生成保存分离，试运行继续通过composer发送任务；临时关闭面板保持会话内草稿。
- /skills/draft 支持recordConversation并回传conversationId；生成/调整摘要及引用保存到历史。/skills/trial 同样支持conversationId/recordConversation，执行成功后保存输入输出。历史记录以文字与来源还原，未保存的可编辑草稿不承诺刷新恢复。
- 结构化Skill调用使用JSON对象模式及明确JSON Schema。模型格式不合规时最多一次真实模型修正重试，仍不合规时报错；不回退为固定结果。
- 一个Skill对话固定本次AI模式，避免其他标签切换localStorage造成同一会话中真实/演示模式混用。


## 站外分享演示（2026-10-19）
- 前端 ShareImportDemo 为独立原生 dialog，模拟视频浏览、分享菜单和顶部收录状态。仅复用用户提供包中的两段视频与封面，教程文字由 shared/shareDemo.ts 明确标为预设。
- 仅演示路由：POST /api/demo/imports/demo {fixtureId}；GET /api/demo/imports/demo/:id；POST /api/demo/imports/demo/:id/cancel。个人空间无此接口。
- SQLite demo_import_jobs 持久化任务；服务端定时推进并保存资料，无需页面保持打开或持续轮询。重启注册时恢复未终结任务；非分布式持久队列，适用于当前单进程本地演示。
- receiving→parsing→classifying→saved/failed/cancelled；实际解析内容和初始分类为预设/规则，保存通过现有 Store 事务完成。相同 fixture 正在收录复用任务，已存在按 provenance.originalId 去重。
- 成功返回 knowledgeId/categoryName/undoId，分类修改和撤回复用真实 CRUD/版本保护机制；重复记录不提供撤回旧收藏。原文、摘要及 provenance 明确保留模拟来源，sourceUrl=null，不虚构原帖链接。
- Web 模拟不调用 TikHub、系统分享扩展或 Live Activities；不引入客户端密钥。未来解析供应方可替换任务执行部分，保留接收/状态/保存契约。


## AI整理事务与预览升级（2026-10-19）
OrganizePanel独立组件，原WorkspaceTools保留导出兼容。OrganizePlan追加可选duplicateGroups、categoryMerges、analyzedCount；原duplicates/moves兼容。
- POST /organize/plans：归类建议继续沿用演示规则/真实模型分支；原文/链接相同配对整合为连通分组。空原文且无链接不能算重复。recommendKeepId按收藏时间排序（实际字段recommendedKeepId），只做保留建议。
- 合并仅全库范围生成：分类之间共享至少2组重复内容、覆盖较小分类>=60%，使用非冲突配对。分类/未分类范围的重复组必须全部处于范围内，不建议跨分类合并。
- POST /organize/plans/:id/apply：confirmed:true，moves保留旧契约；新增duplicates:[{groupId,keepId}]、merges:[{sourceId,targetId}]，缺省为空。严格限制为已预览组、方向与记录，拒绝重复选择及过期revision。
- server/organize.ts先校验，单个Store.mutate事务依次更新归类、移动源分类全部资料、软删除源分类、软删除未保留副本，并去重重绑活动Skill引用。原始资料不拼接、不改写；历史消息不改写，旧记录保留在数据库。
- undo快照同时恢复分类/知识/Skill；若已有后续写入，版本保护拒绝撤回。前端对收起副本和合并再次确认，并明确默认不选中。暂无语义相似内容去重或仅凭分类名称的模型合并。


## 默认真实模型与单一消息流（2026-10-19）
- 前后端未指定模式均默认real。前端AI_MODE_KEY为favtoskill-ai-mode-v2，不读取旧favtoskill-demo-mode；仅显式新设置demo启用离线。个人空间仍禁止demo。
- SkillFlow通过onMessage写入ChatPanel的唯一messages列表，不再独立渲染一份消息或提供返回问答按钮，composer提示统一“继续提问…”。conversationId仍沿用。
- POST /assistant/intent：text、stage(goal/sources/draft/trial)、goal、最多8条messages、可选mode；返回intent(chat/skill/trial)。真实模式用服务端模型JSON分类，离线显式模式才规则判断。无数据写入，错误原样返回，不回退模拟。
- SkillFlow输入先识别普通问题/任务补充/试运行。chat分支调用同一/chat并沿用conversationId，展示来源、隐藏任务卡但保存草稿；后续任务输入恢复卡片。Skill目标、引用确认、生成、编辑、文本试运行和显式保存接口保持。
- 移除Skill与对话底部重复模式注脚；全局模式选择/AI服务状态、预设资料来源和模型输出依据仍保留。站外分享预设解析不属于此默认切换，仍明确是模拟。


## Skill详情、ZIP及对话卡片（2026-10-19）
- SkillDetail/SkillEditor拆分详情与编辑；SkillIdentity与skillAppearance复用到结果卡，演示样式按ID稳定散列，不修改原始定义。
- GET /skills/:id/export?format=zip返回application/zip；原无format的JSON响应兼容保留。server/skillArchive.ts用标准ZIP存储格式、UTF-8和CRC32打包SKILL.md、skill.json、references/NNN.md、README、上游LICENSE。无临时文件、密钥和媒体内容；缺失引用仍409。
- ChatTurn为前端Message扩展，card区分question/sources/result。SkillConversationCard在ChatMessage头像气泡位置渲染，历史已确认卡禁用重复提交。问题卡选项与自填草稿在卡内，确认才发送；引用卡同款样式、多选/搜索/增删；结果卡只显示查看详情。
- SkillFlow仅管理任务状态、内部意图及API调度，所有正文/卡片进入ChatPanel同一messages列表。onPatch把已确认过程卡转为静态记录。详情上下文skillId使输入直接引用当前Skill执行；首条任务在创建run流后自动处理。
- /skills POST追加可选requestId UUID：同请求同定义返回已有记录，不重复创建；同请求不同定义409，已移除后不自动恢复。创建映射与Skill写入在同一事务中。前端保存失败重试同份定义，不再生成一次模型草稿。
- 用户确认引用→真实生成→自动保存→结果卡。PATCH调整已有Skill；ZIP导出/编辑在详情，试用仍同一composer。
- 正文按段CSS渐入，模型回复仍先完成并校验来源，再整体到前端；并未实现SSE/token级传输。历史接口继续持久化文本/来源，当前会话交互卡片状态不承诺跨刷新恢复；最终Skill本身已持久化。


## 真实导入及独立向量配置（2026-10-19）
- GET /capabilities：只报告配置/实现边界，无请求密钥、无网络探测；/health.embeddingConfigured 改为校验完整向量配置。
- server/imports.ts：POST /imports/preview 接受 kind=text/title/text 或 kind=link/shareText，预览只存 import_previews，不修改知识库。GET /imports/preview/:id 可重启读取；POST /imports/preview/:id/confirm 接受 categoryId|null，保存+回执+undoId在同一事务中。
- 文本按原文相同去重；TikHub按抖音规范作品地址去重。确认重试返回已保存回执；保存后移除/撤回则409，避免旧请求恢复资料。预览/确认均使用当前workspace Store，禁止跨库读取。
- TikHub固定HTTPS官方主机、Bearer服务端密钥、30秒超时、不跟随重定向；分享输入仅允许抖音作品HTTPS域名/路径。code非200、空data/缺少作品ID或文案、HTTP错误都不写入收藏；不自动重试计费请求。仅映射post_caption，不下载媒体，不声称ASR/OCR已完成。
- 文本与文案完整性均保守设fragment、保留provenance、summary/keyPoints为空，之后由已有AI解析接口生成，禁止把截断文案冒充AI摘要。确认默认未分类，分类由调用方选择，未接入自动分类流水线。
- semantic.ts新增AI_EMBEDDING_API_KEY，异平台不回用AI_API_KEY；校验端点、阈值、索引顺序、零向量、返回维度与缓存维度。缺模型保持关键词检索；配置错误/服务异常明确报错。


## 演示重置与原文更新（2026-10-19）
- server/demoReset.ts：仅demo注册POST /demo/reset（完整地址/api/demo/demo/reset），confirmed=true；在Store.mutate中恢复预设分类/收藏/Skill、轮换未分类项目和平台配色、加重复副本与一个明确模拟的新版本；不修改个人库和.env，保留历史消息；取消尚未完成的模拟分享任务。reset返回undoId，后续写入仍受版本保护。
- server/knowledgeUpdates.ts：POST /knowledge/:id/updates/preview接受kind=text/text或kind=source。后者只支持TikHub导入文案，使用已有原帖URL，作品ID一致才暂存；缺配置不伪造更新。新旧内容暂存knowledge_updates，不立即覆盖原文；暂存提高revision，旧方案拒绝应用。
- 整理plan追加updates，按当前分类范围及beforeText指纹匹配，只显示每条资料最新候选。apply仅接受预览中ID，禁止重复/过期/同时更新被收起的副本。新原文与其他整理同事务写入，清空summary/keyPoints，保守fragment，摘要缓存按内容指纹失效；返回reviewSkillIds，但不自动改写Skill规则。
- undo快照同时包含knowledge_updates，支持撤回更新后恢复候选、撤回重置后恢复原资料与原候选。重置的状态种子标记保留，避免后端重启覆盖用户操作。
- 资料编辑内“补充/更新原文”可以手动暂存，并打开同一整理确认界面；TikHub来源另有“检查原帖文案更新”。没有定时自动抓取、ASR、OCR或语义多文融合。
