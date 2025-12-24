# VerbaFlow - AI Terminology & Transcript Suite

> **[中文文档 (Chinese Documentation)](./README_zh.md)**

VerbaFlow is a professional-grade tool designed for audio/video content creators, translators, and proofreaders. It leverages Google's Gemini models to ensure 100% content integrity while providing powerful terminology management, automated proofreading, and glossary consistency capabilities.

![VerbaFlow Interface](https://via.placeholder.com/800x450?text=VerbaFlow+Studio+Interface)

## Key Features

### 1. 🎧 Studio & Smart Analysis
*   **Multi-Format Support**: Upload Audio (MP3, WAV) or Video (MP4, MOV).
*   **Deep Analysis**: Automatically extracts proper nouns, technical terms, and checks for inconsistencies.
*   **Summary Generation**: Auto-generates content summaries, speaker lists, and meeting agendas.
*   **Video Preview**: Integrated video player with subtitle sync, allowing you to click subtitles to jump to specific video frames.

### 2. 📚 Knowledge Base (Glossary Manager)
*   **Contextual Extraction**: AI analyzes your transcripts to define terms based on specific contexts.
*   **Smart Export**: Extract professional glossaries from your current work session automatically.
*   **Re-analysis Loop**: Feed your curated glossary back into the AI to re-check transcripts for strict terminology consistency.
*   **Drive Integration**: Sync your glossaries to Google Drive (Mock integration).

### 3. ✍️ Human-in-the-loop Review
*   **Interactive Table**: Review AI suggestions side-by-side with original text.
*   **Precision Control**: Click any term to play the corresponding audio/video segment.
*   **Custom Status**: Mark items as "Verified", "Needs Confirmation", or add custom status tags.
*   **AI Instructions**: Provide extra context (e.g., "Speaker has a British accent") for better re-analysis.

### 4. 📤 Dual Output Generation
*   **Polished SRT**: Generates a corrected subtitle file while **strictly maintaining original timestamps**.
*   **Markdown Transcript**: Generates a clean, article-style script suitable for blog posts or documentation.

### 5. 🤖 AI Agent Assistant
*   **Context-Aware Chat**: A floating AI assistant that understands your current proofreading context.
*   **Session Management**: Auto-naming chat sessions, history management, and manual renaming.
*   **Model Selection**: Switch between Gemini Flash (Speed) and Gemini Pro (Reasoning) on the fly.

## Tech Stack

*   **Frontend**: React 19, TypeScript, Tailwind CSS
*   **AI Engine**: Google GenAI SDK (Gemini 1.5 / 2.0 / 3.0 Models)
*   **Icons**: Lucide React
*   **Parsing**: Custom SRT parser and Markdown rendering

## Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/verbaflow.git
    cd verbaflow
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure API Key**
    Set your Google Gemini API Key in your environment variables.
    ```bash
    export API_KEY="your_google_api_key_here"
    ```

4.  **Run the development server**
    ```bash
    npm start
    ```

## License

MIT
