
import { GoogleGenAI, Type, Schema, Chat, Part } from "@google/genai";
import { AnalysisResult, VocabItem, GlossaryItem } from "../types";
import { LLMProvider } from "../contexts/ConfigContext";

const SYSTEM_INSTRUCTION = `
You are a professional audio/video content proofreading expert and terminology manager.
Your goal is to assist users in proofreading, organizing audio transcripts, and managing technical glossaries.

Principles:
1. Integrity First: 100% of the content must be preserved unless asking for metadata.
2. Timestamp Accuracy: Adhere strictly to the provided SRT.
3. Proofreading: Correct typos, proper nouns, and technical terms.
4. Contextual Awareness: Use provided glossaries and extra context instructions.

Status Logic for 'vocabList':
- Use "corrected": When you are confident the term needs fixing based on context/glossary.
- Use "needs_confirmation": When the term is ambiguous, might be a proper noun, or you are unsure and want the HUMAN to check.
- Use "check_spelling": For simple typos.
- STRICT RULE: DO NOT output "ai_recheck" or "custom" in your initial analysis. These statuses are reserved for the user to signal YOU to review specific items later.
`;

export const DEFAULT_CHAT_SYSTEM_INSTRUCTION = `
You are VerbaFlow's intelligent assistant.
Your Identity & Capabilities:
1. **General Assistant**: Answer questions, explain concepts, write code.
2. **Context Aware**: You know the user is working on subtitles/translation.
3. **Helper**: Explain grammar, define terms, offer translation suggestions.
Tone: Helpful, Professional, yet Conversational.
`;

// Schema for Analysis Result
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING },
        speakers: { type: Type.ARRAY, items: { type: Type.STRING } },
        duration: { type: Type.STRING },
        agenda: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["topic", "speakers", "duration", "agenda"]
    },
    vocabList: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          timeRange: { type: Type.STRING },
          original: { type: Type.STRING },
          corrected: { type: Type.STRING },
          type: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['corrected', 'needs_confirmation', 'check_spelling', 'custom', 'ai_recheck'] },
          aiReason: { type: Type.STRING },
          userNote: { type: Type.STRING, nullable: true },
          customStatus: { type: Type.STRING, nullable: true }
        },
        required: ["id", "timeRange", "original", "corrected", "type", "status", "aiReason"]
      }
    }
  },
  required: ["summary", "vocabList"]
};

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
 * Helper to safely extract and parse JSON from LLM output
 */
const safeParseJSON = <T>(text: string): T => {
    let cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    // Some models might output "Here is the JSON:" prefix
    const firstCurly = cleaned.indexOf('{');
    const firstSquare = cleaned.indexOf('[');
    
    // Attempt to find the start of JSON structure
    let start = -1;
    if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) start = firstCurly;
    else if (firstSquare !== -1) start = firstSquare;

    if (start !== -1) {
        // Find the last closing bracket
        const lastCurly = cleaned.lastIndexOf('}');
        const lastSquare = cleaned.lastIndexOf(']');
        let end = -1;
        if (lastCurly !== -1 && lastCurly > start) end = lastCurly;
        if (lastSquare !== -1 && lastSquare > end) end = lastSquare;
        
        if (end !== -1) {
            cleaned = cleaned.substring(start, end + 1);
        }
    }

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON Parse Error Input:", text);
        throw new Error("Failed to parse AI response as JSON. The model output might be incomplete.");
    }
};

/**
 * Universal Chat Session Interface
 */
class UniversalChatSession {
    private provider: LLMProvider;
    private apiKey: string;
    private baseUrl: string;
    private modelName: string;
    private googleChat: Chat | null = null;
    private systemInstruction: string;
    // For OpenAI/Anthropic history management (basic)
    private messages: any[] = []; 

    constructor(apiKey: string, baseUrl: string, modelName: string, provider: LLMProvider, systemInstruction?: string) {
        this.apiKey = apiKey;
        this.baseUrl = resolveBaseUrl(provider, baseUrl);
        this.modelName = modelName;
        this.provider = provider;
        this.systemInstruction = systemInstruction || DEFAULT_CHAT_SYSTEM_INSTRUCTION;

        if (this.provider === 'Gemini') {
            const ai = new GoogleGenAI({ apiKey, baseUrl: this.baseUrl || undefined } as any);
            this.googleChat = ai.chats.create({
                model: modelName,
                config: { systemInstruction: this.systemInstruction }
            });
        }
    }

    /**
     * Unified streaming method
     * Note: For Analysis, we often use single-turn generation (generateContent) instead of chat,
     * but this class supports conversational flows.
     */
    async sendMessageStream(prompt: string, onChunk: (text: string) => void, isJsonMode: boolean = false): Promise<string> {
        let fullText = "";

        if (this.provider === 'Gemini') {
            // For Chat Widget
            const result = await this.googleChat!.sendMessageStream({ message: prompt });
            for await (const chunk of result) {
                const text = chunk.text || "";
                fullText += text;
                onChunk(text);
            }
        } 
        else if (this.provider === 'OpenAI') {
            // Basic OpenAI Stream Implementation
            const msgs = [
                { role: "system", content: this.systemInstruction + (isJsonMode ? "\nReturn JSON only." : "") },
                ...this.messages,
                { role: "user", content: prompt }
            ];
            
            const body: any = {
                model: this.modelName,
                messages: msgs,
                stream: true
            };
            if (isJsonMode) body.response_format = { type: "json_object" };

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify(body)
            });

            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const json = JSON.parse(line.slice(6));
                            const content = json.choices[0]?.delta?.content || "";
                            fullText += content;
                            onChunk(content);
                        } catch (e) {}
                    }
                }
            }
            this.messages.push({ role: "user", content: prompt });
            this.messages.push({ role: "assistant", content: fullText });
        }
        else if (this.provider === 'Anthropic') {
             // Basic Anthropic Implementation
             // (Simplified for brevity, assuming standard messages endpoint)
             const body = {
                 model: this.modelName,
                 messages: [...this.messages, { role: "user", content: prompt }],
                 system: this.systemInstruction + (isJsonMode ? "\nReturn JSON only." : ""),
                 stream: true,
                 max_tokens: 4096
             };
             
             const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify(body)
            });
            
            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.slice(6));
                            if (json.type === 'content_block_delta' && json.delta?.text) {
                                fullText += json.delta.text;
                                onChunk(json.delta.text);
                            }
                        } catch (e) {}
                    }
                }
            }
            this.messages.push({ role: "user", content: prompt });
            this.messages.push({ role: "assistant", content: fullText });
        }

        return fullText;
    }
}

/**
 * AnalysisSession Class
 * Manages the specific analysis logic
 */
export class AnalysisSession {
    private apiKey: string;
    private baseUrl: string;
    private modelName: string;
    private provider: LLMProvider;
    private history: any[] = []; // Store conversation context manually

    constructor(apiKey: string, baseUrl: string, modelName: string, provider: LLMProvider) {
        this.apiKey = apiKey;
        this.baseUrl = resolveBaseUrl(provider, baseUrl);
        this.modelName = modelName;
        this.provider = provider;
    }

    async start(
        srtContent: string | null,
        mediaParts: Part[],
        language: string, 
        glossary?: GlossaryItem[],
        extraContext?: string,
        onStreamUpdate?: (partial: string) => void
    ): Promise<AnalysisResult> {
        
        let prompt = `Step 2 - Preliminary Proofreading (Initial Analysis).\n`;
        prompt += `IMPORTANT: The 'summary' field (topic, agenda, speakers) MUST be written in ${language}.\n`;
        
        if (glossary && glossary.length > 0) {
            prompt += `\nGlossary:\n${glossary.map(g => `- ${g.term}: ${g.definition}`).join('\n')}`;
        }
        if (extraContext) prompt += `\nInstructions: "${extraContext}"`;
        prompt += `\n\nTask: Generate summary and identify terms/corrections.`;
        
        // For Gemini, we use Schema. For others, we prompt textually.
        if (this.provider === 'Gemini') {
             prompt += ` Return valid JSON matching the provided schema.`;
        } else {
             prompt += ` Return ONLY valid JSON with this structure: { "summary": { "topic": "", "speakers": [], "duration": "", "agenda": [] }, "vocabList": [{ "id": 1, "timeRange": "", "original": "", "corrected": "", "type": "", "status": "corrected", "aiReason": "" }] }`;
        }
        
        const contentPart = srtContent ? `\nSubtitle Content:\n${srtContent.slice(0, 50000)}` : "(No subtitle provided)";
        
        const fullPrompt = SYSTEM_INSTRUCTION + "\n\n" + prompt + contentPart;
        this.history.push({ role: 'user', content: fullPrompt });

        let fullText = "";

        if (this.provider === 'Gemini') {
            const ai = new GoogleGenAI({ apiKey: this.apiKey, baseUrl: this.baseUrl || undefined } as any);
            const result = await ai.models.generateContentStream({
                model: this.modelName,
                contents: [
                    { role: 'user', parts: [{ text: fullPrompt }] }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: ANALYSIS_SCHEMA, 
                }
            });

            for await (const chunk of result) {
                const text = chunk.text || "";
                fullText += text;
                if (onStreamUpdate) onStreamUpdate(text);
            }
        } else {
            // Universal Fallback for OpenAI/Anthropic
            // Use SYSTEM_INSTRUCTION for analysis, not the default chat one
            const session = new UniversalChatSession(this.apiKey, this.baseUrl, this.modelName, this.provider, SYSTEM_INSTRUCTION);
            fullText = await session.sendMessageStream(prompt + contentPart, (chunk) => {
                if (onStreamUpdate) onStreamUpdate(chunk);
            }, true); // force JSON mode
        }
        
        this.history.push({ role: 'model', content: fullText });
        return safeParseJSON<AnalysisResult>(fullText);
    }

    async iterate(
        currentVocab: VocabItem[],
        newInstruction: string,
        language: string,
        activeGlossaryItems: GlossaryItem[] = [],
        onStreamUpdate?: (partial: string) => void
    ): Promise<AnalysisResult> {
        
        const previousContext = this.history.map(h => h.content).join('\n---\n');
        const currentStatus = currentVocab.map(v => 
            `ID: ${v.id} | Original: "${v.original}" | UserCorrected: "${v.corrected}"`
        ).join('\n');

        let prompt = `
        Previous Context: ${previousContext.slice(-20000)}
        
        Step 2.1 - Re-analysis:
        New Instructions: "${newInstruction}"
        Language: ${language}
        Current Table:
        ${currentStatus}
        
        Return the FULL updated list as JSON.
        `;

        if (this.provider !== 'Gemini') {
             prompt += ` Return ONLY valid JSON following the previous structure.`;
        }

        let fullText = "";

        if (this.provider === 'Gemini') {
            const ai = new GoogleGenAI({ apiKey: this.apiKey, baseUrl: this.baseUrl || undefined } as any);
            const result = await ai.models.generateContentStream({
                model: this.modelName,
                contents: [{ role: 'user', parts: [{ text: SYSTEM_INSTRUCTION + "\n\n" + prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: ANALYSIS_SCHEMA,
                }
            });

            for await (const chunk of result) {
                const text = chunk.text || "";
                fullText += text;
                if (onStreamUpdate) onStreamUpdate(text);
            }
        } else {
            // Universal Fallback
            const session = new UniversalChatSession(this.apiKey, this.baseUrl, this.modelName, this.provider, SYSTEM_INSTRUCTION);
            fullText = await session.sendMessageStream(prompt, (chunk) => {
                if (onStreamUpdate) onStreamUpdate(chunk);
            }, true);
        }

        return safeParseJSON<AnalysisResult>(fullText);
    }
}

// Re-export other functions

export const chatWithAgent = async (
  history: { role: string, parts: { text: string }[] }[],
  message: string,
  modelName: string,
  apiKey: string,
  baseUrl: string,
  onChunk: (text: string) => void,
  systemInstruction?: string
) => {
    let provider: LLMProvider = 'Gemini';
    if (modelName.startsWith('gpt')) provider = 'OpenAI';
    if (modelName.startsWith('claude')) provider = 'Anthropic';

    const session = new UniversalChatSession(apiKey, baseUrl, modelName, provider, systemInstruction);
    
    if (provider === 'Gemini') {
        const ai = new GoogleGenAI({ apiKey, baseUrl: baseUrl || undefined } as any);
        const chat = ai.chats.create({
            model: modelName,
            history: history, 
            config: { systemInstruction: systemInstruction || DEFAULT_CHAT_SYSTEM_INSTRUCTION }
        });
        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
            if (chunk.text) onChunk(chunk.text);
        }
    } else {
        let fullPrompt = history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n') + `\nuser: ${message}`;
        await session.sendMessageStream(fullPrompt, onChunk);
    }
};

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
  
  Strictly output content only. NO conversational filler (e.g. "Here is the refined subtitle").
  Input Subtitle (${format}):
  ${content}
  `;

  // Note: For task-specific generations, use default instruction or empty
  const session = new UniversalChatSession(apiKey, baseUrl, modelName, provider);
  await session.sendMessageStream(prompt, onChunk);
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
  
  Strictly output content only. NO conversational filler (e.g. "Here is the transcript").
  Subtitle Content:
  ${srtContent}
  `;

  const session = new UniversalChatSession(apiKey, baseUrl, modelName, provider);
  await session.sendMessageStream(prompt, onChunk);
};

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
  
  const session = new UniversalChatSession(apiKey, baseUrl, modelName, provider);
  const text = await session.sendMessageStream(prompt, () => {}, true);
  return safeParseJSON<GlossaryItem[]>(text || "[]");
};

export const fixVocabTimestamps = async (
    srtContent: string,
    vocabList: VocabItem[],
    apiKey: string,
    baseUrl: string,
    provider: LLMProvider = 'Gemini'
): Promise<VocabItem[]> => {
    const prompt = `Calibrate Timestamps. Return JSON array [{id, timeRange}]. Input: ${JSON.stringify(vocabList.map(v => ({id: v.id, original: v.original})))}. SRT: ${srtContent.slice(0, 30000)}`;
    const session = new UniversalChatSession(apiKey, baseUrl, 'gemini-3-flash-preview', provider);
    const text = await session.sendMessageStream(prompt, () => {}, true);
    return safeParseJSON<VocabItem[]>(text || "[]");
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
    const text = await session.sendMessageStream(prompt, () => {}, true);
    return safeParseJSON<GlossaryItem[]>(text || "[]");
};

export const generateSessionTitle = async (firstMessage: string, apiKey: string, baseUrl: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey, baseUrl: baseUrl || undefined } as any);
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a very short, concise title (max 5 words) for this conversation based on the first message: "${firstMessage.slice(0, 200)}". Output the title only.`,
    });
    return response.text?.trim() || "New Chat";
};
