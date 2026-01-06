
# VerbaFlow UI/UX 设计规范 (Design System)

本文档旨在统一 **VerbaFlow (AI 语流)** 的设计语言，确保产品在迭代过程中保持视觉一致性、专业感和良好的用户体验。

## 1. 设计哲学 (Design Philosophy)

*   **Flow (心流)**：界面应尽量减少干扰，让用户专注于“校对”和“阅读”本身。操作路径应顺滑流畅。
*   **Data-Dense (高密度)**：作为生产力工具，应在保持清晰的前提下，高效展示表格、文本和日志信息，避免过大的留白浪费屏幕空间。
*   **Native Feel (原生感)**：虽然是 Web 应用，但交互反馈（如拖拽、快捷键、模态框）应接近原生桌面应用的体验。

---

## 2. 色彩系统 (Color Palette)

我们使用 Tailwind CSS 的默认色板作为基础，构建语义化色彩系统。支持 **浅色 (Light)** 和 **深色 (Dark)** 模式。

### 2.1 主色调 (Primary) - Indigo
代表智慧、科技与 AI。用于主按钮、激活状态、高亮图标。

| Token | Light (Tailwind) | Dark (Tailwind) | 用途 |
| :--- | :--- | :--- | :--- |
| `primary-bg` | `bg-indigo-600` | `bg-indigo-600` | 主操作按钮 |
| `primary-hover` | `bg-indigo-700` | `bg-indigo-500` | 悬停状态 |
| `primary-light` | `bg-indigo-50` | `bg-indigo-900/30` | 选中项背景、标签背景 |
| `primary-text` | `text-indigo-600` | `text-indigo-400` | 链接、强调文字 |

### 2.2 中性色 (Neutral) - Slate
代表专业、冷静。用于背景、边框、普通文本。

| Token | Light | Dark | 用途 |
| :--- | :--- | :--- | :--- |
| `bg-base` | `bg-slate-50` | `bg-slate-950` | 应用背景 |
| `bg-surface` | `bg-white` | `bg-slate-900` | 卡片、侧边栏、面板背景 |
| `border-base` | `border-slate-200` | `border-slate-700` | 分割线、边框 |
| `text-main` | `text-slate-800` | `text-slate-100` | 标题、正文 |
| `text-muted` | `text-slate-500` | `text-slate-400` | 次要信息、元数据 |

### 2.3 功能色 (Functional)

*   **Success (Green)**: `text-emerald-600` / `bg-emerald-50`. 用于“已完成”、“保存成功”。
*   **Warning (Amber)**: `text-amber-600` / `bg-amber-50`. 用于“需确认”、“未配置 Key”。
*   **Danger (Red)**: `text-red-600` / `bg-red-50`. 用于“删除”、“错误提示”。

---

## 3. 排版 (Typography)

*   **字体族**: 系统默认 Sans-serif (Inter, San Francisco, Segoe UI)。
*   **等宽字体**: 用于时间轴 (00:00:12)、JSON 代码块、日志输出。使用 `font-mono`。

### 字号阶梯
*   **Heading 1**: `text-2xl font-bold` (页面标题)
*   **Heading 2**: `text-xl font-bold` (模块标题)
*   **Heading 3**: `text-lg font-semibold` (卡片标题)
*   **Body**: `text-sm` (默认正文，生产力工具倾向于使用较小的字号以展示更多内容)
*   **Caption**: `text-xs` (说明文字、标签)

---

## 4. 组件规范 (Components)

### 4.1 按钮 (Buttons)
所有按钮应有清晰的 `hover` 和 `active` (scale-95) 状态反馈。

*   **Primary**: 实心 Indigo 背景，白色文字，圆角 `rounded-lg`。
*   **Secondary**: 白色/Slate-800 背景，带边框，Slate 文字。
*   **Ghost**: 透明背景，仅在 Hover 时显示背景色。用于图标按钮。

```jsx
// Example
<button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
  Action
</button>
```

### 4.2 卡片 (Cards)
用于包裹内容块。
*   **Style**: `bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm`.
*   **Interactive**: 如果卡片可点击，Hover 时应加深阴影或边框颜色。

### 4.3 模态框 (Modals)
*   **遮罩**: `bg-black/50 backdrop-blur-sm`.
*   **容器**: 居中，`max-w-md` 或 `max-w-2xl`，圆角 `rounded-xl`。
*   **动画**: `animate-in fade-in zoom-in-95`。

### 4.4 列表项 (List Items)
*   **状态**: 支持 `Hover` 背景变色。
*   **操作**: 操作按钮（编辑、删除）在 Hover 时才显示 (`group-hover:opacity-100`)，以保持界面整洁。

---

## 5. 布局模式 (Layout Patterns)

### 5.1 全局布局
*   **侧边栏 (Sidebar)**: 左侧固定，支持折叠 (Collapsed)。宽度 `w-64` -> `w-20`。
*   **顶栏 (Header)**: 在具体工作区内显示，包含面包屑、标题和主要操作区。
*   **内容区 (Main)**: `flex-1 overflow-hidden`，内部滚动。

### 5.2 智能工坊 (Studio)
*   **分步导航**: 顶部显示 Step Indicator。
*   **双栏模式**: 
    *   左/上：多媒体播放器 (Sticky)。
    *   右/下：校对表格或文稿 (Scrollable)。

### 5.3 语流助手 (Chat Widget)
*   **悬浮球**: 固定在右下角，支持拖拽。
*   **窗口**: 弹出式，支持 Resize，内部包含“历史侧栏”和“对话区”。

### 5.4 播放器交互 (Media Player Controls) - New in v0.7
为了减少认知负荷，播放器控制分为两级：

1.  **持久控制栏 (Persistent Bar)**:
    *   位于播放器底部，始终可见。
    *   仅包含**全局通用**操作：播放/暂停、进度条、音视频模式切换、窗口展开/收起。
    *   **音视频切换**：使用分段式开关 (Segmented Control)，明确当前状态。

2.  **上下文悬浮层 (Contextual Overlay)**:
    *   位于视频画面或歌词面板内部右下角。
    *   包含**体验增强**操作：字幕开关、自动滚动锁定 (Lock Scroll)。
    *   设计意图：这些功能只在用户关注内容时才需要，避免占用主控制栏空间。

---

## 6. 交互细节 (Interaction)

### 6.1 沉浸式导航 (Immersive Navigation)
为了最大化工作区并保持界面整洁，侧边栏支持“自动隐藏”与“智能唤醒”模式。

*   **热区感应 (Hot Zone)**：
    *   在左侧边缘设置 **24px** 宽的隐形感应区。
    *   当鼠标进入该区域时，显示 **“流光毛玻璃 (Luminous Glass)”** 视觉暗示，提示用户侧边栏即将展开。
*   **延时展开 (Delay Reveal)**：
    *   用户需在热区停留 **600ms** 才会触发侧边栏完全展开，防止误触。
    *   展开过程使用 `transition-all duration-300 ease-in-out` 动画。
*   **平滑推移 (Smooth Push)**：
    *   当侧边栏以“悬浮唤醒”模式展开时，主内容区域会同步向右平移 (**Margin Push**)，而非被侧边栏覆盖。
    *   当鼠标离开侧边栏区域后，侧边栏收起，主内容区域同步向左回弹，填补空白。
    *   这种设计增强了界面的空间连续性。

### 6.2 其他反馈
*   **Loading**: 
    *   页面级加载使用全屏 Spinner。
    *   局部加载（如 AI 生成中）使用骨架屏 (Skeleton) 或按钮内的 Spinner。
*   **Toast**: 操作结果反馈（成功/失败）使用右下角 Toast，3秒自动消失。
*   **空状态 (Empty States)**: 列表为空时，必须显示图标 + 提示文案 + 引导按钮（如“暂无项目，点击新建”），且**文案末尾不加句号**。

## 7. 图标使用 (Icons)
统一使用 `lucide-react`。
*   常规尺寸: `size={16}` (按钮内), `size={20}` (导航/标题).
*   线宽: 默认 `stroke-width="2"`.
