# 响应式优化与验证

日期：2026-10-18。基于现有产品修改，不改变双页面导航或全局 AI 创建流程。

## 检查发现
- 原样式以桌面为基础，用 max-width 缩小手机界面，部分文字为 8–11px。
- 图标按钮 32px、发送按钮 33px，触控范围偏小。
- 底部固定栏无 Safe Area；页面预留高度与底部栏缺少统一约定。
- 对话存在固定最小高度 400px，只锁 overflow，键盘/短视口时容易挤出可视区域；iOS 背景滚动和返回位置缺少处理。
- 输入字体不足 16px，存在 iOS 聚焦自动缩放风险。

## 修改
- styles.css 改为 Mobile First 基础样式；768px 扩展平板/宽屏布局，1100px 扩展大屏横幅与三列卡片。
- 手机基准 390 × 844；20px 页面边距，正文/说明按 12–16px 层级，标题 24–28px；主要按钮、导航、搜索、发送和工具按钮触控高度至少 44px。
- 搜索与对话输入使用 16px；移动端筛选和搜索上下排列，分类允许横向滚动；卡片一列，宽屏两列/三列，长内容自动换行。
- PC 内容区上限 1200px；横幅左右布局；AI 入口上限 720px，半屏面板上限 920px，全屏上限 1040px。
- viewport-fit=cover；顶部/左右/底部使用 env(safe-area-inset-*)；底部栏、页面末尾预留、toast 共用 --dock-space。
- useVisualViewport 监听可视区域 resize/scroll、窗口 resize、输入焦点，更新面板高度/顶部偏移；无该 API 时回退 innerHeight/dvh。键盘判断是布局辅助启发式，不作为产品逻辑。
- 关闭状态的 AI 栏在其他输入弹键盘时隐藏；对话打开时隐藏底部重复入口，将背景设为 inert；消息区独立滚动，footer 支持极短视口滚动。
- 打开对话用 fixed-body 锁背景，关闭恢复滚动位置；半屏/全屏切换不会重新锁页面；打开聚焦关闭按钮，关闭回到入口且 preventScroll。
- 不再依赖外部字体请求。

实现参考：[MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)、[MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)。

## 浏览器验证矩阵
通过应用内浏览器设置明确的 CSS 视口并检查实际 DOM 几何和截图。Windows 桌面滚动条占用约 15px；表中的名义视口仍为请求尺寸，没有隐藏真实溢出。

| 场景 | 检查 | 结果 |
|---|---|---|
| 390 × 844 知识库 | 顶部双导航、标题、采集、横幅、搜索与 AI 栏 | 通过；clientWidth=375、scrollWidth=375，无横向溢出 |
| 390 × 844 Skill | 介绍卡片、筛选、搜索、底部入口、统一新建面板 | 通过；无横向溢出 |
| 390 × 844 触控区域 | 可见按钮/导航/搜索测量 | 主按钮及工具最小 44px；AI 入口 64px |
| 手机半屏 | 面板/输入框/发送按钮可见，默认不聚焦输入 | 面板 y≈304，h≈540；footer 底部≈843，关闭按钮获得焦点 |
| 手机全屏 | 主动展开、保持内容、可关闭 | 通过 |
| 390 × 480 可视区域缩小模拟 | 输入聚焦后缩小视口，模拟键盘占位 | 面板高度 480，composer 底部 471，发送可用；错误/重试保留输入 |
| 页面滚动到底部 | 页尾不能被固定 AI 栏遮盖 | footer 底部≈708，AI 栏顶部734，有26px间隔 |
| 滚动后打开/关闭 | 恢复阅读位置、背景不可滚动 | 关闭后 scrollY=389.5，与打开前一致；body.position 恢复 |
| 1440 × 900 PC | 横幅左右布局、上限宽度、无横向溢出 | 主内容1200px；入口独立限宽；通过 |
| PC 半屏/全屏 | 尺寸与输入区域 | 半屏920×540，全屏1040×876，均在900px可视区内 |
| 844 × 390 横屏 | 面板、输入和发送不越界 | full面板顶部24、底部390；composer底部377，正常可操作 |
| 320 × 640 较窄手机 | 页面与面板头部无溢出 | 修复 body min-width 后 clientWidth=scrollWidth=305；header 无溢出 |

## 自动检查
- `npm run build`：前后端 TypeScript 与 Vite 生产构建通过。
- `npm test`：现有 API 集成测试通过，未改动 AI 或后端业务逻辑。

## 验证边界
本轮为桌面浏览器的手机尺寸测试与缩小可视区域模拟；并非真实 iOS Safari / Android Chrome 键盘测试。Safe Area 已按标准接入，但桌面环境的 env 值为 0，带刘海/手势区域的设备及系统浏览器工具栏伸缩仍需真机验证。当前数据库为空，卡片网格已实现断点，但真实多卡片/长对话数据需要后续模块联调再验收。

截图位于 artifacts/（忽略版本控制）：responsive-mobile-skills.png、responsive-mobile-scrolled.png、responsive-keyboard-480.png、responsive-desktop.png，以及 responsive-mobile-knowledge.png、responsive-mobile-chat.png。
