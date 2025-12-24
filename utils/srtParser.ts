import { SubtitleItem } from "../types";

export const parseSRT = (content: string): string => {
  return content;
};

// Convert "00:00:01,000" to seconds (float)
const timeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;
  const parts = timeString.trim().split(':');
  if (parts.length < 3) return 0;
  
  const [h, m, sWithMs] = parts;
  const [s, ms] = sWithMs.split(',');
  
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms || '0') / 1000;
};

export const parseSRTToObjects = (content: string): SubtitleItem[] => {
  const normalized = content.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  
  return blocks.map(block => {
    const lines = block.split('\n');
    if (lines.length < 3) return null;

    const id = lines[0];
    const timeLine = lines[1];
    const [startStr, endStr] = timeLine.split(' --> ');
    
    // Join remaining lines as text
    const text = lines.slice(2).join(' ');

    return {
      id,
      startTime: timeToSeconds(startStr),
      endTime: timeToSeconds(endStr),
      text
    };
  }).filter((item): item is SubtitleItem => item !== null);
};

export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Helper to extract start seconds from range string like "00:01:20-00:01:25"
export const extractStartTimeFromRange = (range: string): number => {
  const startPart = range.split('-')[0];
  if (!startPart) return 0;
  // Gemini might return HH:MM:SS or just MM:SS, normalize it
  const parts = startPart.trim().split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
};
