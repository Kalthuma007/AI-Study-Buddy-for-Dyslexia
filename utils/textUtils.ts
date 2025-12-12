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
  
  // We want to preserve spaces for rendering, but usually we render tokens separated by space in HTML.
  // Let's iterate through the string to preserve order.
  
  const regex = /(\{\{.*?\}\})|([\w']+)|([^\w\s{}]+)|(\s+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const isTermGroup = match[1] !== undefined; // {{...}}
    const isWord = match[2] !== undefined;      // Word
    const isPunctuation = match[3] !== undefined; // Punctuation
    const isSpace = match[4] !== undefined;

    if (isSpace) {
      // Advance time for spaces? Usually speech pauses slightly or continues.
      // A simple linear estimation often works better if we count space chars in the "charDuration" calculation
      // (which we did, because cleanText includes spaces).
      // So we just advance time but produce no visual token (or a space token).
      // For the UI, we usually just put spaces between spans.
      currentTime += fullMatch.length * charDuration;
      continue; 
    }

    if (isTermGroup) {
      // Handle {{term}}
      // Strip braces for display and timing
      const innerContent = fullMatch.replace(/\{\{/g, '').replace(/\}\}/g, '');
      
      // We might want to split the inner content into words if it's a phrase "machine learning"
      const innerWords = innerContent.split(/(\s+)/);
      
      innerWords.forEach(part => {
        if (!part.trim()) {
           currentTime += part.length * charDuration;
           return;
        }
        
        const duration = part.length * charDuration;
        tokens.push({
          id: `token-${runningId++}`,
          text: part,
          isTerm: true,
          startTime: currentTime,
          endTime: currentTime + duration
        });
        currentTime += duration;
      });
      continue;
    }

    if (isWord) {
      const duration = fullMatch.length * charDuration;
      tokens.push({
        id: `token-${runningId++}`,
        text: fullMatch,
        isTerm: false, // It's a normal word
        startTime: currentTime,
        endTime: currentTime + duration
      });
      currentTime += duration;
      continue;
    }

    if (isPunctuation) {
      // Attach punctuation time to the previous token if possible, or just advance time
      // Ideally, punctuation "consumes" time but isn't usually highlighted separately 
      // unless we want strict char mapping.
      // Let's create a token for it so it renders, but maybe with 0 duration overlapping previous?
      // Or just give it its time.
      const duration = fullMatch.length * charDuration;
      tokens.push({
        id: `token-${runningId++}`,
        text: fullMatch,
        isTerm: false,
        startTime: currentTime,
        endTime: currentTime + duration
      });
      currentTime += duration;
    }
  }

  return tokens;
};