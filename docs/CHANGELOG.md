
# Changelog

All notable changes to the VerbaFlow project will be documented in this file.

## [0.7.1] - 2025-01-05

### 🐛 Bug Fixes & Logic Improvements (修复与逻辑优化)
- **Upload Stability**:
  - Fixed a critical event bubbling loop in `FileUpload` that required users to click twice or caused the file dialog to fail. Added `e.stopPropagation()` to the file input click handler.
- **Analysis Logic**:
  - **Status State Machine**: Updated `geminiService` system instructions to strictly forbid the AI from generating `ai_recheck` status during the initial pass.
  - **Enforcement**: AI is now explicitly instructed to use `needs_confirmation` for uncertain items, reserving `ai_recheck` solely for user-initiated feedback loops.
- **Type Safety**:
  - Fixed a TypeScript error in `ChatWidget` where `onClick` events were passing an `Event` object instead of a string to `handleSend`.
  - Fixed `ReactMarkdown` component type definitions to safely handle `className` prop strings.

## [0.7.0] - 2025-01-05

### ⚡️ Core Architecture (核心架构)
- **Unified Media Engine (统一媒体引擎)**:
  - Refactored `AnalysisView` to use a **Singleton `<video>` Instance** strategy.
  - **Zero-Latency Switching**: Switching between Video and Audio modes no longer unmounts the media element. Instead, it toggles visibility layers (`z-index`), preserving playback buffer and timestamp state instantly.
  - **PiP Stability**: Picture-in-Picture window now remains active even when switching to Audio/Lyrics mode.
- **Resource Management (资源管理)**:
  - Implemented strict `URL.revokeObjectURL` lifecycle hooks in `App.tsx` to prevent **Memory Leaks** caused by accumulated Blob URLs during file switching.
  - Fixed `input[type="file"]` logic to allow re-uploading the same file immediately after deletion.

### 💄 UI/UX Improvements (交互优化)
- **Control Bar Redesign**:
  - **Segmented Control**: Replaced separate buttons with a unified Toggle Switch for Video/Audio modes.
  - **Context-Aware Controls**: Moved "Lock Scroll" and "Captions" to a floating overlay inside the expanded player, reducing clutter on the main control bar.
  - **Visual Hierarchy**: Improved the layout of playback controls vs. view mode controls.

### 🐛 Bug Fixes (修复)
- Fixed a critical bug where the **first file upload attempt would fail** to generate a preview URL due to stale state checks.
- Fixed video playback freezing when toggling view modes rapidly.
- Fixed CSS layer issues where the lyrics panel would not correctly overlay the video in Audio mode.

## [0.6.2] - 2025-01-05

### 🎨 Branding & UI (品牌升级)
- **Localization**:
  - Renamed "AI Assistant" to **"语流助手" (VerbaFlow Assistant)** in Chinese mode to align with the "AI 语流" brand.
  - Updated Sidebar to display **"AI 语流"** subtitle in Chinese mode.
- **Visuals**:
  - Refined empty state messages (removed trailing periods).
  - Improved chat widget headers for a cleaner look.

## [0.6.1] - 2025-01-05

### 🌐 Internationalization (多语言支持)
- **Standardization**: Updated `LanguageContext` to include missing translation keys for Modals, Drive Selector, and Data Manager.
- **Fixed**: Eliminated mixed English/Chinese UI elements in:
  - `DriveSelectorModal`: File browser interface, error messages, and re-auth prompts.
  - `DataManager`: Clear data confirmation dialogs.
  - `AgentManager`: Delete confirmation dialogs and keyboard shortcuts hints.

## [0.6.0-beta] - 2025-01-05

### 🔄 Critical Restoration (功能回滚与修复)
- **AI Core Stability**:
  - **Fixed**: Corrected `responseJsonSchema` to `responseSchema` for Gemini 1.5/3.0 models (Google GenAI SDK requirement).
  - **Restored**: Re-implemented `AnalysisSession` support for **OpenAI** and **Anthropic**. Previously, selecting these providers caused a crash during analysis because the fallback logic was missing.
  - **Robustness**: Enhanced JSON parsing logic to better handle Markdown code blocks returned by non-structured-output models.

- **Data Management (数据管理)**:
  - Restored `DataManager` component and route.
  - Verified `IndexedDB` implementation in `services/storage.ts` is active and correct.

- **Chat Widget (语流助手)**:
  - Restored draggable, resizable window.
  - Restored session history sidebar and switching logic.
  - Fixed input clearing issue.

### 📝 Documentation
- Added `docs/tmp/TODO.md` for restoration tracking.
- Verified architecture alignment with `docs/ARCHITECTURE.md`.

## [0.5.0] - Previous Stable State
- **Features**:
  - Multi-provider support (Gemini, OpenAI, Anthropic).
  - Project Import/Export (.vfproj).
  - Markdown generation.
  - Video player sync.
