import React, { createContext, useContext, useState, ReactNode } from 'react';

export const translations = {
  en: {
    appTitle: "VerbaFlow",
    appSubtitle: "AI Terminology & Transcript Suite",
    nav: {
      studio: "Workspace",
      glossary: "Knowledge Base",
      drive: "Save to Drive",
      expand: "Expand Sidebar",
      collapse: "Collapse Sidebar",
      hide: "Hide Sidebar",
      show: "Show Sidebar",
      data: "Data Management"
    },
    steps: {
      upload: "Upload",
      analysis: "Analysis",
      confirm: "Review",
      genSRT: "Gen SRT",
      genMD: "Gen Doc"
    },
    config: {
      title: "Configuration",
      modelLabel: "Work Model",
      modelFast: "Gemini 3.0 Flash (Fast)",
      modelSmart: "Gemini 3.0 Pro (High Reasoning)",
      languageLabel: "Output Language",
      customModel: "Custom...",
      customPlaceholder: "e.g. gemini-2.5-flash"
    },
    upload: {
      title: "Step 1: Upload Materials",
      audioLabel: "Upload Media",
      audioSub: "Audio (MP3, WAV) or Video (MP4, MOV)",
      audioReceived: "Media Ready",
      srtLabel: "Upload SRT File",
      srtSub: "Required for timestamps",
      srtReceived: "Subtitles Received",
      startBtn: "Start Analysis"
    },
    analysis: {
      loadingTitle: "Analyzing Content...",
      loadingSub: "Extracting terms, checking context, and summarizing.",
      reAnalyzing: "Re-analyzing with Glossary...",
      failedTitle: "Analysis Failed",
      retryBtn: "Retry",
      summaryTitle: "Content Summary",
      topic: "Topic",
      duration: "Duration",
      speakers: "Speakers",
      agenda: "Agenda",
      step3Title: "Step 3: Vocabulary Review",
      needsAttention: "items need attention",
      extraContextLabel: "Extra Context / Instructions for AI",
      extraContextPlaceholder: "E.g., 'The speaker has a heavy accent', 'Use British spelling', etc.",
      glossaryBtn: "Check Glossary",
      reAnalyzeBtn: "AI Re-check",
      resetBtn: "Reset All",
      confirmAllBtn: "Confirm All",
      table: {
        play: "Play",
        time: "Time",
        original: "Original",
        corrected: "Corrected",
        type: "Type",
        status: "Status",
        remarks: "Remarks"
      },
      statusOptions: {
        verified: "✅ Verified",
        confirm: "⚠️ Confirm",
        check: "ℹ️ Check",
        custom: "✏️ Custom"
      },
      nextStepBtn: "Next: Generate SRT",
      noSubtitle: "No subtitle...",
      videoControls: {
        prev: "Prev Line",
        next: "Next Line"
      }
    },
    glossary: {
      title: "Knowledge Base",
      importBtn: "Import Terms",
      exportBtn: "AI Smart Extraction",
      mergeBtn: "Merge to Session",
      term: "Term",
      definition: "Context/Definition",
      empty: "No glossary terms yet. Import or generate them from Analysis.",
      analyzing: "AI is summarizing glossary...",
      driveSync: "Sync to Drive"
    },
    srt: {
      title: "Step 4: Generate Polished SRT",
      desc: "AI is rewriting the SRT file while maintaining strict timestamp integrity.",
      download: "Download .SRT",
      next: "Next: Generate Document"
    },
    transcript: {
      title: "Step 5: Final Transcript",
      exportBtn: "Export Markdown",
      waiting: "Waiting for generation to start...",
      complete: "Transcription Complete",
      startNew: "Start New Task"
    },
    chat: {
      title: "AI Assistant",
      newChat: "New",
      history: "History",
      inputPlaceholder: "Ask me anything...",
      send: "Send",
      model: "Model",
      rename: "Rename",
      delete: "Delete",
      saveTitle: "Save",
      welcomeTitle: "VerbaFlow AI Agent",
      welcomeSubtitle: "I am your integrated AI assistant. Feel free to ask about the app, check terminology, or discuss any topic.",
      startBtn: "Start Conversation",
      export: "Export Chat"
    },
    data: {
      title: "Data Management",
      desc: "Local data is stored in your browser's IndexedDB. Clear it to free up space.",
      workspace: "Current Workspace",
      chats: "Chat History",
      clearBtn: "Clear Data",
      size: "Est. Size",
      count: "Items",
      empty: "No data stored."
    },
    errors: {
      analysisFailed: "Analysis failed. Please check API Key.",
      generationFailed: "Generation failed."
    }
  },
  zh: {
    appTitle: "VerbaFlow",
    appSubtitle: "AI 语流 · 术语管理与校对套件",
    nav: {
      studio: "智能工坊",
      glossary: "术语知识库",
      drive: "存至 Drive",
      expand: "展开侧边栏",
      collapse: "折叠",
      hide: "隐藏界面",
      show: "显示侧边栏",
      data: "数据管理"
    },
    steps: {
      upload: "上传素材",
      analysis: "智能分析",
      confirm: "人工复核",
      genSRT: "生成字幕",
      genMD: "生成文稿"
    },
    config: {
      title: "参数配置",
      modelLabel: "工作模型",
      modelFast: "Gemini 3.0 Flash (快速)",
      modelSmart: "Gemini 3.0 Pro (高推理)",
      languageLabel: "输出语言",
      customModel: "自定义...",
      customPlaceholder: "例如：gemini-2.5-flash"
    },
    upload: {
      title: "第一步：上传素材",
      audioLabel: "上传媒体文件",
      audioSub: "音频 (MP3, WAV) 或 视频 (MP4, MOV)",
      audioReceived: "媒体已就绪",
      srtLabel: "上传 SRT 字幕",
      srtSub: "必须用于提取时间轴",
      srtReceived: "字幕已就绪",
      startBtn: "开始分析"
    },
    analysis: {
      loadingTitle: "正在分析内容...",
      loadingSub: "AI 正在提取术语、检查上下文并生成摘要。",
      reAnalyzing: "正在结合术语库重新分析...",
      failedTitle: "分析失败",
      retryBtn: "重试",
      summaryTitle: "内容摘要",
      topic: "主题",
      duration: "时长",
      speakers: "发言人",
      agenda: "议程",
      step3Title: "第三步：词汇复核与管理",
      needsAttention: "项需关注",
      extraContextLabel: "额外说明 / 给 AI 的指令",
      extraContextPlaceholder: "例如：'演讲者有口音'，'保留口语化表达'，或者补充背景信息...",
      glossaryBtn: "查看术语库",
      reAnalyzeBtn: "AI 二次复核",
      resetBtn: "重置初始状态",
      confirmAllBtn: "一键确认",
      table: {
        play: "播放",
        time: "时间",
        original: "原文",
        corrected: "修正 (可编辑)",
        type: "类型",
        status: "状态",
        remarks: "备注"
      },
      statusOptions: {
        verified: "✅ 已确认",
        confirm: "⚠️ 需确认",
        check: "ℹ️ 待拼写检查",
        custom: "✏️ 自定义"
      },
      nextStepBtn: "下一步：生成 SRT 字幕",
      noSubtitle: "暂无字幕...",
      videoControls: {
        prev: "上一句",
        next: "下一句"
      }
    },
    glossary: {
      title: "术语知识库",
      importBtn: "导入术语",
      exportBtn: "AI 智能提取",
      mergeBtn: "应用到当前会话",
      term: "术语",
      definition: "上下文/定义",
      empty: "暂无术语。请导入或在分析阶段通过 AI 提取。",
      analyzing: "AI 正在总结生成术语库...",
      driveSync: "同步至 Drive"
    },
    srt: {
      title: "第四步：生成精校 SRT 字幕",
      desc: "AI 正在重新生成 SRT 文件，保持时间轴精确同步，同时应用修正后的文本。",
      download: "下载 .SRT 文件",
      next: "下一步：生成文稿"
    },
    transcript: {
      title: "第五步：生成最终文稿",
      exportBtn: "导出 Markdown",
      waiting: "等待生成开始...",
      complete: "转写完成",
      startNew: "开始新任务"
    },
    chat: {
      title: "AI 智能助手",
      newChat: "新建",
      history: "历史",
      inputPlaceholder: "有问题尽管问...",
      send: "发送",
      model: "模型",
      rename: "重命名",
      delete: "删除",
      saveTitle: "保存",
      welcomeTitle: "VerbaFlow 智能助手",
      welcomeSubtitle: "我是您的内置 AI 助手。您可以询问关于本应用的问题，查询术语，或者讨论任何话题。",
      startBtn: "开始对话",
      export: "导出对话"
    },
    data: {
      title: "数据存储管理",
      desc: "本地数据存储在浏览器的 IndexedDB 中。清除数据可释放空间。",
      workspace: "当前工作区",
      chats: "聊天历史记录",
      clearBtn: "清除数据",
      size: "预估大小",
      count: "数量",
      empty: "暂无存储数据"
    },
    errors: {
      analysisFailed: "分析失败，请检查 API Key。",
      generationFailed: "生成失败。"
    }
  }
};

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh'); 

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
