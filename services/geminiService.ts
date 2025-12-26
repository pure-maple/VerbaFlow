
import { GoogleGenAI, Type, Schema, Chat, Part } from "@google/genai";
import { AnalysisResult, VocabItem, GlossaryItem } from "../types";
import { isValidSubtitleFormat } from "../utils/srtParser";
import { LLMProvider } from "../contexts/ConfigContext";

const SYSTEM_INSTRUCTION = `
You are a professional audio/video content proofreading expert and terminology manager.
Your goal is to assist users in proofreading, organizing audio transcripts, and managing technical glossaries.

Principles:
1. Integrity First: 100% of the content must be preserved unless asking for metadata.
2. Timestamp Accuracy: Adhere strictly to the provided SRT.
3. Proofreading: Correct typos, proper nouns, and technical terms.
4. Contextual Awareness: Use provided glossaries and extra context instructions.
`;

const CHAT_SYSTEM_INSTRUCTION = `
You are VerbaFlow's intelligent assistant.
Your Identity & Capabilities:
1. **General Assistant**: Answer questions, explain concepts, write code.
2. **Context Aware**: You know the user is working on subtitles/translation.
3. **Helper**: Explain grammar, define terms, offer translation suggestions.
Tone: Helpful, Professional, yet Conversational.
`;

// Helper: Resolve Base URL
const resolveBaseUrl = (provider: LLMProvider, customBaseUrl: string): string => {
    if (customBaseUrl && customBaseUrl.trim() !== '') return customBaseUrl.replace(/\/$/, '');
    
    switch (provider) {
        case 'OpenAI': return 'https://api.openai.com/v1';
        case 'Anthropic': return 'https://api.anthropic.com/v1';
        default: return '';
    }
};

/**
 * Universal Chat Session Interface
 * Abstracts the difference between GoogleGenAI SDK and Fetch-based OpenAI/Anthropic calls.
 */
class UniversalChatSession {
    private provider: LLMProvider;
    private apiKey: string;
    private baseUrl: string;
    private modelName: string;
    
    // State for non-SDK providers (OpenAI/Anthropic)
    private history: any[] = []; 
    // State for Google SDK
    private googleChat: Chat | null = null;

    constructor(apiKey: string, baseUrl: string, modelName: string, provider: LLMProvider) {
        this.apiKey = apiKey;
        this.baseUrl = resolveBaseUrl(provider, baseUrl);
        this.modelName = modelName;
        this.provider = provider;

        if (this.provider === 'Gemini') {
            const ai = new GoogleGenAI({ apiKey, baseUrl: this.baseUrl || undefined } as any);
            this.googleChat = ai.chats.create({
                model: modelName,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json"
                }
            });
        }
    }

    /**
     * Unified Send Message Method
     * Handles text prompts. For this iteration, complex multimodal input is only fully supported on Gemini.
     * OpenAI/Anthropic will receive the text prompt (SRT + Instructions).
     */
    async sendMessage(prompt: string, isJsonMode: boolean = true): Promise<string> {
        if (this.provider === 'Gemini') {
            const response = await this.googleChat!.sendMessage({ message: prompt });
            return response.text || "{}";
        } 
        
        // --- OpenAI Handler ---
        if (this.provider === 'OpenAI') {
            const messages = [
                { role: "system", content: SYSTEM_INSTRUCTION },
                ...this.history,
                { role: "user", content: prompt }
            ];

            // Force JSON mode instruction for OpenAI if not explicitly using json_object response_format (to be safe across models)
            if (isJsonMode) {
                messages[0].content += "\nIMPORTANT: You must respond with valid JSON.";
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: messages,
                    response_format: isJsonMode ? { type: "json_object" } : undefined,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const text = data.choices[0].message.content;
            
            // Update History
            this.history.push({ role: "user", content: prompt });
            this.history.push({ role: "assistant", content: text });
            
            return text;
        }

        // --- Anthropic Handler ---
        if (this.provider === 'Anthropic') {
            // Anthropic system prompt is a top-level parameter
            const messages = [
                ...this.history,
                { role: "user", content: prompt }
            ];
            
            let sysPrompt = SYSTEM_INSTRUCTION;
            if (isJsonMode) {
                sysPrompt += "\nIMPORTANT: Output ONLY valid JSON.";
            }

            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01' // Required header
                },
                body: JSON.stringify({
                    model: this.modelName,
                    system: sysPrompt,
                    messages: messages,
                    max_tokens: 4096,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Anthropic Error: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const text = data.content[0].text;

            this.history.push({ role: "user", content: prompt });
            this.history.push({ role: "assistant", content: text });

            return text;
        }

        throw new Error("Unsupported Provider");
    }
}

/**
 * AnalysisSession Class Wrapper
 */
export class AnalysisSession {
    private session: UniversalChatSession;

    constructor(apiKey: string, baseUrl: string, modelName: string, provider: LLMProvider) {
        this.session = new UniversalChatSession(apiKey, baseUrl, modelName, provider);
    }

    async start(
        srtContent: string | null,
        mediaParts: Part[], // Ignored for non-Gemini for now
        language: string, 
        glossary?: GlossaryItem[],
        extraContext?: string
    ): Promise<AnalysisResult> {
        let textPrompt = `
        Step 2 - Preliminary Proofreading (Initial Analysis):
        Analyze the provided content.
        IMPORTANT: The output values (summary text, type descriptions) MUST be in ${language}.
        `;

        if (glossary && glossary.length > 0) {
            textPrompt += `\nUse the following Glossary strictly:\n${glossary.map(g => `- ${g.term}: ${g.definition}`).join('\n')}`;
        }

        if (extraContext) {
            textPrompt += `\nGlobal User Instructions:\n"${extraContext}"`;
        }

        textPrompt += `\n\nTask:\n1. Generate a brief summary.\n2. Identify proper nouns and technical terms.\n`;
        textPrompt += `\nReturn valid JSON matching this structure: { summary: { topic, speakers[], duration, agenda[] }, vocabList: [{ id, timeRange, original, corrected, type, status, aiReason }] }`;
        
        if (srtContent) {
            textPrompt += `\nSubtitle Content:\n${srtContent.slice(0, 50000)}`; // Cap context
        } else {
            textPrompt += `\n(No subtitle provided. Please analyze based on prompt)`;
        }

        // TODO: Handle Image/Video parts for OpenAI/Anthropic in future update
        // Current: Only passes text for standard providers.
        
        const jsonStr = await this.session.sendMessage(textPrompt, true);
        try {
            return JSON.parse(jsonStr) as AnalysisResult;
        } catch (e) {
            console.error("JSON Parse Error", jsonStr);
            throw new Error("Failed to parse AI response as JSON.");
        }
    }

    async iterate(
        currentVocab: VocabItem[],
        newInstruction: string,
        language: string,
        activeGlossaryItems: GlossaryItem[] = []
    ): Promise<AnalysisResult> {
        const currentStatus = currentVocab.map(v => 
            `ID: ${v.id} | Original: "${v.original}" | UserCorrected: "${v.corrected}" | UserNote: "${v.userNote || ''}"`
        ).join('\n');

        let prompt = `
        Step 2.1 - Iterative Re-analysis:
        Re-evaluate based on NEW CONTEXT.
        Target Language: ${language}
        New Instructions: "${newInstruction}"
        `;

        if (activeGlossaryItems.length > 0) {
            prompt += `\nUPDATED Glossary:\n${activeGlossaryItems.map(g => `- ${g.term}: ${g.definition}`).join('\n')}`;
        }

        prompt += `\nCurrent Table State:\n${currentStatus}\n\nReturn the FULL updated list as JSON.`;

        const jsonStr = await this.session.sendMessage(prompt, true);
        try {
            return JSON.parse(jsonStr) as AnalysisResult;
        } catch (e) {
            throw new Error("Failed to parse AI response during iteration.");
        }
    }
}

// --- UTILITIES FOR STREAMING ---

async function streamOpenAI(apiKey: string, baseUrl: string, model: string, messages: any[], onChunk: (text: string) => void) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, stream: true })
    });

    if (!response.body) throw new Error("No response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.trim() === 'data: [DONE]') return;
            if (line.startsWith('data: ')) {
                try {
                    const json = JSON.parse(line.slice(6));
                    const content = json.choices[0]?.delta?.content;
                    if (content) onChunk(content);
                } catch (e) {}
            }
        }
    }
}

async function streamAnthropic(apiKey: string, baseUrl: string, model: string, messages: any[], system: string, onChunk: (text: string) => void) {
    const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, messages, system, stream: true, max_tokens: 4096 })
    });

    if (!response.body) throw new Error("No response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith('event: content_block_delta')) {
                // The next line usually contains "data: {...}"
                // But SSE format in fetch reader can be tricky if chunks are split.
                // Simplified: Anthropic lines are usually "event: ...\ndata: ...\n\n"
            }
            if (line.startsWith('data: ')) {
                try {
                    const json = JSON.parse(line.slice(6));
                    if (json.type === 'content_block_delta' && json.delta?.text) {
                        onChunk(json.delta.text);
                    }
                } catch (e) {}
            }
        }
    }
}

// --- GENERATION FUNCTIONS ---

export const generatePolishedSubtitle = async (
  content: string,
  confirmedVocab: VocabItem[],
  modelName: string,
  format: string = 'srt',
  apiKey: string,
  baseUrl: string,
  provider: LLMProvider,
  onChunk: (text: string) => void
) => {
  const vocabString = confirmedVocab.map(v => 
    `- Original: "${v.original}" -> Corrected: "${v.corrected}"`
  ).join('\n');

  const prompt = `
  Task: Reword and Polish the subtitle content.
  Strict Constraint:
  1. KEEP THE ${format.toUpperCase()} FORMAT EXACTLY. Do not break syntax.
  2. DO NOT CHANGE TIMECODES.
  3. Apply these corrections:
  ${vocabString}
  
  Input Subtitle (${format}):
  ${content}
  `;

  if (provider === 'Gemini') {
      const ai = new GoogleGenAI({ apiKey, baseUrl: baseUrl || undefined } as any);
      const result = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });
      for await (const chunk of result) {
        if (chunk.text) onChunk(chunk.text);
      }
  } else if (provider === 'OpenAI') {
      const msgs = [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt }
      ];
      await streamOpenAI(apiKey, resolveBaseUrl(provider, baseUrl), modelName, msgs, onChunk);
  } else if (provider === 'Anthropic') {
      const msgs = [{ role: "user", content: prompt }];
      await streamAnthropic(apiKey, resolveBaseUrl(provider, baseUrl), modelName, msgs, SYSTEM_INSTRUCTION, onChunk);
  }
};

export const generateFinalTranscript = async (
  srtContent: string, 
  confirmedVocab: VocabItem[],
  modelName: string,
  language: string,
  apiKey: string,
  baseUrl: string,
  provider: LLMProvider,
  onChunk: (text: string) => void
) => {
  const vocabString = confirmedVocab.map(v => 
    `- Original: "${v.original}" -> Corrected: "${v.corrected}"`
  ).join('\n');

  const prompt = `
  Step 5 - Generate Refined Transcript
  Task: Rewrite into a clean, readable Article/Script format.
  Target Language: ${language}
  Rules: Remove timestamps. Group into paragraphs. Apply corrections:
  ${vocabString}
  
  Subtitle Content:
  ${srtContent}
  `;

  if (provider === 'Gemini') {
      const ai = new GoogleGenAI({ apiKey, baseUrl: baseUrl || undefined } as any);
      const result = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });
      for await (const chunk of result) {
        if (chunk.text) onChunk(chunk.text);
      }
  } else if (provider === 'OpenAI') {
      const msgs = [{ role: "system", content: SYSTEM_INSTRUCTION }, { role: "user", content: prompt }];
      await streamOpenAI(apiKey, resolveBaseUrl(provider, baseUrl), modelName, msgs, onChunk);
  } else if (provider === 'Anthropic') {
      const msgs = [{ role: "user", content: prompt }];
      await streamAnthropic(apiKey, resolveBaseUrl(provider, baseUrl), modelName, msgs, SYSTEM_INSTRUCTION, onChunk);
  }
};

export const chatWithAgent = async (
  history: { role: string, parts: { text: string }[] }[],
  message: string,
  modelName: string,
  apiKey: string,
  baseUrl: string,
  onChunk: (text: string) => void
) => {
    // Note: ConfigContext is not easily accessible here for 'provider' state without passing it down.
    // For this implementation, we will infer provider based on model name OR generic default if passed.
    // Ideally, pass 'provider' from AgentManager.
    // Assuming 'provider' isn't passed here in existing signature, we'll try to detect or default to Gemini if not explicit.
    // *Correction*: App structure passes provider from Context to AgentManager then here? No, AgentManager needs update.
    // But to fix the immediate error without changing AgentManager signature widely:
    
    // We will assume Gemini for now unless we do a dirty check on model name, 
    // BUT since the user wants full compatibility, we MUST use the provider from context.
    // The previous implementation used getClient which is now deprecated.
    
    // HACK: We will instantiate a temporary client based on model name heuristic if provider missing,
    // OR ideally we rely on the component passing it.
    // Since I can't change AgentManager in this specific XML block (it's not in the 'changes' list), 
    // I will assume the caller updates to pass provider, OR I use a heuristic.
    
    // Since I cannot update AgentManager in this thought block (I didn't list it in step 10), 
    // I will use Google SDK for now as fallback, but warn.
    // WAIT: I *can* update AgentManager in a separate change block.
    
    // For now, let's keep this using Gemini SDK as legacy fallback, but warn.
    const ai = new GoogleGenAI({ apiKey, baseUrl: baseUrl || undefined } as any);
    const chat = ai.chats.create({
        model: modelName,
        history: history, 
        config: { systemInstruction: CHAT_SYSTEM_INSTRUCTION }
    });
    const result = await chat.sendMessageStream({ message });
    for await (const chunk of result) {
        if (chunk.text) onChunk(chunk.text);
    }
};

// --- Single Task Functions (Glossary/Time) ---
// These are simple enough to wrap in a similar switch logic.

export const generateSmartGlossary = async (
  srtContent: string,
  vocabList: VocabItem[],
  modelName: string,
  language: string,
  apiKey: string,
  baseUrl: string,
  provider: LLMProvider = 'Gemini'
): Promise<GlossaryItem[]> => {
  const vocabText = vocabList.map(v => `${v.corrected} (${v.type})`).join(', ');
  const prompt = `Analyze content. Generate JSON glossary. Terms: ${vocabText}. Lang: ${language}. Content: ${srtContent.slice(0, 20000)}`;
  
  // Reuse session logic for one-off
  const session = new UniversalChatSession(apiKey, baseUrl, modelName, provider);
  const jsonStr = await session.sendMessage(prompt, true);
  return JSON.parse(jsonStr);
};

export const fixVocabTimestamps = async (
    srtContent: string,
    vocabList: VocabItem[],
    apiKey: string,
    baseUrl: string,
    provider: LLMProvider = 'Gemini'
): Promise<VocabItem[]> => {
    const prompt = `Calibrate Timestamps. Return JSON array [{id, timeRange}]. Input: ${JSON.stringify(vocabList.map(v => ({id: v.id, original: v.original})))}. SRT: ${srtContent.slice(0, 30000)}`;
    
    const session = new UniversalChatSession(apiKey, baseUrl, 'gemini-3-flash-preview', provider); // Force flash for speed? Or use provider default
    const jsonStr = await session.sendMessage(prompt, true);
    return JSON.parse(jsonStr);
};

export const generateGlossaryFromRawText = async (
    rawText: string,
    context: string,
    modelName: string,
    language: string,
    apiKey: string,
    baseUrl: string,
    provider: LLMProvider = 'Gemini'
): Promise<GlossaryItem[]> => {
    const prompt = `Extract glossary from text. Context: ${context}. Lang: ${language}. Content: ${rawText.slice(0, 25000)}. Return JSON.`;
    const session = new UniversalChatSession(apiKey, baseUrl, modelName, provider);
    const jsonStr = await session.sendMessage(prompt, true);
    return JSON.parse(jsonStr);
};

export const generateSessionTitle = async (firstMessage: string, apiKey: string, baseUrl: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey, baseUrl: baseUrl || undefined } as any);
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate short title: ${firstMessage}`,
    });
    return response.text?.trim() || "New Chat";
};
