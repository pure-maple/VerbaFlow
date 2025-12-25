
# VerbaFlow Architecture & Design Guide

> [中文说明](#verbaflow-架构与设计指南)

## System Overview

VerbaFlow is a client-side React application that leverages the Google Gemini API for intelligent text processing. It focuses on privacy and data ownership by storing business logic data in IndexedDB and configuration in LocalStorage.

### Core Technologies
*   **State Management**: React Context (`ConfigContext`, `LanguageContext`) for global settings; Component state for UI flow.
*   **Storage**: `services/storage.ts` wraps `IndexedDB` for robust offline storage of large objects (transcripts, chat history, glossaries).
*   **AI Integration**: `services/geminiService.ts` acts as the interface layer for Google GenAI SDK.

---

## Agent & Chat Architecture

Currently, VerbaFlow uses a **Session-Based Agent** model. This is designed to support future expansion into a Multi-Agent system.

### Current Implementation
The `ChatWidget` component manages a list of `ChatSession` objects.
*   **Isolation**: Each chat session is an independent context window. The AI does not "remember" what was said in Session A when you are in Session B.
*   **Context Injection**: When a user clicks "Ask Agent" in the analysis view, the app creates a *new* session (or appends to active) and programmatically injects the specific subtitle/term context as the prompt.

### Multi-Agent Strategy (Future Roadmap)
To support specialized roles (e.g., "Translator", "Grammar Nazi", "Term Manager"), we recommend the following pattern without needing a complex backend:

1.  **Session Tagging**: Add a `type` or `persona` field to the `ChatSession` interface.
    ```typescript
    interface ChatSession {
      id: string;
      type: 'general' | 'translator' | 'reviewer'; // Discriminator
      ...
    }
    ```
2.  **System Instruction Injection**: When creating a new session, inject a specific `systemInstruction` based on the persona.
    *   *Translator Persona*: "You are a specialized translator. Focus on nuance and tone..."
    *   *Reviewer Persona*: "You are a strict proofreader. Only point out objective errors..."
3.  **UI Separation**: In the `ChatWidget` sidebar, group sessions by their `type` or Persona.

---

## Glossary Logic

### Smart Extraction Flow
1.  **Trigger**: User clicks "Smart Extraction" in Glossary Manager.
2.  **Input**: The raw SRT content + current Vocabulary Analysis results.
3.  **AI Process**: Gemini analyzes the content to extract proper nouns and technical terms, providing context-specific definitions.
4.  **Confirmation (Modal)**: The user chooses to:
    *   **Create New**: Saves as a timestamped new Glossary Set.
    *   **Append**: Merges new terms into an existing set (deduplicating by term name).

### Terminology Consistency
During the `ANALYSIS` phase (Step 2), the system feeds *all* items from *all* Glossary Sets into the prompt context. This ensures the AI respects your established terminology library across different files.

---

## Data Privacy & Storage

*   **API Keys**: Stored in `LocalStorage`. They are never sent to any server other than Google's API endpoints.
*   **Business Data**: Transcripts, edits, and glossaries are stored in `IndexedDB`.
*   **Cloud Sync**: Google Drive integration is purely client-side via the Drive API. VerbaFlow does not have a backend server that sees your data.

---

# VerbaFlow 架构与设计指南

## 系统概览

VerbaFlow 是一个纯前端的 React 应用，利用 Google Gemini API 进行智能文本处理。应用强调隐私和数据所有权，将业务逻辑数据存储在 IndexedDB 中，配置信息存储在 LocalStorage 中。

### 核心技术
*   **状态管理**: React Context (`ConfigContext`, `LanguageContext`) 用于全局设置；组件级 State 用于 UI 流程。
*   **存储层**: `services/storage.ts` 封装了 `IndexedDB`，用于稳健地离线存储大对象（文稿、聊天记录、术语库）。
*   **AI 集成**: `services/geminiService.ts` 作为 Google GenAI SDK 的接口层。

---

## Agent 与聊天架构

目前，VerbaFlow 采用**基于会话 (Session-Based)** 的 Agent 模型。这一设计旨在为未来扩展到多 Agent 系统打下基础。

### 当前实现
`ChatWidget` 组件管理着一个 `ChatSession` 对象列表。
*   **隔离性**: 每个聊天会话都是独立的上下文窗口。AI 不会“记得”你在会话 A 中说过的话（当你处于会话 B 时）。
*   **上下文注入**: 当用户在分析视图点击“询问 Agent”时，应用会创建一个*新*会话（或追加到当前会话），并以编程方式将特定的字幕/术语上下文注入到提示词中。

### 多 Agent 策略 (未来路线图)
为了支持特定角色（如“翻译专家”、“语法检查员”、“术语管理员”），我们建议在无需复杂后端的情况下采用以下模式：

1.  **会话标记**: 在 `ChatSession` 接口中增加 `type` 或 `persona` 字段。
    ```typescript
    interface ChatSession {
      id: string;
      type: 'general' | 'translator' | 'reviewer'; // 区分器
      ...
    }
    ```
2.  **系统指令注入**: 创建新会话时，根据角色注入特定的 `systemInstruction`。
    *   *翻译角色*: "你是一位专业的翻译家。专注于细微差别和语气..."
    *   *复核角色*: "你是一位严格的校对员。只指出客观错误..."
3.  **UI 分组**: 在 `ChatWidget` 侧边栏中，根据 `type` 或角色对会话进行分组显示。

---

## 术语库逻辑

### 智能提取流程
1.  **触发**: 用户在术语管理界面点击“智能提取”。
2.  **输入**: 原始 SRT 内容 + 当前的词汇分析结果。
3.  **AI 处理**: Gemini 分析内容，提取专有名词和技术术语，并提供基于上下文的定义。
4.  **确认 (模态框)**: 用户选择：
    *   **新建库**: 保存为带时间戳的新术语库。
    *   **追加**: 将新术语合并到现有的库中（按术语名称去重）。

### 术语一致性
在 `ANALYSIS`（分析）阶段（第2步），系统会将*所有*术语库中的*所有*条目注入到 Prompt 上下文中。这确保了 AI 在处理不同文件时能够遵守您已建立的术语标准。

---

## 数据隐私与存储

*   **API Keys**: 存储在 `LocalStorage` 中。除了 Google 的 API 端点外，它们不会被发送到任何服务器。
*   **业务数据**: 文稿、修改记录和术语库存储在 `IndexedDB` 中。
*   **云同步**: Google Drive 集成纯粹通过客户端 Drive API 实现。VerbaFlow 没有后端服务器来查看您的数据。
