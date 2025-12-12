import React from 'react';
import { UserSettings, Theme, FontFamily } from '../types';
import { Settings, Type, Moon, Sun, Monitor, Palette } from 'lucide-react';

interface TextControlsProps {
  settings: UserSettings;
  onUpdate: (newSettings: Partial<UserSettings>) => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6 space-y-5">
      
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Display Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Font Family */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500">Font Type</label>
          <select 
            value={settings.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value as FontFamily })}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-colors hover:bg-slate-100"
          >
            <option value={FontFamily.LEXEND}>Lexend (Recommended)</option>
            <option value={FontFamily.DYSLEXIC}>Dyslexic (Comic Style)</option>
            <option value={FontFamily.READABLE}>Open Sans</option>
            <option value={FontFamily.SANS}>Standard Sans</option>
          </select>
        </div>

        {/* Font Size & Theme */}
        <div className="space-y-2">
           <label className="text-xs font-semibold text-slate-500">Size & Theme</label>
           <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-1 justify-between">
                <button 
                  onClick={() => onUpdate({ fontSize: Math.max(14, settings.fontSize - 2) })}
                  className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm text-slate-600 hover:text-blue-600 font-bold"
                  aria-label="Decrease font size"
                >
                  A-
                </button>
                <span className="flex-1 flex items-center justify-center text-sm font-medium text-slate-600">
                  {settings.fontSize}px
                </span>
                <button 
                  onClick={() => onUpdate({ fontSize: Math.min(48, settings.fontSize + 2) })}
                  className="w-8 h-8 flex items-center justify-center rounded bg-white shadow-sm text-slate-600 hover:text-blue-600 font-bold"
                  aria-label="Increase font size"
                >
                  A+
                </button>
              </div>
           </div>
        </div>

        {/* Spacing Controls */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500">Spacing</label>
          <div className="space-y-3">
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold w-12">Line</span>
                <input 
                  type="range" 
                  min="120" 
                  max="250" 
                  step="10"
                  value={settings.lineHeight * 100} 
                  onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) / 100 })}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold w-12">Letter</span>
                <input 
                  type="range" 
                  min="0" 
                  max="15" 
                  step="1"
                  value={settings.letterSpacing * 100} 
                  onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) / 100 })}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>
          </div>
        </div>

        {/* Theme Toggles */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500">Background Theme</label>
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => onUpdate({ theme: Theme.LIGHT })}
              className={`flex-1 p-2 rounded-lg flex justify-center items-center transition-all ${settings.theme === Theme.LIGHT ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Light"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => onUpdate({ theme: Theme.CREAM })}
              className={`flex-1 p-2 rounded-lg flex justify-center items-center transition-all ${settings.theme === Theme.CREAM ? 'bg-[#FDFBF7] shadow text-amber-700 ring-1 ring-amber-100' : 'text-slate-400 hover:text-slate-600'}`}
              title="Sepia"
            >
              <div className="w-4 h-4 rounded-full bg-[#FDFBF7] border border-amber-200"></div>
            </button>
            <button
              onClick={() => onUpdate({ theme: Theme.SOFT_BLUE })}
              className={`flex-1 p-2 rounded-lg flex justify-center items-center transition-all ${settings.theme === Theme.SOFT_BLUE ? 'bg-[#EDF2F7] shadow text-slate-700 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              title="Pastel Blue"
            >
              <div className="w-4 h-4 rounded-full bg-[#EDF2F7] border border-slate-300"></div>
            </button>
            <button
              onClick={() => onUpdate({ theme: Theme.DARK })}
              className={`flex-1 p-2 rounded-lg flex justify-center items-center transition-all ${settings.theme === Theme.DARK ? 'bg-slate-800 shadow text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="Dark"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};