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
  CREAM = 'CREAM',
  DARK = 'DARK'
}

export enum FontFamily {
  SANS = 'font-sans',
  READABLE = 'font-readable',
  DYSLEXIC = 'font-dyslexic'
}

export interface UserSettings {
  fontSize: number; // in pixels (base)
  lineHeight: number;
  letterSpacing: number;
  theme: Theme;
  fontFamily: FontFamily;
}

export interface SimplificationResult {
  original: string;
  simplified: string;
  summary: string;
}