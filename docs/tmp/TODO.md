
# Critical Restoration Plan

## 1. System Stability & Docs
- [x] Establish `docs/tmp/TODO.md` to prevent future context loss.
- [x] Create `docs/CHANGELOG.md` with correct date (2025-01-05).
- [x] Verify `IndexedDB` connection.

## 2. Feature Restoration
- [x] **Data Management Module**: Re-implemented `components/DataManager.tsx` and restored routing.
- [x] **Chat Widget**:
    - [x] Restored Drag-and-Drop.
    - [x] Restored History Sidebar.
    - [x] Restored Resizing.
    - [x] Fixed input clearing.
    - [x] Fixed Type Errors in `handleSend`.

## 3. AI Core Fixes (`services/geminiService.ts`)
- [x] **Analysis Session**: 
    - [x] Switched to `generateContent` for Gemini.
    - [x] **CRITICAL**: Restored fallback logic for OpenAI/Anthropic (prevent crash).
- [x] **Structured Outputs**: Fixed `responseSchema` property name.
- [x] **JSON Parsing**: Enhanced `safeParseJSON` robustness.
- [x] **Logic Logic**: Enforced `needs_confirmation` over `ai_recheck` in initial prompt.

## 4. UI/UX
- [x] Ensure "Data Management" appears in the Sidebar.
- [x] Fixed File Upload Bubbling / Double Click issue.
- [ ] Verify Dark Mode consistency.
- [ ] **Next Step**: Optimize Google Drive re-auth flow.
