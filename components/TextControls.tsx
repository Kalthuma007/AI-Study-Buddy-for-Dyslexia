import React from 'react';
import { UserSettings, Theme, FontFamily } from '../types';
import { Settings, Type, Moon, Sun, Monitor, Palette, AArrowUp, AArrowDown } from 'lucide-react';

interface TextControlsProps {
  settings: UserSettings;
  onUpdate: (newSettings: Partial<UserSettings>) => void;
}

export const TextControls: React.FC<TextControlsProps> = ({ settings, onUpdate }) => {
  const isDark = settings.theme === Theme.DARK;
  
  return (
    <div className={`${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/50 border-slate-100'} backdrop-blur-sm p-4 rounded-2xl border mb-6 transition-colors`}>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Font Family */}
        <div className="space-y-1">
          <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>Font</label>
          <select 
            value={settings.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value as FontFamily })}
            className={`w-full text-xs font-bold rounded-lg block p-2 transition-colors shadow-sm focus:ring-primary focus:border-primary ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
          >
            <option value={FontFamily.LEXEND}>Lexend</option>
            <option value={FontFamily.DYSLEXIC}>Dyslexic</option>
            <option value={FontFamily.READABLE}>Open Sans</option>
            <option value={FontFamily.SANS}>Standard</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="space-y-1">
           <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>Size</label>
           <div className={`flex items-center gap-2 rounded-lg p-1 shadow-sm border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-slate-200'}`}>
                <button 
                  onClick={() => onUpdate({ fontSize: Math.max(14, settings.fontSize - 2) })}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-600 hover:text-white' : 'hover:bg-slate-50 text-slate-500 hover:text-primary'}`}
                >
                  <AArrowDown className="w-3 h-3" />
                </button>
                <span className={`flex-1 text-center text-xs font-bold ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                  {settings.fontSize}px
                </span>
                <button 
                  onClick={() => onUpdate({ fontSize: Math.min(48, settings.fontSize + 2) })}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-600 hover:text-white' : 'hover:bg-slate-50 text-slate-500 hover:text-primary'}`}
                >
                  <AArrowUp className="w-3 h-3" />
                </button>
           </div>
        </div>

        {/* Spacing Controls */}
        <div className="space-y-1">
          <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>Spacing</label>
          <div className="flex items-center gap-2 h-[34px]">
             <input 
               type="range" 
               min="120" 
               max="250" 
               step="10"
               value={settings.lineHeight * 100} 
               onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) / 100 })}
               className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-primary ${isDark ? 'bg-gray-700' : 'bg-slate-200'}`}
               title="Line Height"
             />
             <div className={`w-px h-4 ${isDark ? 'bg-gray-600' : 'bg-slate-200'}`}></div>
             <input 
               type="range" 
               min="0" 
               max="15" 
               step="1"
               value={settings.letterSpacing * 100} 
               onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) / 100 })}
               className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-primary ${isDark ? 'bg-gray-700' : 'bg-slate-200'}`}
               title="Letter Spacing"
             />
          </div>
        </div>

        {/* Theme Toggles */}
        <div className="space-y-1">
          <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>Theme</label>
          <div className={`flex gap-1 border p-1 rounded-lg shadow-sm h-[34px] ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => onUpdate({ theme: Theme.LIGHT })}
              className={`flex-1 rounded flex justify-center items-center transition-all ${settings.theme === Theme.LIGHT ? 'bg-slate-100 text-primary' : 'text-slate-400 hover:text-slate-600'}`}
              title="Light"
            >
              <Sun className="w-3 h-3" />
            </button>
            <button
              onClick={() => onUpdate({ theme: Theme.CREAM })}
              className={`flex-1 rounded flex justify-center items-center transition-all ${settings.theme === Theme.CREAM ? 'bg-[#FDFBF7] ring-1 ring-amber-100' : 'text-slate-400 hover:text-slate-600'}`}
              title="Sepia"
            >
              <div className="w-3 h-3 rounded-full bg-[#FDFBF7] border border-amber-300"></div>
            </button>
            <button
              onClick={() => onUpdate({ theme: Theme.DARK })}
              className={`flex-1 rounded flex justify-center items-center transition-all ${settings.theme === Theme.DARK ? 'bg-gray-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Dark"
            >
              <Moon className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};