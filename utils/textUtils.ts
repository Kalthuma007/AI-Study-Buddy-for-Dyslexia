
import { WordToken } from '../types';

/**
 * Tokenizes the simplified text and estimates timing for each word based on audio duration.
 * This handles the {{highlighted term}} syntax.
 */
export const generateWordTokens = (text: string, audioDuration: number): WordToken[] => {
  if (!text) return [];

  // 1. Clean the text to get the "spoken" length for calculation
  const cleanText = text.replace(/\{\{/g, '').replace(/\}\}/g, '');
  const totalChars = cleanText.length;
  
  if (totalChars === 0 || audioDuration === 0) return [];

  const charDuration = audioDuration / totalChars;

  const tokens: WordToken[] = [];
  let currentTime = 0;
  let runningId = 0;

  // Regex breakdown:
  // 1. `\{\{.*?\}\}` matches terms like {{complex word}}
  // 2. `[\w']+` matches standard words like "Hello", "it's"
  // 3. `[^\w\s{}]+` matches punctuation like ".", ",", "?"
  // 4. `\s+` matches whitespace (we consume it but don't create visual tokens usually, or attach to prev)
  
  const regex = /(\{\{.*?\}\})|([\w']+)|([^\w\s{}]+)|(\s+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const matchIndex = match.index;
    
    const isTermGroup = match[1] !== undefined; // {{...}}
    const isWord = match[2] !== undefined;      // Word
    const isPunctuation = match[3] !== undefined; // Punctuation
    const isSpace = match[4] !== undefined;

    if (isSpace) {
      currentTime += fullMatch.length * charDuration;
      continue; 
    }

    if (isTermGroup) {
      // Handle {{term}}
      // Strip braces for display and timing
      const innerContent = fullMatch.replace(/\{\{/g, '').replace(/\}\}/g, '');
      
      const duration = innerContent.length * charDuration;
      tokens.push({
        id: `token-${runningId++}`,
        text: innerContent,
        isTerm: true,
        startTime: currentTime,
        endTime: currentTime + duration,
        charStart: matchIndex,
        charEnd: matchIndex + fullMatch.length
      });
      currentTime += duration;
      continue;
    }

    if (isWord) {
      const duration = fullMatch.length * charDuration;
      tokens.push({
        id: `token-${runningId++}`,
        text: fullMatch,
        isTerm: false, // It's a normal word
        startTime: currentTime,
        endTime: currentTime + duration,
        charStart: matchIndex,
        charEnd: matchIndex + fullMatch.length
      });
      currentTime += duration;
      continue;
    }

    if (isPunctuation) {
      const duration = fullMatch.length * charDuration;
      tokens.push({
        id: `token-${runningId++}`,
        text: fullMatch,
        isTerm: false,
        startTime: currentTime,
        endTime: currentTime + duration,
        charStart: matchIndex,
        charEnd: matchIndex + fullMatch.length
      });
      currentTime += duration;
    }
  }

  return tokens;
};
