
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export const translations = {
  en: {
    appTitle: "VerbaFlow",
    appSubtitle: "AI Terminology & Transcript Suite",
    common: {
      loading: "Loading...",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      rename: "Rename",
      save: "Save",
      processing: "Processing...",
      unknownError: "Unknown error occurred"
    },
    messages: {
      projectCreated: "Project created successfully!",
      projectCreateFailed: "Failed to create project.",
      projectLoaded: "Project loaded.",
      projectLoadFailed: "Failed to load project.",
      deleteFailed: "Failed to delete project.",
      reAnalysisComplete: "Re-analysis complete.",
      reAnalysisFailed: "Re-analysis failed.",
      workspaceReset: "Workspace reset to Step 1.",
      exportLimited: "Backup is currently limited in multi-project mode.",
      importUpdating: "Import feature is being updated.",
      driveSaveDisabled: "Drive Save is temporarily disabled.",
      analysisFailed: "Analysis failed. Please check API Key.",
      generationFailed: "Generation failed.",
      extractSuccess: "Successfully extracted {n} terms!",
      extractFailed: "Extraction failed.",
      noTermsFound: "No confirmed terms found.",
      noTermsExtracted: "No terms extracted by AI.",
      timestampsFixed: "Timestamps calibrated based on SRT.",
      timestampsFailed: "Failed to fix timestamps.",
      syntaxErrorRepaired: "Syntax error detected. Auto-repairing...",
      driveConfigMissing: "Google Drive not configured.",
      copySuccess: "Copied to clipboard!",
      sessionRenamed: "Session renamed.",
      exportSuccess: "Project exported to JSON.",
      importSuccess: "Project imported successfully!",
      importFailed: "Failed to import project. Invalid file."
    },
    nav: {
      studio: "Workspace",
      glossary: "Terminology",
      agents: "Agent Hub",
      drive: "Save to Drive",
      expand: "Expand Sidebar",
      collapse: "Collapse Sidebar",
      hide: "Hide Sidebar",
      show: "Show Sidebar",
      data: "Data Management"
    },
    projects: {
        title: "My Projects",
        subtitle: "Manage your analysis tasks",
        newProject: "New Project",
        importProject: "Import Project",
        exportProject: "Export JSON",
        untitled: "Untitled Project",
        lastEdited: "Last edited",
        deleteConfirm: "Are you sure you want to delete this project?",
        empty: "No projects yet.",
        createFirst: "Create your first project",
        noSummary: "No summary available.",
        openBtn: "Open",
        backBtn: "Back to Projects",
        steps: {
            1: "Draft",
            2: "Proofreading",
            3: "Generating",
            4: "Done"
        }
    },
    steps: {
      upload: "Upload",
      confirm: "Smart Proofread",
      genSRT: "Gen Subtitle",
      genMD: "Gen Doc"
    },
    config: {
      title: "System Settings",
      systemSettings: "System Settings",
      geminiSection: "Model Provider",
      providerLabel: "Service Provider",
      apiKey: "API Key",
      baseUrl: "Base URL (Optional)",
      baseUrlHelp: "Enter custom endpoint URL. Leave empty for default.",
      multimodalWarning: "Note: Audio/Video analysis requires a model with native multimodal capabilities (e.g., Gemini 3 Pro).",
      compatibilityWarning: "Compatibility Notice: VerbaFlow is highly optimized for Gemini models. Using OpenAI or Anthropic may result in limited functionality (e.g., no native video analysis) or unexpected errors.",
      driveSection: "Google Drive Integration",
      driveClientId: "Client ID",
      driveApiKey: "API Key (Drive Scope)",
      driveHelp: "Requires 'drive.file' scope enabled in Google Cloud Console. Usage is free for personal use.",
      storageSection: "Local Data Storage",
      storageDesc: "Manage IndexedDB storage size and history.",
      manageBtn: "Manage",
      saveBtn: "Save & Close",
      modelLabel: "Work Model",
      modelFast: "Flash / Fast Model",
      modelSmart: "Pro / Reasoning Model",
      languageLabel: "Output Language",
      customModel: "Custom...",
      customPlaceholder: "e.g. gemini-3-flash",
      devModeTitle: "Developer Mode / Temp Access",
      devModeDesc: "In cloud IDEs (Bolt, StackBlitz), domain verification fails. To bypass, get a temporary token from Google OAuth Playground (Select Drive API v3) and paste it below.",
      devModePlaceholder: "Paste Access Token (ya29...)",
      devModeActive: "Manual Token Active - OAuth origin check bypassed.",
      devModeOptional: "Optional if using Dev Token"
    },
    upload: {
      title: "Step 1: Upload Materials",
      videoLabel: "Video Source",
      audioLabel: "Audio Source",
      srtLabel: "Subtitle Source",
      dragDrop: "Drag & Drop or Click",
      browse: "Browse",
      analyzing: "Analyze with AI",
      localPreview: "Local Preview Only",
      startBtn: "Start Studio",
      videoRec: "Video Ready",
      audioRec: "Audio Ready",
      srtRec: "Subtitle Ready",
      fileTypeVideo: "MP4, MOV, WEBM",
      fileTypeAudio: "MP3, WAV, M4A",
      fileTypeSrt: ".SRT, .VTT, .ASS, .JSON",
      srTWarningTitle: "Notice regarding Subtitle & AI Analysis",
      srtWarningDesc: "Without a subtitle file, AI cannot perform text-based analysis or timestamp correction. Local media files are used for preview only and are NOT uploaded to the AI. You can still proceed for manual review or to use the Agent.",
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
      step3Title: "Step 2: Smart Proofread",
      needsAttention: "items need attention",
      extraContextLabel: "AI Instructions / Context",
      extraContextPlaceholder: "E.g., 'The speaker has a heavy accent', 'Use British spelling', or add specific background info...",
      glossaryBtn: "Select Glossary",
      reAnalyzeBtn: "AI Re-check",
      fixTimeBtn: "Fix Timestamps",
      resetBtn: "Reset All",
      confirmAllBtn: "Generate",
      formatLabel: "Format:",
      askAgent: "Ask Agent",
      detailEdit: "Edit Details",
      extractBtn: "Extract to Glossary",
      instructionsBtn: "AI Instructions",
      table: {
        play: "Play",
        time: "Time",
        original: "Original",
        corrected: "Corrected",
        type: "Type",
        status: "Status",
        remarks: "User Note",
        detail: "Edit"
      },
      statusOptions: {
        verified: "✅ Verified",
        confirm: "⚠️ Needs Human Confirm",
        check: "ℹ️ Check Spelling",
        custom: "✏️ Custom Status",
        ai_recheck: "🤖 Needs AI Confirm"
      },
      nextStepBtn: "Next: Generate Subtitle",
      noSubtitle: "No subtitle...",
      detailPanel: {
        title: "Edit Term Detail",
        context: "Context Preview",
        aiReason: "AI Reason / Original Note",
        userNote: "Your Note / Instruction",
        correction: "Correction",
        save: "Save Changes"
      },
      postConfirm: {
        title: "Update Glossary?",
        desc: "Do you want to extract these confirmed terms to your glossary?",
        newSet: "Create New Set",
        addTo: "Add to Existing",
        skip: "Skip"
      },
      extractModal: {
        title: "Extract Terms to Glossary",
        desc: "Extract the current validated terms into a glossary set for future reuse.",
        newSet: "Create New Set",
        addTo: "Add to Existing Set",
        confirm: "Extract",
        cancel: "Cancel",
        processing: "Processing in background..."
      },
      instructionModal: {
        title: "AI Instructions & Context",
        desc: "Provide extra context or rules for the AI (e.g., 'Speaker is from Boston', 'Keep slang').",
        placeholder: "Enter instructions...",
        save: "Save & Apply"
      }
    },
    videoControls: {
      prev: "Prev Line",
      next: "Next Line",
      attach: "Attach Media",
      detach: "Remove Media",
      attachTitle: "Upload local media",
      expand: "Expand View",
      collapse: "Compact View",
      captions: "Toggle Captions",
      layoutOverlay: "Overlay Layout",
      layoutSide: "Side-by-Side Layout",
      switchToAudio: "Switch to Audio",
      switchToVideo: "Switch to Video"
    },
    glossary: {
      title: "Terminology Management",
      subtitle: "Create, classify, and manage multiple glossary sets for different scenarios.",
      searchPlaceholder: "Search sets by name or tag...",
      createBtn: "New Set",
      importBtn: "Smart Import",
      exportJSON: "Export JSON",
      importJSON: "Import JSON",
      deleteSelected: "Delete Selected",
      noSetsFound: "No glossary sets found. Create one or start an analysis to extract terms.",
      extractModal: {
        title: "Smart Extraction Config",
        source: "Source Content",
        target: "Target Destination",
        createNew: "Create New Glossary Set",
        appendTo: "Append to Current Set",
        confirm: "Start Extraction",
        cancel: "Cancel",
        warning: "Please select a glossary set to append to."
      },
      importModal: {
        title: "Smart Import / Extraction",
        desc: "Upload a file or paste text. AI will structure terms and definitions automatically.",
        tabFile: "File Upload",
        tabText: "Paste Text",
        contextLabel: "Context / Background (Optional)",
        contextPlaceholder: "E.g. This is a medical document about cardiology...",
        previewTitle: "Preview & Confirm",
        targetSet: "Target Set",
        newSet: "New Set",
        existingSet: "Append to: ",
        btnAnalyze: "Analyze & Structure",
        btnSave: "Confirm Import",
        filePlaceholder: "Drag file or click to upload (TXT, CSV, PDF, DOCX...)"
      },
      columns: {
        name: "Set Name",
        tags: "Tags",
        count: "Terms",
        updated: "Last Updated",
        actions: "Actions"
      },
      modal: {
        createTitle: "Create Glossary Set",
        editTitle: "Edit Glossary Set",
        nameLabel: "Name",
        tagsLabel: "Tags (comma separated)",
        descLabel: "Description",
        cancel: "Cancel",
        save: "Save"
      },
      detail: {
        back: "Back to Library",
        addItem: "Add Term",
        importCSV: "Import Text",
        empty: "No terms in this set yet.",
        termHeader: "Term",
        defHeader: "Definition / Remarks"
      },
      driveSync: "Sync to Drive"
    },
    agents: {
      title: "Agent Hub",
      subtitle: "Manage your specialized AI agents and conversation history.",
      newChat: "New Chat",
      placeholder: "Select a chat to start messaging...",
      searchPlaceholder: "Search conversations...",
      modelSelect: "Model",
      toggleSidebar: "Toggle Sidebar"
    },
    srt: {
      title: "Step 3: Generate Polished Subtitle",
      desc: "AI is rewriting the subtitle file while maintaining strict timestamp integrity.",
      download: "Download Subtitle",
      next: "Next: Generate Document"
    },
    transcript: {
      title: "Step 4: Final Transcript",
      exportBtn: "Export Markdown",
      waiting: "Waiting for generation to start...",
      complete: "Transcription Complete",
      startNew: "Start New Task"
    },
    chat: {
      title: "VerbaFlow Assistant",
      newChat: "New",
      history: "History",
      backToChat: "Back to Chat",
      inputPlaceholder: "Ask me anything...",
      send: "Send",
      model: "Model",
      rename: "Rename",
      delete: "Delete",
      saveTitle: "Save",
      welcomeTitle: "VerbaFlow AI Assistant",
      welcomeSubtitle: "I am your integrated AI assistant. Feel free to ask about the app, check terminology, or discuss any topic.",
      startBtn: "Start Conversation",
      export: "Export Chat",
      fullscreen: "Full Screen",
      exitFullscreen: "Exit Full Screen"
    },
    data: {
      title: "Data Management",
      desc: "Local data is stored in your browser's IndexedDB. Clear it to free up space.",
      workspace: "Current Workspace",
      chats: "Chat History",
      glossarySets: "Glossary Sets",
      manageTab: "Manage in Tab",
      clearBtn: "Clear Data",
      size: "Est. Size",
      count: "Items",
      unit: "items",
      unitSets: "sets",
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
    common: {
      loading: "加载中...",
      cancel: "取消",
      confirm: "确认",
      delete: "删除",
      rename: "重命名",
      save: "保存",
      processing: "处理中...",
      unknownError: "发生未知错误"
    },
    messages: {
      projectCreated: "项目创建成功！",
      projectCreateFailed: "项目创建失败。",
      projectLoaded: "项目已加载。",
      projectLoadFailed: "项目加载失败。",
      deleteFailed: "删除项目失败。",
      reAnalysisComplete: "重新分析完成。",
      reAnalysisFailed: "重新分析失败。",
      workspaceReset: "工作区已重置为第一步。",
      exportLimited: "多项目模式下备份功能受限，建议使用 IndexedDB。",
      importUpdating: "导入功能正在升级中。",
      driveSaveDisabled: "Drive 保存功能暂时停用。",
      analysisFailed: "分析失败，请检查 API Key。",
      generationFailed: "生成失败。",
      extractSuccess: "成功提取 {n} 个术语！",
      extractFailed: "提取失败。",
      noTermsFound: "未找到已确认的术语。",
      noTermsExtracted: "AI 未提取到任何术语。",
      timestampsFixed: "时间轴已根据 SRT 校准。",
      timestampsFailed: "校准时间轴失败。",
      syntaxErrorRepaired: "检测到语法错误，正在自动修复...",
      driveConfigMissing: "Google Drive 未配置。",
      copySuccess: "已复制到剪贴板！",
      sessionRenamed: "会话已重命名。",
      exportSuccess: "项目已导出为 JSON。",
      importSuccess: "项目导入成功！",
      importFailed: "导入失败，文件格式无效。"
    },
    nav: {
      studio: "智能工坊",
      glossary: "术语管理",
      agents: "智能体中心",
      drive: "存至 Drive",
      expand: "展开侧边栏",
      collapse: "折叠",
      hide: "隐藏界面",
      show: "显示侧边栏",
      data: "数据管理"
    },
    projects: {
        title: "我的项目",
        subtitle: "管理您的分析任务",
        newProject: "新建项目",
        importProject: "导入项目",
        exportProject: "导出数据",
        untitled: "未命名项目",
        lastEdited: "最后编辑",
        deleteConfirm: "确定要删除此项目吗？",
        empty: "暂无项目。",
        createFirst: "创建您的第一个项目",
        noSummary: "暂无摘要。",
        openBtn: "进入工作台",
        backBtn: "返回项目列表",
        steps: {
            1: "草稿",
            2: "校对中",
            3: "生成中",
            4: "已完成"
        }
    },
    steps: {
      upload: "上传素材",
      // analysis: "智能分析", // Removed
      confirm: "智能校对",
      genSRT: "生成字幕",
      genMD: "生成文稿"
    },
    config: {
      title: "系统设置",
      systemSettings: "系统设置",
      geminiSection: "大模型服务商配置",
      providerLabel: "服务商 (Provider)",
      apiKey: "API Key (密钥)",
      baseUrl: "Base URL (代理地址/可选)",
      baseUrlHelp: "用于兼容的中转接口地址。留空则使用默认官方地址。",
      multimodalWarning: "注意：解析音视频素材需要大模型本身支持多模态能力 (如 Gemini 3 Pro)。",
      compatibilityWarning: "兼容性警告：VerbaFlow 核心功能已针对 Gemini 模型深度优化。使用 OpenAI 或 Anthropic 可能会导致功能受限（如无法进行原生视频分析）或出现未知错误。",
      driveSection: "Google Drive 集成",
      driveClientId: "Client ID (客户端 ID)",
      driveApiKey: "API Key (Drive 权限)",
      driveHelp: "需要在 Google Cloud Console 中启用 'drive.file' 权限范围。个人使用通常免费。",
      storageSection: "本地数据存储",
      storageDesc: "管理 IndexedDB 存储占用与历史记录。",
      manageBtn: "管理",
      saveBtn: "保存并关闭",
      modelLabel: "工作模型",
      modelFast: "Flash / 快速模型",
      modelSmart: "Pro / 推理模型",
      languageLabel: "输出语言",
      customModel: "自定义...",
      customPlaceholder: "例如：gemini-3-flash",
      // Dev Mode
      devModeTitle: "开发者模式 / 临时访问令牌",
      devModeDesc: "在 Bolt/StackBlitz 等云端 IDE 中，Google 域名验证会失败。请前往 Google OAuth Playground (选择 Drive API v3) 获取临时 Access Token 并粘贴在下方。",
      devModePlaceholder: "粘贴 Access Token (ya29...)",
      devModeActive: "手动 Token 已激活 - 无需域名验证",
      devModeOptional: "使用临时令牌时，此项可选"
    },
    upload: {
      title: "第一步：上传素材",
      videoLabel: "视频素材",
      audioLabel: "音频素材",
      srtLabel: "字幕文件",
      dragDrop: "拖拽文件或点击上传",
      browse: "浏览文件",
      analyzing: "提交 AI 分析",
      localPreview: "仅本地预览",
      startBtn: "进入工作台",
      videoRec: "视频已就绪",
      audioRec: "音频已就绪",
      srtRec: "字幕已就绪",
      fileTypeVideo: "支持 MP4, MOV, WEBM",
      fileTypeAudio: "支持 MP3, WAV, M4A",
      fileTypeSrt: ".SRT, .VTT, .ASS, .JSON",
      srTWarningTitle: "关于字幕文件与 AI 分析",
      srtWarningDesc: "未上传字幕文件将影响时间轴的精准定位和自动校对功能。本地音视频素材默认不上传至 AI，仅用于本地预览。您仍可进入工作台进行人工复核或使用 AI 助手。",
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
      step3Title: "第二步：智能复核与校对",
      needsAttention: "项需关注",
      extraContextLabel: "额外说明 / 给 AI 的指令",
      extraContextPlaceholder: "例如：'演讲者有口音'，'保留口语化表达'，或者补充背景信息...",
      glossaryBtn: "选择术语库",
      reAnalyzeBtn: "AI 二次复核",
      fixTimeBtn: "校准时间",
      resetBtn: "重置",
      confirmAllBtn: "开始生成",
      formatLabel: "格式：",
      askAgent: "询问助手",
      detailEdit: "详情/编辑",
      extractBtn: "提取入库",
      instructionsBtn: "AI 指令",
      table: {
        play: "播放",
        time: "时间",
        original: "原文",
        corrected: "修正",
        type: "类型",
        status: "状态",
        remarks: "用户备注/指令",
        detail: "编辑"
      },
      statusOptions: {
        verified: "✅ 已确认",
        confirm: "⚠️ 需人工确认",
        check: "ℹ️ 待拼写检查",
        custom: "✏️ 自定义",
        ai_recheck: "🤖 需 AI 确认"
      },
      nextStepBtn: "下一步：生成字幕文件",
      noSubtitle: "暂无字幕...",
      detailPanel: {
        title: "编辑术语详情",
        context: "上下文预览",
        aiReason: "AI 原始分析/理由",
        userNote: "您的备注 / 给 AI 的指令",
        correction: "修正内容 (多行)",
        save: "保存更改"
      },
      postConfirm: {
        title: "更新术语库？",
        desc: "是否将这些确认后的术语提取到术语库中？",
        newSet: "新建术语库",
        addTo: "追加到现有库",
        skip: "跳过"
      },
      extractModal: {
        title: "提取术语至库",
        desc: "将当前已验证的术语提取到术语库集合中，以便未来复用。",
        newSet: "新建术语库",
        addTo: "添加到现有库",
        confirm: "后台提取",
        cancel: "取消",
        processing: "AI 正在后台提取术语..."
      },
      instructionModal: {
        title: "AI 指令与上下文",
        desc: "为 AI 提供额外的背景信息或规则 (例如: '演讲者来自波士顿', '保留俚语', '不要翻译人名').",
        placeholder: "输入指令...",
        save: "保存并应用"
      }
    },
    videoControls: {
        prev: "上一句",
        next: "下一句",
        attach: "关联媒体",
        detach: "移除媒体",
        attachTitle: "上传本地媒体",
        expand: "展开大屏",
        collapse: "收起",
        captions: "显示/隐藏字幕",
        layoutOverlay: "悬浮字幕模式",
        layoutSide: "侧边字幕模式",
        switchToAudio: "切换至音频",
        switchToVideo: "切换至视频"
    },
    glossary: {
      title: "术语库管理",
      subtitle: "创建、分类和管理适用于不同场景的术语集合。",
      searchPlaceholder: "搜索术语库名称或标签...",
      createBtn: "新建库",
      importBtn: "智能提取入库",
      exportJSON: "导出 JSON",
      importJSON: "导入 JSON",
      deleteSelected: "删除选中",
      noSetsFound: "暂无术语库。请新建或开始分析任务以提取术语。",
      extractModal: {
        title: "智能提取配置",
        source: "来源内容",
        target: "目标位置",
        createNew: "新建术语库",
        appendTo: "追加到当前库",
        confirm: "开始提取",
        cancel: "取消",
        warning: "请先选择一个需要追加的术语库。"
      },
      importModal: {
        title: "智能提取 / 入库",
        desc: "上传文件或粘贴文本。AI 将自动识别术语、生成解释并结构化。",
        tabFile: "上传文件",
        tabText: "粘贴文本",
        contextLabel: "背景说明 / 提示词 (可选)",
        contextPlaceholder: "例如：这是关于心脏病学的医学文档，请重点关注药物名称...",
        previewTitle: "预览与确认",
        targetSet: "目标位置",
        newSet: "新建术语库",
        existingSet: "追加到：",
        btnAnalyze: "开始 AI 识别",
        btnSave: "确认入库",
        filePlaceholder: "拖拽文件或点击上传 (TXT, CSV, PDF, DOCX...)"
      },
      columns: {
        name: "库名称",
        tags: "分类标签",
        count: "术语数",
        updated: "更新时间",
        actions: "操作"
      },
      modal: {
        createTitle: "新建术语库",
        editTitle: "编辑术语库",
        nameLabel: "库名称",
        tagsLabel: "分类标签 (逗号分隔)",
        descLabel: "描述备注",
        cancel: "取消",
        save: "保存"
      },
      detail: {
        back: "返回库列表",
        addItem: "添加术语",
        importCSV: "批量导入",
        empty: "该库暂无术语。",
        termHeader: "术语 (原文)",
        defHeader: "定义 / 备注"
      },
      driveSync: "同步至 Drive"
    },
    agents: {
      title: "智能体中心",
      subtitle: "管理您的专用 AI 智能体和历史会话记录。",
      newChat: "新建会话",
      placeholder: "请选择一个会话开始消息...",
      searchPlaceholder: "搜索话题关键字...",
      modelSelect: "模型",
      toggleSidebar: "显示/隐藏侧边栏"
    },
    srt: {
      title: "第三步：生成精校字幕",
      desc: "AI 正在重新生成字幕文件，严格保持原格式和时间轴，同时应用修正后的文本。",
      download: "下载字幕文件",
      next: "下一步：生成文稿"
    },
    transcript: {
      title: "第四步：生成最终文稿",
      exportBtn: "导出 Markdown",
      waiting: "等待生成开始...",
      complete: "转写完成",
      startNew: "开始新任务"
    },
    chat: {
      title: "语流助手",
      newChat: "新建",
      history: "历史记录",
      backToChat: "返回对话",
      inputPlaceholder: "有问题尽管问...",
      send: "发送",
      model: "模型",
      rename: "重命名",
      delete: "删除",
      saveTitle: "保存",
      welcomeTitle: "VerbaFlow 语流助手",
      welcomeSubtitle: "我是您的内置 AI 助手。您可以询问关于本应用的问题，查询术语，或者讨论任何话题。",
      startBtn: "开始对话",
      export: "导出对话",
      fullscreen: "全屏模式",
      exitFullscreen: "退出全屏"
    },
    data: {
      title: "数据存储管理",
      desc: "本地数据存储在浏览器的 IndexedDB 中。清除数据可释放空间。",
      workspace: "当前工作区",
      chats: "聊天历史记录",
      glossarySets: "术语库集合",
      manageTab: "去管理",
      clearBtn: "清除数据",
      size: "预估大小",
      count: "数量",
      unit: "项",
      unitSets: "个",
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
  // Initialize state with lazy initializer to check localStorage or Browser preference
  const [language, setLanguageState] = useState<Language>(() => {
    // 1. Check persistence
    const saved = localStorage.getItem('verbaflow_ui_lang');
    if (saved === 'en' || saved === 'zh') return saved;
    
    // 2. Auto-detect browser language
    const browserLang = navigator.language.toLowerCase();
    // Prefer Chinese for Chinese users, otherwise default to English
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  });

  // Wrapper to save to persistence on change
  const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('verbaflow_ui_lang', lang);
  };

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
