import React from 'react';
import { UserSettings, Theme, FontFamily } from '../types';
import { Settings, Type, Moon, Sun, Monitor } from 'lucide-react';

interface TextControlsProps {
  settings: UserSettings;
  onUpdate: (newSettings: Partial<UserSettings>) => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-6 items-center justify-between">
      
      {/* Font Size Group */}
      <div className="flex items-center gap-3">
        <Type className="w-4 h-4 text-slate-400" />
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => onUpdate({ fontSize: Math.max(14, settings.fontSize - 2) })}
            className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm text-slate-600 hover:text-blue-600 font-bold"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <span className="w-10 flex items-center justify-center text-sm font-medium text-slate-600">
            {settings.fontSize}px
          </span>
          <button 
            onClick={() => onUpdate({ fontSize: Math.min(32, settings.fontSize + 2) })}
            className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm text-slate-600 hover:text-blue-600 font-bold"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Spacing Group */}
      <div className="flex items-center gap-3">
        <Monitor className="w-4 h-4 text-slate-400" />
        <div className="flex flex-col gap-1">
           <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Spacing</span>
              <input 
                type="range" 
                min="100" 
                max="250" 
                step="10"
                value={settings.lineHeight * 100} 
                onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) / 100 })}
                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
           </div>
           <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Tracking</span>
              <input 
                type="range" 
                min="0" 
                max="20" 
                step="1"
                value={settings.letterSpacing * 100} 
                onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) / 100 })}
                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
           </div>
        </div>
      </div>

      {/* Font Family */}
      <div className="flex gap-2">
        <select 
          value={settings.fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value as FontFamily })}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value={FontFamily.SANS}>Standard Sans</option>
          <option value={FontFamily.READABLE}>Open Sans (Readable)</option>
          <option value={FontFamily.DYSLEXIC}>Comic/Handwritten</option>
        </select>
      </div>

      {/* Theme Toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => onUpdate({ theme: Theme.LIGHT })}
          className={`p-2 rounded ${settings.theme === Theme.LIGHT ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          aria-label="Light Theme"
        >
          <Sun className="w-5 h-5" />
        </button>
        <button
          onClick={() => onUpdate({ theme: Theme.CREAM })}
          className={`p-2 rounded ${settings.theme === Theme.CREAM ? 'bg-[#FEF9E7] shadow text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
          aria-label="Cream Theme"
        >
          <span className="w-5 h-5 block rounded-full border border-current bg-[#FEF9E7]"></span>
        </button>
        <button
          onClick={() => onUpdate({ theme: Theme.DARK })}
          className={`p-2 rounded ${settings.theme === Theme.DARK ? 'bg-slate-800 shadow text-white' : 'text-slate-400 hover:text-slate-600'}`}
          aria-label="Dark Theme"
        >
          <Moon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};