import { GoogleGenAI, Modality, Type } from "@google/genai";
import { SimplificationResult, SimplificationLevel, SupportedLanguage, TeacherMaterial } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

/**
 * Simplifies text using Gemini 2.5 Flash based on the selected level.
 */
export const simplifyText = async (
  text: string, 
  level: SimplificationLevel = SimplificationLevel.LEVEL_1,
  targetLanguage: SupportedLanguage = 'English'
): Promise<SimplificationResult> => {
  try {
    let instructions = `
    STRICT OUTPUT RULES:
    1. Return PLAIN TEXT only. 
    2. Do NOT use HTML tags (e.g., no <ul>, <li>, <b>, <strong>).
    3. Do NOT use Markdown bolding (e.g., no **text**).
    `;

    // Define bullet style based on language
    let bulletStyleInstruction = "numbers (1., 2., 3.)"; // Default fallback
    
    if (targetLanguage === 'English') {
      bulletStyleInstruction = "numbers (1., 2., 3.) or letters (a., b., c.)";
    } else if (targetLanguage === 'Arabic') {
      bulletStyleInstruction = "Arabic numerals (١.، ٢.، ٣.) or dots (•)";
    } else if (targetLanguage === 'Spanish') {
      bulletStyleInstruction = "numbers (1., 2., 3.)";
    } else if (targetLanguage === 'Chinese') {
      bulletStyleInstruction = "circles (○) or numbers";
    } else if (targetLanguage === 'Somali') {
      // Specific rule for Somali: Use dots, forbid dashes
      bulletStyleInstruction = "dots (•). Do NOT use dashes (-)";
    }

    switch (level) {
      case SimplificationLevel.LEVEL_3: // Ultra-Short
        instructions += `
        LEVEL 3 (Ultra-Short) Rules:
        1. Provide ONLY an ultra-short, one-sentence summary of the main point.
        2. Discard all non-essential details.
        3. The 'simplified' output must be this single sentence.
        4. The 'summary' field should also be this single sentence.
        5. Highlight only the most important concept (1-2 words) in the sentence using {{term}}. Avoid highlighting common words.
        `;
        break;
      case SimplificationLevel.LEVEL_2: // Structured/Bullets
        if (targetLanguage === 'English') {
            instructions += `
            LEVEL 2 (Structured) Rules:
            1. Break down the content into a structured list.
            2. Use ${bulletStyleInstruction} for the list items.
            3. Use very simple, direct vocabulary.
            4. Group related ideas together.
            5. Provide a 1-sentence summary at the start (for the summary field).
            6. Highlight only the most important concept in each bullet point using {{term}}. Avoid highlighting common or repeated words.
            `;
        } else {
            // Intermediate English instructions
            instructions += `
            LEVEL 2 (Structured) Rules (Intermediate Step):
            1. First, break down the content into a structured list IN ENGLISH.
            2. Use standard numbers (1., 2., 3.) for this intermediate English step.
            3. Use very simple, direct vocabulary.
            4. Group related ideas together.
            5. Provide a 1-sentence summary at the start.
            6. Highlight only the most important concept in each bullet point using {{term}}. Avoid highlighting common or repeated words.
            `;
        }
        break;
      case SimplificationLevel.LEVEL_1: // Standard
      default:
        instructions += `
        LEVEL 1 (Standard) Rules:
        1. Use simple, direct vocabulary.
        2. Keep sentences short and active.
        3. Maintain original paragraph structure but simplify complex phrasing.
        4. Provide a 1-sentence summary at the start.
        5. Highlight only the most important concept in each sentence using {{term}}. Avoid highlighting common or repeated words.
        `;
        break;
    }

    instructions += `
    
    QUIZ GENERATION:
    - Generate 3 multiple-choice questions based on the simplified text to test comprehension.
    - Each question must have 4 options and exactly one correct answer.
    - Provide the 0-based index of the correct answer.
    `;

    if (targetLanguage !== 'English') {
      instructions += `
      
      TRANSLATION INSTRUCTIONS:
      1. You have simplified the text in English above.
      2. Now, TRANSLATE the simplified content, the summary, and the quiz into ${targetLanguage}.
      3. CRITICAL FOR LEVEL 2: When translating the structured list, you MUST use ${bulletStyleInstruction} as the list marker.
      4. Preserve the {{double curly braces}} around highlighted terms in the translated text.
      5. Ensure the output remains valid JSON.
      `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert reading assistant for people with dyslexia. 
      Rewrite the following text based on these specific rules:
      
      ${instructions}
      
      Text to rewrite:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            simplified: { type: Type.STRING, description: "The processed text optimized for readability according to the rules." },
            summary: { type: Type.STRING, description: "A one sentence summary of the main point." },
            quiz: {
              type: Type.ARRAY,
              description: "3 multiple choice questions to test comprehension.",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct option." }
                },
                required: ["question", "options", "correctAnswerIndex"]
              }
            }
          },
          required: ["simplified", "summary", "quiz"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    return {
      original: text,
      simplified: result.simplified,
      summary: result.summary,
      quiz: result.quiz || []
    };
  } catch (error) {
    console.error("Simplification error:", error);
    throw new Error("Failed to simplify text. Please try again.");
  }
};

/**
 * Generates speech from text using Gemini 2.5 Flash TTS.
 */
export const generateSpeech = async (text: string, voice: string = 'Puck'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      throw new Error("No audio data received from model.");
    }
    
    return audioData;
  } catch (error) {
    console.error("TTS error:", error);
    throw new Error("Failed to generate speech.");
  }
};

/**
 * Processes a teacher's uploaded document and generates 3 versions of simplifications.
 */
export const processTeacherDocument = async (
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<TeacherMaterial> => {
  try {
    const prompt = `
      You are an expert educational content creator for students with learning differences.
      Analyze the attached document.
      
      Task: Create 3 distinct simplified versions of the content for different reading needs.
      
      STRICT OUTPUT RULES:
      1. Return PLAIN TEXT only. 
      2. Do NOT use HTML tags. 
      3. For Level 2, use numbers (1., 2., 3.) or letters (a., b., c.) for lists.

      1. Level 1 (Standard): Simple vocabulary, active voice, keep paragraph structure.
      2. Level 2 (Structured): Convert content into clear, grouped bullet points.
      3. Level 3 (Ultra-Short): A single sentence summary of the entire document.

      For ALL levels, highlight only the most important concept in each sentence (or bullet point) using {{term}}. Avoid highlighting common or repeated words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            level1: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                summary: { type: Type.STRING }
              }
            },
            level2: {
               type: Type.OBJECT,
               properties: {
                 content: { type: Type.STRING },
                 summary: { type: Type.STRING }
               }
             },
             level3: {
               type: Type.OBJECT,
               properties: {
                 content: { type: Type.STRING },
                 summary: { type: Type.STRING }
               }
             }
          },
          required: ["level1", "level2", "level3"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');

    return {
      id: crypto.randomUUID(),
      title: fileName,
      originalFileName: fileName,
      timestamp: Date.now(),
      versions: {
        LEVEL_1: { level: SimplificationLevel.LEVEL_1, content: result.level1.content, summary: result.level1.summary },
        LEVEL_2: { level: SimplificationLevel.LEVEL_2, content: result.level2.content, summary: result.level2.summary },
        LEVEL_3: { level: SimplificationLevel.LEVEL_3, content: result.level3.content, summary: result.level3.summary }
      }
    };
  } catch (error) {
    console.error("Teacher processing error:", error);
    throw new Error("Failed to process document. Please ensure it is a valid PDF or Text file.");
  }
};