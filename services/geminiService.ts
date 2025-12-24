import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, VocabItem, ChatSession, GlossaryItem } from "../types";

// Helper to get client with dynamic config
const getClient = (apiKey: string, baseUrl?: string) => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }
  
  // Support for third-party proxies (OpenRouter, AI HubMix, etc.)
  const options: any = { apiKey };
  if (baseUrl && baseUrl.trim() !== "") {
    options.baseUrl = baseUrl; 
  }

  return new GoogleGenAI(options);
};

const SYSTEM_INSTRUCTION = `
You are a professional audio/video content proofreading expert and terminology manager.
Your goal is to assist users in proofreading, organizing audio transcripts, and managing technical glossaries.

Principles:
1. Integrity First: 100% of the content must be preserved unless asking for metadata.
2. Timestamp Accuracy: Adhere strictly to the provided SRT.
3. Proofreading: Correct typos, proper nouns, and technical terms.
4. Contextual Awareness: Use provided glossaries and extra context instructions.
`;

// --- ANALYSIS ---

export const analyzeSRTContent = async (
  srtContent: string, 
  modelName: string, 
  language: string,
  apiKey: string,
  baseUrl: string,
  extraContext?: string,
  glossary?: GlossaryItem[]
): Promise<AnalysisResult> => {
  const ai = getClient(apiKey, baseUrl);
  
  let glossaryPrompt = "";
  if (glossary && glossary.length > 0) {
    glossaryPrompt = `
    Use the following Glossary strictly for terminology consistency:
    ${glossary.map(g => `- ${g.term}: ${g.definition}`).join('\n')}
    `;
  }

  let userContextPrompt = "";
  if (extraContext) {
    userContextPrompt = `
    User Instructions/Extra Context:
    "${extraContext}"
    `;
  }

  const prompt = `
  Step 2 - Preliminary Proofreading:
  Analyze the following SRT content.
  
  IMPORTANT: The output values (summary text, type descriptions) MUST be in ${language}.
  
  ${glossaryPrompt}
  ${userContextPrompt}

  1. Generate a brief summary (Topic, Speakers, Core Issues).
  2. Identify ALL proper nouns (Names, Companies, Products, Tech Terms, etc.) that need checking.
  
  SRT Content:
  ${srtContent.slice(0, 30000)} ${srtContent.length > 30000 ? "...(truncated for analysis)" : ""}
  `;

  const vocabItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      timeRange: { type: Type.STRING },
      original: { type: Type.STRING },
      corrected: { type: Type.STRING },
      type: { type: Type.STRING },
      status: { type: Type.STRING, enum: ['corrected', 'needs_confirmation', 'check_spelling'] },
      remarks: { type: Type.STRING, description: "Reason for correction or note" }
    },
    required: ["id", "timeRange", "original", "corrected", "type", "status"]
  };

  const responseSchema: Schema = {
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
        items: vocabItemSchema
      }
    },
    required: ["summary", "vocabList"]
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  if (!response.text) throw new Error("No response from Gemini");
  return JSON.parse(response.text) as AnalysisResult;
};

// --- GLOSSARY ---

export const generateSmartGlossary = async (
  srtContent: string,
  vocabList: VocabItem[],
  modelName: string,
  language: string,
  apiKey: string,
  baseUrl: string
): Promise<GlossaryItem[]> => {
  const ai = getClient(apiKey, baseUrl);
  const vocabText = vocabList.map(v => `${v.corrected} (${v.type})`).join(', ');

  const prompt = `
  Analyze the SRT content and the corrected vocabulary list.
  Generate a professional glossary of key technical terms, proper nouns, and important entities.
  
  Rules:
  1. Deduplicate terms.
  2. Provide a contextual definition/explanation for how the term is used in this specific content.
  3. Output language for definitions: ${language}.
  
  Vocabulary Hints: ${vocabText}
  
  SRT Content Preview:
  ${srtContent.slice(0, 20000)}
  `;

  const glossarySchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        term: { type: Type.STRING },
        definition: { type: Type.STRING },
        context: { type: Type.STRING }
      },
      required: ["id", "term", "definition"]
    }
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: glossarySchema
    }
  });

  if (!response.text) throw new Error("Failed to generate glossary");
  return JSON.parse(response.text) as GlossaryItem[];
};

// --- SRT GENERATION ---

export const generatePolishedSRT = async (
  srtContent: string,
  confirmedVocab: VocabItem[],
  modelName: string,
  apiKey: string,
  baseUrl: string,
  onChunk: (text: string) => void
) => {
  const ai = getClient(apiKey, baseUrl);
  const vocabString = confirmedVocab.map(v => 
    `- Original: "${v.original}" -> Corrected: "${v.corrected}"`
  ).join('\n');

  const prompt = `
  Task: Reword and Polish the SRT content.
  
  Strict Constraint:
  1. KEEP THE SRT FORMAT EXACTLY (Sequence #, Timecode, Text).
  2. DO NOT CHANGE TIMECODES.
  3. Apply these corrections:
  ${vocabString}
  
  Input SRT:
  ${srtContent}
  `;

  const result = await ai.models.generateContentStream({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION
    }
  });

  for await (const chunk of result) {
    if (chunk.text) onChunk(chunk.text);
  }
};

// --- MARKDOWN TRANSCRIPT GENERATION ---

export const generateFinalTranscript = async (
  srtContent: string, 
  confirmedVocab: VocabItem[],
  modelName: string,
  language: string,
  apiKey: string,
  baseUrl: string,
  onChunk: (text: string) => void
) => {
  const ai = getClient(apiKey, baseUrl);
  const vocabString = confirmedVocab.map(v => 
    `- Original: "${v.original}" -> Corrected: "${v.corrected}" (${v.type})`
  ).join('\n');

  const prompt = `
  Step 5 - Generate Refined Transcript
  Task: Rewrite into a clean, readable Article/Script format.
  Target Language: ${language}
  
  Rules:
  1. Remove timestamps.
  2. Group into paragraphs by speaker/topic.
  3. Apply corrections:
  ${vocabString}
  
  SRT Content:
  ${srtContent}
  `;

  const result = await ai.models.generateContentStream({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    }
  });

  for await (const chunk of result) {
    if (chunk.text) onChunk(chunk.text);
  }
};

// --- CHAT AGENT ---

const CHAT_SYSTEM_INSTRUCTION = `
You are VerbaFlow's intelligent assistant, powered by Gemini. 
You are integrated into a professional audio/video proofreading application called "VerbaFlow".

Your Identity & Capabilities:
1. **General Assistant**: You can answer ANY broad question, explain complex concepts, write code, or chat casually, just like a standard LLM.
2. **Context Aware**: You know the user is likely working on subtitles, translation, or content creation.
3. **Helper**: You can help explain specific grammar errors, define obscure technical terms found in their audio, or offer translation suggestions.

Tone: Helpful, Professional, yet Conversational.
`;

export const chatWithAgent = async (
  history: { role: string, parts: { text: string }[] }[],
  message: string,
  modelName: string,
  apiKey: string,
  baseUrl: string,
  onChunk: (text: string) => void
) => {
  const ai = getClient(apiKey, baseUrl);
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

export const generateSessionTitle = async (firstMessage: string, apiKey: string, baseUrl: string): Promise<string> => {
  const ai = getClient(apiKey, baseUrl);
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a very short title (max 4 words) for a conversation starting with: "${firstMessage}"`,
  });
  return response.text?.trim() || "New Chat";
};
