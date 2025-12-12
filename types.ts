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

export type Subject = 'General' | 'Science' | 'History' | 'Literature' | 'Geography' | 'Math';

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

export interface TeacherVersion {
  level: SimplificationLevel;
  content: string;
  summary: string;
}

export interface TeacherMaterial {
  id: string;
  title: string;
  originalFileName: string;
  subject: Subject;
  timestamp: number;
  versions: {
    [key in SimplificationLevel]: TeacherVersion;
  };
}

export interface WordToken {
  id: string;
  text: string;
  isTerm: boolean;
  startTime: number;
  endTime: number;
  charStart: number;
  charEnd: number;
}
