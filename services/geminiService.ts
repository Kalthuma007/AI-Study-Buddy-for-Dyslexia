import { GoogleGenAI, Modality, Type } from "@google/genai";
import { SimplificationResult } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });

/**
 * Simplifies text using Gemini 2.5 Flash.
 */
export const simplifyText = async (text: string): Promise<SimplificationResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert reading assistant for people with dyslexia. 
      Rewrite the following text to make it significantly easier to read.
      
      Rules:
      1. Use simple, direct vocabulary.
      2. Keep sentences short and active.
      3. Break down complex paragraphs into bullet points if they contain lists or steps.
      4. Provide a 1-sentence summary at the start.
      
      Text to rewrite:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            simplified: { type: Type.STRING, description: "The rewriting text optimized for readability." },
            summary: { type: Type.STRING, description: "A one sentence summary of the main point." }
          },
          required: ["simplified", "summary"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    return {
      original: text,
      simplified: result.simplified,
      summary: result.summary
    };
  } catch (error) {
    console.error("Simplification error:", error);
    throw new Error("Failed to simplify text. Please try again.");
  }
};

/**
 * Generates speech from text using Gemini 2.5 Flash TTS.
 */
export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // Puck is often clear and friendly
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