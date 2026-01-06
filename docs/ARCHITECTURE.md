
# VerbaFlow Architecture Guide

> **[中文说明 (Chinese Version)](./ARCHITECTURE_zh.md)**

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

## 4. Frontend State Strategy

### 4.1 Global Config
*   **ConfigContext**: Stores API Keys and Provider selection. Persisted in `LocalStorage`.
*   **LanguageContext**: Handles i18n switching.

### 4.2 Media Lifecycle Management (New in v0.7)
To ensure smooth playback and prevent memory leaks, we employ a strict resource management strategy in `App.tsx` and `AnalysisView.tsx`:

1.  **Blob URL Management**:
    *   `URL.createObjectURL` is called *only* when file state changes in `App.tsx`.
    *   **Strict Cleanup**: A `useEffect` cleanup function explicitly calls `URL.revokeObjectURL` whenever the file changes or the component unmounts. This prevents the browser's Blob registry from growing indefinitely.

2.  **Unified Media Engine (Singleton Pattern)**:
    *   The player does **not** conditionally render `<video>` vs `<audio>` tags based on view mode.
    *   **Single Element**: A single `<video>` element handles both video and audio playback.
    *   **Visual Logic**: When in "Audio Mode", the video element is visually hidden (opacity/z-index), and a "Lyrics/Visualization" layer is superimposed.
    *   **Benefit**: This allows instant switching between modes without reloading the media stream, preserving buffering and playback position perfectly.

## 5. State Management

*   **Project State**: Loaded from IndexedDB into React Component State (`App.tsx`) when a project is opened. Autosaved back to IndexedDB via a debounced `useEffect`.
