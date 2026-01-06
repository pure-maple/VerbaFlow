
# VerbaFlow 架构设计指南

> **[English Version](./ARCHITECTURE.md)**

VerbaFlow 被设计为一个 **客户端 SPA (单页应用)**。它的核心设计理念是隐私优先、低延迟和离线可用性。

## 1. 系统宏观概览

应用没有后端业务服务器。所有的业务逻辑都在浏览器中执行，所有的数据都存储在用户的设备上。

## 2. 核心服务层：LLM 适配器模式

`services/geminiService.ts` 是系统的核心。尽管文件名保留了 Gemini，但内部已经重构为 **通用聊天适配器 (Universal Chat Adapter)**。

### `UniversalChatSession` 类
该类屏蔽了不同大模型服务商的协议差异。

*   **输入**: 接收标准化的提示词字符串 (Prompt) 和 `isJsonMode`（是否强制 JSON 模式）标志。
*   **输出**: 返回标准化的 Promise<string> (通常是 JSON 字符串)。
*   **内部逻辑**:
    *   **Gemini**: 使用官方 `@google/genai` SDK。
    *   **OpenAI**: 使用原生 `fetch` 请求 `/v1/chat/completions`。通过 `messages` 数组传递 System Prompt。
    *   **Anthropic**: 使用原生 `fetch` 请求 `/v1/messages`。System Prompt 作为顶层参数传递，而非消息历史的一部分。

### 流式响应 (Streaming)
对于长文本生成（如字幕重写、文稿生成），我们使用了独立的函数来处理流式响应：
*   **Gemini**: 使用 SDK 的 `generateContentStream` 异步迭代器。
*   **OpenAI/Anthropic**: 使用 `fetch` 的 `ReadableStream` 并手动解析 SSE (Server-Sent Events) 数据包。

## 3. 数据持久化 (Dexie.js)

我们使用 `Dexie.js` 封装 **IndexedDB**，这使得我们能够存储 `LocalStorage` 无法处理的大型文件（视频/音频 Blob）和复杂对象（项目状态）。

### 数据库设计 (`services/storage.ts`)
1.  **`projects`**: 轻量级元数据，用于在首页列表快速加载。
2.  **`workspace`**: 沉重的 JSON 状态（当前步骤、分析结果、词汇表）。
3.  **`files`**: 二进制 Blob 数据（音频、视频文件）。
4.  **`glossarySets`**: 全局通用的术语库集合。
5.  **`chats`**: AI Agent 的对话历史记录。

## 4. 前端状态与媒体策略

### 4.1 媒体生命周期管理 (v0.7 新增)
为了确保流畅的播放体验并防止内存泄漏，我们在 `App.tsx` 和 `AnalysisView.tsx` 中采用了严格的资源管理策略：

1.  **Blob URL 治理**:
    *   仅当文件状态变更时调用 `URL.createObjectURL`。
    *   **严格清理**: `useEffect` 的 cleanup 函数会显式调用 `URL.revokeObjectURL`。这防止了浏览器内存中 Blob 对象无限堆积（这是造成“内存爆了”的主要原因）。

2.  **统一媒体引擎 (Unified Media Engine)**:
    *   播放器不再根据模式（视频/音频）销毁或重建 DOM 节点。
    *   **单例模式**: 始终渲染一个 `<video>` 标签来处理所有媒体播放。
    *   **视觉逻辑**: 当切换到“音频模式”时，通过 CSS 隐藏视频层，并覆盖歌词/波形层。
    *   **优势**: 实现了 **0 延迟切换**，且完美保留缓冲进度和播放时间点，同时解决了画中画 (PiP) 在切换时意外关闭的问题。

## 5. 状态管理策略

*   **全局配置**: `ConfigContext` 存储 API Key 和服务商选择。这些敏感数据仅保存在 `LocalStorage` 中。
*   **UI 状态**: `LanguageContext` 处理国际化。
*   **项目状态**: 当打开项目时，从 IndexedDB 加载完整状态到 React 组件树 (`App.tsx`)。修改通过防抖 (Debounce) 机制自动保存回 IndexedDB。
