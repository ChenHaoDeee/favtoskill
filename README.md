# favtoskill · 藏点本事

<img src="public/brand/app-icon-192.png" width="96" alt="藏点本事 App Logo" />

> 当前为本地单用户笔试演示原型，可用于源码交付与本机演示。正式上线、原生分享与真实平台采集的限制见下文及后端说明。

从社交收藏到知识应用的 AI 原生产品。当前已提供独立演示库及知识管理、对话、整理、Skill 流程，后续进度见 [TASKS](docs/TASKS.md)。

## 本地运行（PowerShell）
需要 Node.js 22.13+，推荐 Node 24。
```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```
已有 .env 时请保留配置，不重复覆盖。打开 http://127.0.0.1:5173 ，API 为 http://127.0.0.1:3001/api/health。

在 `.env` 设置 `AI_API_KEY`、`AI_MODEL`、`AI_BASE_URL` 后重启后端，启用服务端真实 Chat Completions 调用。默认供应商地址为 https://api.openai.com/v1；模型需要账号实际有权使用。无密钥返回明确的 503，不生成假结果。密钥只存在服务端；不要提交 .env。

```powershell
npm run typecheck
npm test
npm run build
npm run start:api
```
最后一条运行编译后的 API。`dist/` 为可静态部署前端，开发中用 Vite `/api` 代理；分离部署时构建前配置 `VITE_API_BASE_URL` 为后端 HTTPS 根地址，并在后端 `WEB_ORIGIN` 填入前端来源（逗号分隔）。REDcowork 的具体网络权限仍需验证。

## 演示入口

打开 http://127.0.0.1:5173/?workspace=demo#knowledge ，载入旧 GitHub 项目的7分类、36条收藏、35张封面、18个预设 Skill。演示库独立保存在 `data/demo.sqlite`，修改、对话及新建 Skill 可持久化，原个人库保持独立。

演示库默认使用真实 AI，没有模型密钥时明确报错；顶栏服务设置可显式切换离线演示，结果标注未调用模型。知识管理、资料检索、整理预览、Skill 创建和导出使用真实持久化数据。向量检索可单独配置，未配置时使用关键词检索。

顶栏导入入口仍提供抖音分享模拟演示；真实文本导入和 TikHub 抖音文案导入已提供后端预览/确认接口，接入说明见 [BACKEND_STATUS](docs/BACKEND_STATUS.md)。真实接口不与模拟结果混用，尚未接入该顶栏界面。

数据来源、许可、完整操作路径、实现边界及验证记录见 [DEMO_WORKSPACE](docs/DEMO_WORKSPACE.md)。

本地 SQLite 在 `data/favtoskill.sqlite`。当前仅本机单用户，无鉴权，不可直接公网暴露；正式部署前完成隔离、限流、备份与 HTTPS。

文档：[PRD](docs/PRD.md) · [架构/API](docs/ARCHITECTURE.md) · [计划/验收](docs/TASKS.md)。

## 设计依据

[视觉语言规范 V1.0](docs/DESIGN_SYSTEM.md) 为用户提供的 FavToSkill（藏点本事）设计系统，后续品牌、页面和组件设计以此为参考。规范正文完整保留，统一了 Markdown 标题层级；色值、Design Tokens、组件规则和推荐文案未改动。

当前界面已按青柠绿视觉体系收敛：首页分类、分类详情、Skill列表/详情及对话。涉及功能和导航的调整继续以 PRD 及用户已确认决策为准。



## 真实模型使用
首页 / Skill 列表顶部「AI 连接」可查看配置并检测实际连接；服务端填写 `.env` 后重启 API，演示库切换「真实 AI」。完整配置与核心流程验收见 [AI_SETUP](docs/AI_SETUP.md)。本机已配置 DeepSeek 并完成隔离演示库的在线核心流程验证。密钥仅存于被 Git 忽略的 .env，分发代码时需由使用者自行配置。


## 站外收藏分享演示
启动 `npm run dev` 后打开 http://127.0.0.1:5173/?workspace=demo#share-demo ，或点击首页右上角「导入知识」。
在模拟抖音页面点击「分享」→「藏点本事」，顶部显示接收、解析及归类结果。期间可继续浏览；完成后可查看详情、改分类或撤回。
封面复用用户提供的接着演 Demo；演示视频尚未完成，GitHub及源码包不含MP4，缺失视频时展示封面；文字与初始归类为预设，系统分享与灵动岛为 Web 模拟；收录结果实际保存至独立演示库。真实模型配置不影响此模拟链路。


## Skill创建与使用
同一AI对话内：说明任务→方向问题卡选择/自填并确定（目标明确时跳过）→确认引用→生成并自动保存→结果卡查看详情。详情支持编辑、删除、完整规则与关联收藏，底部对话可尝试当前Skill。
主按钮“导出Skill”下载一个ZIP，包含可读SKILL.md、结构化skill.json、参考原文及许可；不包含图片/视频或密钥，外部平台兼容性需分别验证。


后端能力现状、剩余工作、无密钥运行方式及导入接口示例见 [BACKEND_STATUS](docs/BACKEND_STATUS.md)。服务配置检查：`GET /api/capabilities`（演示库 `/api/demo/capabilities`），只报告配置状态，不进行付费探测。
