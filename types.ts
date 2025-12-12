export enum AppStatus {
  IDLE = 'IDLE',
  SIMPLIFYING = 'SIMPLIFYING',
  READING = 'READING', // Simplified text available
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  PLAYING_AUDIO = 'PLAYING_AUDIO',
  ERROR = 'ERROR'
}

export enum Theme {
  LIGHT = 'LIGHT',
  CREAM = 'CREAM', // Sepia-like
  SOFT_BLUE = 'SOFT_BLUE', // Pastel Blue
  DARK = 'DARK'
}

export enum FontFamily {
  SANS = 'font-sans',
  READABLE = 'font-readable',
  DYSLEXIC = 'font-dyslexic',
  LEXEND = 'font-lexend'
}

export enum SimplificationLevel {
  LEVEL_1 = 'LEVEL_1', // Standard
  LEVEL_2 = 'LEVEL_2', // Bullet Points
  LEVEL_3 = 'LEVEL_3'  // Ultra-Short
}

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export type SupportedLanguage = 'English' | 'Somali' | 'Arabic' | 'Spanish' | 'Chinese';

export interface UserSettings {
  fontSize: number; // in pixels (base)
  lineHeight: number;
  letterSpacing: number;
  theme: Theme;
  fontFamily: FontFamily;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface SimplificationResult {
  original: string;
  simplified: string;
  summary: string;
  quiz: QuizQuestion[];
}

export interface TeacherMaterialVersion {
  level: SimplificationLevel;
  content: string;
  summary: string;
}

export interface TeacherMaterial {
  id: string;
  title: string;
  timestamp: number;
  originalFileName: string;
  versions: {
    [SimplificationLevel.LEVEL_1]: TeacherMaterialVersion;
    [SimplificationLevel.LEVEL_2]: TeacherMaterialVersion;
    [SimplificationLevel.LEVEL_3]: TeacherMaterialVersion;
  };
}

export interface WordToken {
  id: string;
  text: string;     // Display text (includes punctuation if attached)
  isTerm: boolean;  // True if it was inside {{ }}
  startTime: number;
  endTime: number;
}