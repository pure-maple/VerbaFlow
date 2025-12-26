
# Developer Guide & Contributing

Thank you for your interest in improving VerbaFlow! This guide will help you understand the codebase and how to add new features.

## 📂 Project Structure

```bash
/src
  /components      # UI Components (AnalysisView, FileUpload, ChatWidget, etc.)
  /contexts        # React Contexts (Config, Language)
  /services        # Core Logic
    geminiService.ts  # LLM Integration (Adapter Pattern)
    storage.ts        # IndexedDB Wrapper (Dexie)
    googleDriveService.ts # Client-side Drive API
  /utils           # Helpers (SRT Parsing, Time Formatting)
  /types.ts        # TypeScript Interfaces
  App.tsx          # Main Application Controller
```

## 🛠️ Common Tasks

### 1. Adding a New LLM Provider

To add a new provider (e.g., Mistral, Groq, or a local Ollama instance):

1.  **Update Configuration Types**:
    *   In `src/contexts/ConfigContext.tsx`, add the provider name to the `LLMProvider` type definition.
    *   Add the provider option to the dropdown in `src/App.tsx` (inside `SettingsModal`).

2.  **Implement the Protocol**:
    *   Open `src/services/geminiService.ts`.
    *   Update `resolveBaseUrl` to provide a default endpoint for your provider.
    *   In `UniversalChatSession.sendMessage`, add a new `if` block for your provider.
    *   Implement the API call using `fetch`. Ensure you handle the specific JSON structure of the provider's request/response.

3.  **Implement Streaming (Optional but Recommended)**:
    *   In `geminiService.ts`, update `generatePolishedSubtitle` and `generateFinalTranscript`.
    *   Create a specific stream handler (e.g., `streamOllama`) if the SSE format differs from OpenAI/Anthropic.

### 2. Adding Support for a New Subtitle Format

Currently, VerbaFlow supports SRT, VTT, ASS, and JSON. To add another format (e.g., TTML):

1.  **Parser Logic**:
    *   Open `src/utils/srtParser.ts`.
    *   Create a `parseTTML` function that converts the string content into `SubtitleItem[]` array.
    *   Update `detectSubtitleFormat` to recognize the file signature.
    *   Update `parseSubtitleToObjects` switch case.

### 3. Styling & UI

*   We use **Tailwind CSS**.
*   **Dark Mode**: We use the `dark:` prefix. Ensure any new component supports both light and dark modes.
*   **Icons**: Use `lucide-react`.

## 🧪 Development Workflow

1.  Start the dev server: `npm start`
2.  The app runs on `http://localhost:1234` (Parcel default).
3.  Changes are hot-reloaded.

## ⚠️ Important Notes

*   **No Backend**: Do not introduce server-side dependencies (Node.js/Express) unless you are forking this into a full-stack app. VerbaFlow is designed to be static-hostable.
*   **Type Safety**: Keep `types.ts` updated. Avoid using `any` unless dealing with external untyped libraries (like parts of the Google Picker API).

Happy Coding!
