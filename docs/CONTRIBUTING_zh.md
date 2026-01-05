
# 开发者指南与贡献

> **[English Version](./CONTRIBUTING.md)**

感谢您有兴趣改进 VerbaFlow！本指南将帮助您理解代码库并学习如何添加新功能。

## 📂 项目结构

```bash
/src
  /components      # UI 组件 (AnalysisView, FileUpload, ChatWidget 等)
  /contexts        # React 上下文 (全局配置, 多语言)
  /services        # 核心逻辑
    geminiService.ts  # LLM 集成 (适配器模式)
    storage.ts        # IndexedDB 封装 (基于 Dexie)
    googleDriveService.ts # 客户端 Drive API
  /utils           # 工具函数 (SRT 解析, 时间格式化)
  /types.ts        # TypeScript 类型定义
  App.tsx          # 主应用控制器
```

## 🛠️ 常见开发任务

### 1. 添加新的 LLM 服务商

要添加新的提供商（例如 Mistral, Groq, 或本地 Ollama 实例）：

1.  **更新配置类型**:
    *   在 `src/contexts/ConfigContext.tsx` 中，将提供商名称添加到 `LLMProvider` 类型定义中。
    *   在 `src/App.tsx` 的 `SettingsModal` 下拉菜单中添加该选项。

2.  **实现协议适配**:
    *   打开 `src/services/geminiService.ts`。
    *   更新 `resolveBaseUrl` 以提供该服务商的默认端点。
    *   在 `UniversalChatSession.sendMessage` 中，为新服务商添加 `if` 判断块。
    *   使用 `fetch` 实现 API 调用。确保正确处理该服务商特有的 JSON 请求/响应结构。

3.  **实现流式传输 (推荐)**:
    *   在 `geminiService.ts` 中，更新 `generatePolishedSubtitle` 和 `generateFinalTranscript`。
    *   如果 SSE (Server-Sent Events) 格式与 OpenAI/Anthropic 不同，请创建一个特定的流处理程序（例如 `streamOllama`）。

### 2. 添加新的字幕格式支持

目前，VerbaFlow 支持 SRT, VTT, ASS, 和 JSON。要添加其他格式（例如 TTML）：

1.  **编写解析逻辑**:
    *   打开 `src/utils/srtParser.ts`。
    *   创建一个 `parseTTML` 函数，将字符串内容转换为 `SubtitleItem[]` 数组。
    *   更新 `detectSubtitleFormat` 以识别文件签名。
    *   更新 `parseSubtitleToObjects` switch case。

### 3. 样式与 UI

*   我们使用 **Tailwind CSS**。
*   **深色模式**: 使用 `dark:` 前缀。确保任何新组件都支持亮色和深色模式。
*   **图标**: 使用 `lucide-react`。

## 🧪 开发流程

1.  启动开发服务器: `npm start`
2.  应用运行在 `http://localhost:1234` (Parcel 默认端口)。
3.  更改支持热重载 (Hot-reload)。

## ⚠️ 重要注意事项

*   **无后端**: 请勿引入服务器端依赖（如 Node.js/Express），除非您打算将其分叉为全栈应用。VerbaFlow 旨在设计为静态托管应用。
*   **类型安全**: 保持 `types.ts` 更新。尽量避免使用 `any`，除非处理外部无类型库（如 Google Picker API 的部分内容）。

编码愉快！
