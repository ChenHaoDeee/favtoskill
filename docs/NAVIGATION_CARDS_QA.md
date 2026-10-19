# 固定顶栏与分类堆叠卡验证

日期：2026-10-18。依据用户提供的首页示意图及最新要求实施；本轮不改变数据与AI业务逻辑。

## 改动

- `src/navigation-cards.css`：顶栏 sticky，top:0、层级20、Safe Area避让；演示说明位于可滚动内容区，导航初始位置与滚动后均为屏幕顶部。手机详情也保留双导航。对话遮罩层级30、原焦点管理和背景锁滚动继续有效。
- `src/components/ContentCards.tsx`：分类卡改为低饱和前景主题图标卡，后方两张真实封面倾斜叠放。空分类使用资料卡占位。主题名称映射图标与色系，所有卡保留文字名称与真实数量。
- `src/components/Icons.tsx`：统一IconPark适配层，按单个组件路径引入，统一currentColor、圆角线条及描边；前景主题使用filled，操作使用outline。全项目移除Lucide依赖和手写通用SVG。
- 文档：用户最新决策在 DESIGN_SYSTEM 与 AGENTS 中覆盖原先Lucide/2×2拼贴建议。
- 官方来源：https://github.com/bytedance/iconpark ，安装 `@icon-park/react@1.4.2`，遵循包内Apache-2.0许可。

## 实测

- 390×844：知识库滚动515px后headerY=0，底部dock位于y=752至844；分类双列，页面没有横向溢出。
- 我的Skill滚动520px后headerY=0，双导航可切换。
- 320×740：内容宽305px（浏览器保留15px滚动条），导航右侧156.95px，操作区左侧201px，无重叠及横向溢出。
- 手机全屏对话top=0、height=844，遮罩z-index=30，高于顶栏；打开焦点在关闭按钮。半屏打开、全屏展开、关闭已操作验证。
- 手机分类详情导航高度48px且headerY=0；分类卡可打开对应内容。
- 1440×900：四列，每列249px，无横向溢出；首页和Skill页滚动时headerY=0。桌面限宽与底部全局AI入口保留。
- 构建包含前后端TypeScript检查与生产产物输出；API集成测试回归4项通过。
- 截图：`artifacts/stack-cards-mobile.png`、`artifacts/stack-cards-desktop.png`。
- 本轮验证为桌面浏览器设备尺寸模拟；真机安全区/系统键盘测试仍沿用原待验收事项。
