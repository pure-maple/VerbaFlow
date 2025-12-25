
import { SubtitleItem } from "../types";

// --- Time Helpers ---

// Convert "00:00:01,000" (SRT) or "00:00:01.000" (VTT) to seconds
const timeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;
  // Remove all spaces to handle loose formatting like "00 : 01 : 23"
  const normalized = timeString.replace(/\s/g, '').replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 3) {
    // HH:MM:SS.ms
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    // MM:SS.ms
    const [m, s] = parts;
    return parseInt(m) * 60 + parseFloat(s);
  }
  return 0;
};

// Convert ASS time "1:23:45.67" to seconds
const assTimeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;
  const parts = timeString.trim().split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  }
  return 0;
};

export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  // Optional: add milliseconds if needed for high precision UI, currently H:M:S
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const parseFlexibleTime = (input: string): number | null => {
    const normalized = input.replace(/：/g, ':').trim();
    const parts = normalized.split(':');
    if (parts.some(p => isNaN(parseFloat(p)))) return null;

    let seconds = 0;
    if (parts.length === 3) {
        seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
        seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 1) {
        seconds = parseFloat(parts[0]);
    } else {
        return null;
    }
    return seconds;
};

export const extractStartTimeFromRange = (range: string): number => {
  if (!range) return 0;
  // Clean spaces first to handle formats like "00: 16 : 13 , 020"
  const cleanRange = range.replace(/\s/g, ''); 
  // Regex looks for HH:MM:SS,mmm or MM:SS.ms
  const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)/;
  const match = cleanRange.match(timePattern);
  
  if (match && match[0]) {
      return timeToSeconds(match[0]);
  }
  return 0;
};

// --- Parsers ---

const parseSRT = (content: string): SubtitleItem[] => {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;

    // Line 1: ID (sometimes optional in loose SRTs, but standard has it)
    // Line 2: Time
    // Line 3+: Text
    
    let id = "";
    let timeLine = "";
    let textLines: string[] = [];

    // Heuristic: Check if first line is a number
    if (/^\d+$/.test(lines[0]) && lines[1] && lines[1].includes('-->')) {
        id = lines[0];
        timeLine = lines[1];
        textLines = lines.slice(2);
    } else if (lines[0].includes('-->')) {
        // Missing ID
        timeLine = lines[0];
        textLines = lines.slice(1);
    } else {
        return null;
    }

    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    
    return {
      id: id || Math.random().toString(36).substr(2, 9),
      startTime: timeToSeconds(startStr),
      endTime: timeToSeconds(endStr),
      text: textLines.join(' ')
    };
  }).filter((item): item is SubtitleItem => item !== null);
};

const parseVTT = (content: string): SubtitleItem[] => {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const items: SubtitleItem[] = [];
  
  let currentItem: Partial<SubtitleItem> = {};
  let buffer: string[] = [];
  
  // Skip WEBVTT header
  let i = 0;
  while(i < lines.length && !lines[i].includes('-->')) {
      i++;
  }

  // Backtrack one line if it was an ID
  if (i > 0 && lines[i-1].trim() !== "" && lines[i-1].trim() !== "WEBVTT") {
      i--;
  }

  for (; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('-->')) {
          // If we have a buffer from previous, push it
          if (currentItem.startTime !== undefined && buffer.length > 0) {
              items.push({
                  id: currentItem.id || (items.length + 1).toString(),
                  startTime: currentItem.startTime,
                  endTime: currentItem.endTime!,
                  text: buffer.join(' ')
              });
              buffer = [];
              currentItem = {};
          }

          const [startStr, endStr] = line.split('-->').map(s => s.trim());
          currentItem.startTime = timeToSeconds(startStr);
          currentItem.endTime = timeToSeconds(endStr.split(' ')[0]); // VTT might have settings after time
      } else if (line === '') {
          // Block separator
          if (currentItem.startTime !== undefined && buffer.length > 0) {
              items.push({
                  id: currentItem.id || (items.length + 1).toString(),
                  startTime: currentItem.startTime,
                  endTime: currentItem.endTime!,
                  text: buffer.join(' ')
              });
              buffer = [];
              currentItem = {};
          }
      } else {
          // Text or ID
          // If we don't have a start time yet, this might be an ID
          if (currentItem.startTime === undefined) {
              currentItem.id = line;
          } else {
              buffer.push(line);
          }
      }
  }
  
  // Push last
  if (currentItem.startTime !== undefined && buffer.length > 0) {
      items.push({
          id: currentItem.id || (items.length + 1).toString(),
          startTime: currentItem.startTime,
          endTime: currentItem.endTime!,
          text: buffer.join(' ')
      });
  }

  return items;
};

const parseASS = (content: string): SubtitleItem[] => {
    const items: SubtitleItem[] = [];
    const lines = content.split(/\r?\n/);
    
    let formatSpec: string[] = [];
    let inEvents = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '[Events]') {
            inEvents = true;
            continue;
        }
        if (!inEvents) continue;

        if (trimmed.startsWith('Format:')) {
            formatSpec = trimmed.substring(7).split(',').map(s => s.trim().toLowerCase());
        } else if (trimmed.startsWith('Dialogue:')) {
            if (formatSpec.length === 0) {
                // Default fallback if Format line missing (rare)
                formatSpec = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
            }
            
            const contentStr = trimmed.substring(9).trim();
            // ASS CSV parsing is tricky because Text field can contain commas.
            // We split by comma only for the number of Format fields minus 1.
            const parts: string[] = [];
            let currentPart = "";
            let commasFound = 0;
            const limit = formatSpec.length - 1;

            for (let i = 0; i < contentStr.length; i++) {
                if (contentStr[i] === ',' && commasFound < limit) {
                    parts.push(currentPart.trim());
                    currentPart = "";
                    commasFound++;
                } else {
                    currentPart += contentStr[i];
                }
            }
            parts.push(currentPart.trim()); // The Text part

            const startIdx = formatSpec.indexOf('start');
            const endIdx = formatSpec.indexOf('end');
            const textIdx = formatSpec.indexOf('text');

            if (startIdx !== -1 && endIdx !== -1 && textIdx !== -1) {
                const startTime = assTimeToSeconds(parts[startIdx]);
                const endTime = assTimeToSeconds(parts[endIdx]);
                let text = parts[textIdx] || "";
                
                // Remove ASS tags like {\pos(400,570)}
                text = text.replace(/\{.*?\}/g, '').replace(/\\N/g, ' ').trim();

                if (text) {
                    items.push({
                        id: (items.length + 1).toString(),
                        startTime,
                        endTime,
                        text
                    });
                }
            }
        }
    }
    return items;
};

const parseJSON = (content: string): SubtitleItem[] => {
    try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            return data.map((item: any, i) => ({
                id: item.id || i.toString(),
                startTime: typeof item.startTime === 'number' ? item.startTime : timeToSeconds(item.startTime || ''),
                endTime: typeof item.endTime === 'number' ? item.endTime : timeToSeconds(item.endTime || ''),
                text: item.text || item.content || ''
            })).filter(i => i.text);
        }
        return [];
    } catch (e) {
        console.error("JSON parse failed", e);
        return [];
    }
};

// --- Public API ---

export const detectSubtitleFormat = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.startsWith('WEBVTT')) return 'vtt';
  if (trimmed.includes('[Script Info]') || trimmed.includes('[Events]')) return 'ass';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'srt'; // Default assume SRT
};

export const parseSubtitleToObjects = (content: string): SubtitleItem[] => {
  const format = detectSubtitleFormat(content);
  switch (format) {
    case 'vtt': return parseVTT(content);
    case 'ass': return parseASS(content);
    case 'json': return parseJSON(content);
    case 'srt':
    default: return parseSRT(content);
  }
};

export const isValidSubtitleFormat = (content: string, format: string): { valid: boolean; error?: string } => {
    try {
        const items = parseSubtitleToObjects(content);
        // Basic check: must have parsed items and text
        if (items.length > 0 && items[0].text) return { valid: true };
        return { valid: false, error: "Parsed content is empty or invalid structure" };
    } catch (e: any) {
        return { valid: false, error: e.message || "Syntax error" };
    }
};

export const getContextFromSRT = (subtitles: SubtitleItem[], timeRange: string, bufferLines = 2): string => {
    const startSec = extractStartTimeFromRange(timeRange);
    const index = subtitles.findIndex(s => s.startTime <= startSec && s.endTime >= startSec);
    
    if (index === -1) return "Context not found.";

    const startIdx = Math.max(0, index - bufferLines);
    const endIdx = Math.min(subtitles.length - 1, index + bufferLines);
    
    return subtitles.slice(startIdx, endIdx + 1).map(s => 
        `[${formatTime(s.startTime)}] ${s.text}`
    ).join('\n');
};
