import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, Mic, Play, Pause, RefreshCw, ChevronLeft, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { simplifyText, generateSpeech } from './services/geminiService';
import { decodeAudioData } from './utils/audioUtils';
import { TextControls } from './components/TextControls';
import { AppStatus, SimplificationResult, UserSettings, Theme, FontFamily } from './types';

export default function App() {
  // --- State ---
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<SimplificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  // Settings state
  const [settings, setSettings] = useState<UserSettings>({
    fontSize: 18,
    lineHeight: 1.6,
    letterSpacing: 0.01,
    theme: Theme.CREAM,
    fontFamily: FontFamily.READABLE
  });

  // --- Handlers ---

  const handleSimplify = async () => {
    if (!inputText.trim()) return;
    
    setStatus(AppStatus.SIMPLIFYING);
    setErrorMsg(null);
    setAudioBuffer(null); // Reset audio when new text is generated

    try {
      const data = await simplifyText(inputText);
      setResult(data);
      setStatus(AppStatus.READING);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGenerateAudio = async () => {
    if (!result?.simplified) return;

    try {
      setStatus(AppStatus.GENERATING_AUDIO);
      const base64Audio = await generateSpeech(result.simplified);
      
      // Initialize AudioContext if not present
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      // Decode
      const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
      setAudioBuffer(buffer);
      setStatus(AppStatus.READING); // Go back to reading, but now audio is ready
      playAudio(buffer); // Auto-play
    } catch (err) {
      setErrorMsg("Failed to generate audio.");
      setStatus(AppStatus.READING); // Revert status
    }
  };

  const playAudio = useCallback((buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    
    // Stop any existing source
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) { /* ignore */ }
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      setIsPlaying(false);
    };

    audioSourceRef.current = source;
    source.start();
    setIsPlaying(true);
    setStatus(AppStatus.PLAYING_AUDIO);
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) { /* ignore */ }
      setIsPlaying(false);
      setStatus(AppStatus.READING);
    }
  };

  const toggleAudio = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      if (audioBuffer) {
        playAudio(audioBuffer);
      } else {
        handleGenerateAudio();
      }
    }
  };

  const resetApp = () => {
    stopAudio();
    setResult(null);
    setInputText('');
    setStatus(AppStatus.IDLE);
    setAudioBuffer(null);
  };

  // --- Styles Helper ---

  const getContainerStyles = () => {
    switch (settings.theme) {
      case Theme.DARK:
        return 'bg-slate-900 text-slate-100';
      case Theme.CREAM:
        return 'bg-[#FDFBF7] text-slate-800';
      case Theme.LIGHT:
      default:
        return 'bg-white text-gray-900';
    }
  };

  const getContentStyles = () => {
    return {
      fontSize: `${settings.fontSize}px`,
      lineHeight: settings.lineHeight,
      letterSpacing: `${settings.letterSpacing}em`,
    };
  };

  const getFontClass = () => settings.fontFamily;

  // --- Render ---

  return (
    <div className={`min-h-screen transition-colors duration-300 ${getContainerStyles()} ${getFontClass()}`}>
      
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-opacity-90 border-b border-gray-200/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Lexi</h1>
        </div>
        {status !== AppStatus.IDLE && (
          <button 
            onClick={resetApp}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            New Text
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10">
        
        {/* VIEW: INPUT */}
        {status === AppStatus.IDLE || status === AppStatus.SIMPLIFYING || status === AppStatus.ERROR ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4 max-w-2xl mx-auto mt-10">
              <h2 className="text-4xl font-extrabold tracking-tight mb-2">Reading made simple.</h2>
              <p className="text-xl opacity-70">
                Paste complex text below. Lexi will simplify it and read it out loud for you.
              </p>
            </div>

            <div className="bg-white/50 p-2 rounded-2xl shadow-xl border border-slate-200/60 backdrop-blur-sm">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your text here..."
                className={`w-full h-64 p-6 rounded-xl bg-transparent border-0 focus:ring-0 resize-none text-lg placeholder:text-slate-400 ${getFontClass()}`}
                disabled={status === AppStatus.SIMPLIFYING}
              />
              <div className="flex justify-between items-center px-4 pb-4 pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-400 font-medium">{inputText.length} characters</span>
                <button
                  onClick={handleSimplify}
                  disabled={!inputText.trim() || status === AppStatus.SIMPLIFYING}
                  className={`
                    flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-lg
                    ${!inputText.trim() || status === AppStatus.SIMPLIFYING 
                      ? 'bg-slate-300 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-300 hover:shadow-blue-400'
                    }
                  `}
                >
                  {status === AppStatus.SIMPLIFYING ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Simplifying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Simplify Text
                    </>
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
               <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-pulse">
                 <AlertCircle className="w-5 h-5" />
                 {errorMsg}
               </div>
            )}
          </div>
        ) : (
          /* VIEW: RESULT */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <TextControls 
              settings={settings} 
              onUpdate={(newSettings) => setSettings(prev => ({ ...prev, ...newSettings }))} 
            />

            <div className={`rounded-3xl shadow-xl overflow-hidden border ${settings.theme === Theme.DARK ? 'border-slate-800 bg-slate-800' : 'border-slate-100 bg-white'}`}>
              
              {/* Toolbar */}
              <div className={`px-6 py-4 border-b flex items-center justify-between ${settings.theme === Theme.DARK ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                 <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setInputText(result?.original || '')} 
                      className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-blue-600"
                    >
                      Original
                    </button>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Simplified</span>
                 </div>

                 <button
                    onClick={toggleAudio}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all
                      ${isPlaying 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }
                    `}
                 >
                    {status === AppStatus.GENERATING_AUDIO ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                    {status === AppStatus.GENERATING_AUDIO ? 'Generating...' : isPlaying ? 'Stop Reading' : 'Read Aloud'}
                 </button>
              </div>

              {/* Content */}
              <div className="p-8 md:p-12 min-h-[50vh]">
                 {result?.summary && (
                   <div className="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                      <h3 className="text-blue-900/60 uppercase text-xs font-bold tracking-widest mb-2">Summary</h3>
                      <p className="text-blue-900 font-medium text-lg leading-relaxed font-sans">
                        {result.summary}
                      </p>
                   </div>
                 )}

                 <div style={getContentStyles()} className="whitespace-pre-wrap">
                    {result?.simplified}
                 </div>
              </div>
            </div>
            
            <div className="flex justify-center pt-8">
               <button 
                 onClick={resetApp}
                 className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
               >
                 <ChevronLeft className="w-4 h-4" />
                 Back to Input
               </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}