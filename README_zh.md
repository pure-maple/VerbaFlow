
# VerbaFlow - AI 语流 · 术语管理与校对套件

> **[English Documentation](./README.md)**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Gemini](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI%20%7C%20Anthropic-orange)

VerbaFlow 是一款专为音视频内容创作者、译者和校对人员设计的 **本地优先 (Local-First)** 专业级生产力工具。

与传统的云端 SaaS 平台不同，VerbaFlow **完全在您的浏览器中运行**。它利用 Google Gemini、OpenAI 或 Anthropic 等先进大模型的能力，在确保数据隐私的前提下，提供术语管理、自动化校对、字幕生成和一致性检查等工作流。

![VerbaFlow Interface](https://via.placeholder.com/800x450?text=VerbaFlow+Studio+Interface)

## 🌟 核心功能

### 1. 🤖 多模型服务商支持
*   **Gemini (原生多模态)**：推荐用于直接分析视频/音频文件，以及处理超长上下文。
*   **OpenAI / Anthropic**：支持 GPT-4o、Claude 3.5 Sonnet，通过标准协议提供高精度的文本校对与润色。
*   **灵活配置**：支持自定义 Base URL (代理)，可随时在不同模型间切换。

### 2. 🎧 智能校对工作台
*   **交互式复核**：左侧原文、右侧 AI 修正建议并列显示，高效对比。
*   **精准定位**：点击任意字幕行或术语，播放器即刻跳转至对应的音视频时间点。
*   **深度分析**：自动检测上下文逻辑错误、拼写错误及专有名词一致性问题。

### 3. 📚 术语知识库 (Glossary)
*   **智能提取**：AI 自动从文稿中提取专有名词、人名、地名及技术术语。
*   **闭环一致性**：将整理好的术语库反哺给 AI，对新上传的文稿进行二次复核，确保跨项目的术语严格一致。
*   **导入导出**：支持 JSON 备份，方便数据迁移。

### 4. 🔒 隐私安全与数据所有权
*   **IndexedDB 存储**：所有的项目文件、文稿修改记录、聊天历史均存储在浏览器本地数据库 (`Dexie.js`) 中。
*   **无后端架构**：我们没有后端服务器。您的 API Key 仅保存在本地 `LocalStorage`，直接与 AI 服务商通信。
*   **项目导出**：支持将完整项目状态导出为 `.vfproj` 文件，用于备份或分享。

### 5. 📤 生产级输出
*   **精校 SRT**：生成修正后的字幕文件，**严格保持原始时间轴不变**。
*   **Markdown 文稿**：将破碎的字幕行重组为可读性强的文章式文稿，自动区分发言人。

## 🚀 快速开始

### 准备工作
*   Node.js (v18 或更高版本)
*   以下任一服务商的 API Key:
    *   [Google AI Studio (Gemini)](https://aistudio.google.com/)
    *   [OpenAI Platform](https://platform.openai.com/)
    *   [Anthropic Console](https://console.anthropic.com/)

### 安装步骤

1.  **克隆仓库**
    ```bash
    git clone https://github.com/yourusername/verbaflow.git
    cd verbaflow
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm start
    ```

4.  **应用配置**
    *   访问 http://localhost:1234
    *   点击侧边栏底部的 **设置 (Settings)** 图标。
    *   选择服务商 (Provider) 并粘贴 API Key。
    *   (可选) 如果使用中转服务，请填写 Base URL。

## 🛠️ 技术栈

*   **前端框架**: React 19, TypeScript, Tailwind CSS
*   **数据存储**: React Context API (全局状态), Dexie.js (本地大数据存储)
*   **AI 集成**: 
    *   Gemini: 使用官方 `@google/genai` SDK
    *   OpenAI/Anthropic: 使用原生 Fetch 适配器模式
*   **UI 组件**: Lucide React 图标库, 自研播放器控制条

## 📖 文档资源

*   [架构概览](./docs/ARCHITECTURE.md) - 了解系统设计与数据流。
*   [贡献指南](./docs/CONTRIBUTING.md) - 学习如何添加新服务商或功能。

## 开源协议

MIT © [Your Name]
