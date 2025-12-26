
# VerbaFlow Architecture Guide

> **[中文说明](#verbaflow-架构设计指南)**

VerbaFlow is designed as a **Client-Side SPA (Single Page Application)**. It prioritizes privacy, low latency, and offline capability.

## 1. System High-Level Overview

```mermaid
graph TD
    User[User] --> UI[React UI Components]
    UI --> Context[Config & Language Context]
    UI --> Service[Gemini Service / LLM Adapter]
    UI --> Storage[Storage Service (Dexie.js)]
    
    Service --> Google[Google Gemini API]
    Service --> OpenAI[OpenAI API]
    Service --> Anthropic[Anthropic API]
    
    Storage --> IDB[(Browser IndexedDB)]
    Storage --> LS[(LocalStorage)]
```

## 2. Core Service Layer: LLM Adapters

The most critical part of the application is `services/geminiService.ts`. Despite the legacy name, it has been refactored into a **Universal Chat Adapter**.

### The `UniversalChatSession` Class
This class abstracts the differences between provider protocols.

*   **Input**: It accepts a standardized prompt string and an optional `isJsonMode` flag.
*   **Output**: It returns a standardized Promise<string> (usually JSON stringified).
*   **Internal Logic**:
    *   **Gemini**: Instantiates `GoogleGenAI` SDK. Uses `chats.sendMessage`.
    *   **OpenAI**: Uses native `fetch` to POST to `/v1/chat/completions`. Handles `response_format: { type: "json_object" }`.
    *   **Anthropic**: Uses native `fetch` to POST to `/v1/messages`. Manages system prompts via top-level parameters (not message history).

### Streaming Strategy
For long-form content generation (Subtitle Rewrite / Markdown generation), we use independent functions (`generatePolishedSubtitle`, `generateFinalTranscript`) that implement provider-specific streaming logic:
*   **Gemini**: `generateContentStream` (Async Iterator).
*   **OpenAI/Anthropic**: `fetch` with `ReadableStream` decoding (Server-Sent Events parsing).

## 3. Data Persistence (Dexie.js)

We use `Dexie.js` to manage **IndexedDB**, which allows storing large blobs (video/audio files) and complex objects (project state) that `LocalStorage` cannot handle.

### Database Schema (`services/storage.ts`)
1.  **`projects`**: Lightweight metadata for the dashboard list.
2.  **`workspace`**: Heavy JSON state (current step, analysis results, vocab list).
3.  **`files`**: Binary Blobs (Audio, Video). *Note: We store these to persist state across reloads, but browsers may evict them if disk space is low.*
4.  **`glossarySets`**: Global terminology sets.
5.  **`chats`**: Agent conversation history.

## 4. State Management

*   **Global Config**: `ConfigContext` stores API Keys and Provider selection. Persisted in `LocalStorage`.
*   **UI State**: `LanguageContext` handles i18n.
*   **Project State**: Loaded from IndexedDB into React Component State (`App.tsx`) when a project is opened. Autosaved back to IndexedDB via a debounced `useEffect`.

---

# VerbaFlow 架构设计指南

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

## 4. 状态管理策略

*   **全局配置**: `ConfigContext` 存储 API Key 和服务商选择。这些敏感数据仅保存在 `LocalStorage` 中。
*   **UI 状态**: `LanguageContext` 处理国际化。
*   **项目状态**: 当打开项目时，从 IndexedDB 加载完整状态到 React 组件树 (`App.tsx`)。修改通过防抖 (Debounce) 机制自动保存回 IndexedDB。
