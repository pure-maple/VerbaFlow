
# VerbaFlow - AI Terminology & Transcript Suite

> **[中文文档 (Chinese Documentation)](./README_zh.md)**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Gemini](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI%20%7C%20Anthropic-orange)

VerbaFlow is a professional-grade, privacy-focused linguistic studio designed for audio/video content creators, translators, and proofreaders. 

Unlike cloud-based SaaS platforms, **VerbaFlow runs entirely in your browser**. It leverages powerful LLMs (Google Gemini, OpenAI, Anthropic) to ensure content integrity while providing workflow-specific tools for terminology management, automated proofreading, and subtitle synchronization.

![VerbaFlow Interface](https://via.placeholder.com/800x450?text=VerbaFlow+Studio+Interface)

## 🌟 Key Features

### 1. 🤖 Multi-Provider AI Support
*   **Gemini (Native Multimodal)**: Best for direct video/audio analysis and large context windows.
*   **OpenAI / Anthropic**: Support for GPT-4o, Claude 3.5 Sonnet via standard protocols for high-precision text proofreading.
*   **Flexible Config**: Switch models and providers on the fly based on your task requirements.

### 2. 🎧 Intelligent Studio
*   **Visual Proofreading**: Review AI suggestions side-by-side with the original transcript.
*   **Context-Aware**: The AI understands the context of the entire video/audio to make accurate corrections.
*   **Media Sync**: Click any subtitle line or term to instantly jump to that timestamp in the video/audio player.

### 3. 📚 Knowledge Base (Glossary)
*   **Smart Extraction**: Automatically extract proper nouns, technical terms, and entities from your content.
*   **Consistency Loop**: Extracted terms are saved to Glossary Sets, which are then fed back into the AI for future analysis, ensuring strict terminology consistency across projects.
*   **Import/Export**: Support for JSON, CSV, and text format migration.

### 4. 🔒 Privacy & Local-First
*   **IndexedDB Storage**: All projects, transcripts, and chat history are stored in your browser's local database (`Dexie.js`).
*   **No Backend**: We do not have a server. Your API Keys are saved in `LocalStorage` and sent directly to the LLM providers.
*   **Data Ownership**: You own your data. Export projects as `.vfproj` files for backup or sharing.

### 5. 📤 Production-Ready Output
*   **Polished SRT**: Generates corrected subtitle files while **strictly maintaining original timestamps** and formatting.
*   **Markdown Transcript**: Converts subtitles into readable articles/blogs with speaker separation.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   An API Key from one of the supported providers:
    *   [Google AI Studio (Gemini)](https://aistudio.google.com/)
    *   [OpenAI Platform](https://platform.openai.com/)
    *   [Anthropic Console](https://console.anthropic.com/)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/verbaflow.git
    cd verbaflow
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm start
    ```

4.  **Configure the App**
    *   Open http://localhost:1234
    *   Click the **Settings (Gear Icon)** in the sidebar.
    *   Select your provider (e.g., Gemini).
    *   Paste your API Key.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Tailwind CSS
*   **State/Storage**: React Context API, Dexie.js (IndexedDB wrapper)
*   **AI Integration**: 
    *   `@google/genai` SDK for Gemini
    *   Native `fetch` adapters for OpenAI/Anthropic
*   **UI Components**: Lucide React icons, Custom Modal/Toast system

## 📖 Documentation

*   [Architecture Overview](./docs/ARCHITECTURE.md) - Understanding the system design.
*   [Contributing Guide](./docs/CONTRIBUTING.md) - How to add new providers or features.

## License

MIT © [Your Name]
