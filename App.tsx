import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, Mic, Play, Pause, RefreshCw, ChevronLeft, Volume2, Sparkles, AlertCircle, Layers, List, AlignLeft, Zap, Settings2, Maximize2, Minimize2, Languages, GraduationCap, Download } from 'lucide-react';
import { simplifyText, generateSpeech } from './services/geminiService';
import { decodeAudioData, audioBufferToWav } from './utils/audioUtils';
import { generateWordTokens } from './utils/textUtils';
import { decodeAndDecompress } from './utils/shareUtils';
import { TextControls } from './components/TextControls';
import { QuizSection } from './components/QuizSection';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AppStatus, SimplificationResult, UserSettings, Theme, FontFamily, SimplificationLevel, VoiceName, SupportedLanguage, WordToken, TeacherMaterial } from './types';

const VOICES: { name: VoiceName; label: string }[] = [
  { name: 'Puck', label: 'Puck (Male)' },
  { name: 'Charon', label: 'Charon (Male)' },
  { name: 'Kore', label: 'Kore (Female)' },
  { name: 'Fenrir', label: 'Fenrir (Male)' },
  { name: 'Zephyr', label: 'Zephyr (Female)' },
];

const SPEEDS = [
  { value: 0.75, label: '0.75x (Slow)' },
  { value: 1.0, label: '1.0x (Normal)' },
  { value: 1.25, label: '1.25x (Fast)' },
  { value: 1.5, label: '1.5x (Faster)' },
];

const LANGUAGES: SupportedLanguage[] = ['English', 'Somali', 'Arabic', 'Spanish', 'Chinese'];

export default function App() {
  // --- State ---
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<SimplificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'student' | 'teacher'>('student');
  const [sharedMaterial, setSharedMaterial] = useState<TeacherMaterial | null>(null);
  
  // Levels
  const [level, setLevel] = useState<SimplificationLevel>(SimplificationLevel.LEVEL_1);
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('English');

  // Audio configuration
  const [voice, setVoice] = useState<VoiceName>('Puck');
  const [speed, setSpeed] = useState<number>(1.0);
  
  // Focus Mode
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  
  // Synchronization
  const [wordTokens, setWordTokens] = useState<WordToken[]>([]);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackSpeedRef = useRef<number>(1.0); // Track speed for animation loop
  const animationFrameRef = useRef<number | null>(null);

  // Settings state
  const [settings, setSettings] = useState<UserSettings>({
    fontSize: 18,
    lineHeight: 1.6,
    letterSpacing: 0.01,
    theme: Theme.CREAM,
    fontFamily: FontFamily.LEXEND // Default to Lexend for better accessibility
  });

  // --- Effects ---
  
  // Check for share link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      const loadShared = async () => {
        setStatus(AppStatus.SIMPLIFYING); // Show loading state
        const material = await decodeAndDecompress(shareData);
        if (material) {
          setSharedMaterial(material);
          // Set initial view to Level 1
          setResult({
            original: `(Shared File: ${material.title})`,
            simplified: material.versions[SimplificationLevel.LEVEL_1].content,
            summary: material.versions[SimplificationLevel.LEVEL_1].summary,
            quiz: []
          });
          setStatus(AppStatus.READING);
          setInputText(`Loaded content from shared link: ${material.title}`);
        } else {
          setErrorMsg("Invalid or expired share link.");
          setStatus(AppStatus.ERROR);
        }
      };
      loadShared();
    }
  }, []);

  // Update playback speed dynamically
  useEffect(() => {
    playbackSpeedRef.current = speed; // Update ref for the loop
    if (audioSourceRef.current && isPlaying) {
      // AudioParam.value set immediately
      audioSourceRef.current.playbackRate.value = speed;
    }
  }, [speed, isPlaying]);

  // Handle switching levels when in "Shared" mode
  useEffect(() => {
    if (sharedMaterial && status === AppStatus.READING) {
      // If we have shared material, we switch content from memory, not API
      const version = sharedMaterial.versions[level];
      if (version) {
        setResult({
          original: `(Shared File: ${sharedMaterial.title})`,
          simplified: version.content,
          summary: version.summary,
          quiz: [] // Quizzes are not currently part of the shared object
        });
        // Reset audio when switching levels locally
        stopAudio();
        setAudioBuffer(null);
        setWordTokens([]);
      }
    }
  }, [level, sharedMaterial]);

  // Handle ESC to exit focus mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocusMode(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // --- Handlers ---

  const handleSimplify = async () => {
    if (!inputText.trim()) return;
    
    // If we are currently viewing shared material, clearing the input or clicking simplify 
    // should probably exit shared mode if the text changed, but for now let's assume 
    // explicit "New Text" clears it.
    
    setStatus(AppStatus.SIMPLIFYING);
    setErrorMsg(null);
    setAudioBuffer(null);
    setWordTokens([]); // Reset tokens
    setActiveTokenId(null);

    // If text was manually changed, we are no longer in "shared" mode for that text
    if (sharedMaterial && !inputText.includes(sharedMaterial.title)) {
        setSharedMaterial(null);
    }

    // However, if we are just switching levels on shared material, the Effect handles it.
    // This function is called by the "Simplify" button.
    // If shared material is active, we don't want to re-call API unless user explicitly pasted new text.
    if (sharedMaterial) {
       // If user clicks button while on shared material, maybe they want to re-generate/translate?
       // But Shared Material doesn't have original text (it was a file). 
       // So we can't re-generate. We should probably disable the button or warn.
       // For now, let's just let it fall through to API if they changed text, or do nothing.
       if (inputText.startsWith("Loaded content from")) {
           return; // Do nothing if it's just the placeholder
       }
    }

    try {
      const data = await simplifyText(inputText, level, targetLanguage);
      setResult(data);
      setStatus(AppStatus.READING);
      setSharedMaterial(null); // Clear shared state if we generated new fresh text
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleVoiceChange = (newVoice: VoiceName) => {
    setVoice(newVoice);
    // Invalidate buffer because the voice changed
    setAudioBuffer(null);
    setWordTokens([]);
    if (isPlaying) {
      stopAudio();
    }
  };

  const handleGenerateAudio = async () => {
    if (!result?.simplified) return;

    try {
      setStatus(AppStatus.GENERATING_AUDIO);
      
      const cleanText = result.simplified.replace(/\{\{/g, '').replace(/\}\}/g, '');
      const base64Audio = await generateSpeech(cleanText, voice);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
      setAudioBuffer(buffer);
      
      // Generate word tokens for sync
      const tokens = generateWordTokens(result.simplified, buffer.duration);
      setWordTokens(tokens);

      setStatus(AppStatus.READING);
      playAudio(buffer); 
    } catch (err) {
      setErrorMsg("Failed to generate audio.");
      setStatus(AppStatus.READING);
    }
  };

  // Animation Loop for Sync
  const startSyncLoop = () => {
    if (!audioContextRef.current) return;

    // We track position relative to when we started playback
    // Since we always start from 0 in this implementation:
    const startCtxTime = playbackStartTimeRef.current;
    let lastTime = performance.now();
    let audioProgress = 0; // In seconds

    const loop = () => {
      if (!isPlaying && audioProgress > 0) return; // Stop if paused (state check might be stale in closure, rely on ref/cancel)
      
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      
      // Advance progress based on current speed
      audioProgress += dt * playbackSpeedRef.current;

      // Find active token
      // This linear search is fine for small text, but could be optimized if needed.
      const active = wordTokens.find(t => audioProgress >= t.startTime && audioProgress < t.endTime);
      
      if (active) {
        setActiveTokenId(active.id);
      } else if (audioProgress > wordTokens[wordTokens.length - 1]?.endTime + 0.5) {
        // Just clear if past the end
        setActiveTokenId(null);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(loop);
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
    source.playbackRate.value = speed;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      setIsPlaying(false);
      setActiveTokenId(null);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    audioSourceRef.current = source;
    playbackStartTimeRef.current = audioContextRef.current.currentTime;
    source.start();
    setIsPlaying(true);
    setStatus(AppStatus.PLAYING_AUDIO);
    
    // Start Sync Loop
    startSyncLoop();
  }, [speed, wordTokens]); // Re-create if wordTokens changes (which happens on generation)

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) { /* ignore */ }
      setIsPlaying(false);
      setStatus(AppStatus.READING);
      setActiveTokenId(null);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

  const handleDownloadAudio = () => {
    if (!audioBuffer) return;
    const blob = audioBufferToWav(audioBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "simplified_text.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    stopAudio();
    setResult(null);
    setInputText('');
    setStatus(AppStatus.IDLE);
    setAudioBuffer(null);
    setWordTokens([]);
    setSharedMaterial(null);
    setIsFocusMode(false);
    // Remove query param
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
  };

  // --- Styles Helper ---

  const getContainerStyles = () => {
    switch (settings.theme) {
      case Theme.DARK:
        return 'bg-slate-900 text-slate-100';
      case Theme.CREAM:
        return 'bg-[#FDFBF7] text-slate-800'; // Sepia
      case Theme.SOFT_BLUE:
        return 'bg-[#EDF2F7] text-slate-900'; // Pastel Blue
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

  // --- Render Helpers ---

  // Replaces the old string-splitting render with Token-based render
  const renderTextContent = () => {
    if (!result?.simplified) return null;

    // If we have tokens (audio generated), use them for sync highlighting
    if (wordTokens.length > 0) {
       return wordTokens.map((token) => {
          let className = "mx-[1px] rounded px-[1px] transition-colors duration-150 ";
          
          // Term Highlight (Static)
          if (token.isTerm) {
            if (settings.theme === Theme.DARK) {
              className += 'text-blue-200 border-b-2 border-blue-500 ';
              if (!isActive) className += 'bg-blue-900/40 ';
            } else if (settings.theme === Theme.CREAM) {
              className += 'text-amber-900 border-b-2 border-amber-300 ';
              if (!isActive) className += 'bg-amber-100/50 ';
            } else {
              className += 'text-blue-900 border-b-2 border-blue-300 ';
              if (!isActive) className += 'bg-blue-100/50 ';
            }
          }

          // Active Word Highlight (Playback)
          var isActive = token.id === activeTokenId;
          if (isActive) {
             if (settings.theme === Theme.DARK) {
               className += 'bg-yellow-600/60 text-white ';
             } else {
               className += 'bg-yellow-300/60 text-slate-900 ';
             }
          }
          
          return (
            <span key={token.id} className={className}>
              {token.text}
            </span>
          );
       });
    }

    // Fallback: Default static render if no audio/tokens yet
    const parts = result.simplified.split(/(\{\{.*?\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const content = part.slice(2, -2);
        let highlightClass = 'bg-blue-100/80 text-blue-900 border-b-2 border-blue-300';
        if (settings.theme === Theme.DARK) highlightClass = 'bg-blue-900/60 text-blue-200 border-b-2 border-blue-500';
        else if (settings.theme === Theme.CREAM) highlightClass = 'bg-amber-100 text-amber-900 border-b-2 border-amber-300';
        else if (settings.theme === Theme.SOFT_BLUE) highlightClass = 'bg-white text-blue-900 border-b-2 border-blue-200 shadow-sm';
        return <span key={index} className={`px-1 rounded-t-sm mx-0.5 font-semibold decoration-clone ${highlightClass}`}>{content}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  // --- Level Selection Component ---
  const LevelButton = ({ lvl, label, desc, icon: Icon }: { lvl: SimplificationLevel, label: string, desc: string, icon: React.ElementType }) => (
    <button
      onClick={() => setLevel(lvl)}
      className={`
        flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all w-full md:w-1/3
        ${level === lvl 
          ? 'border-blue-500 bg-blue-50 text-blue-700' 
          : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'
        }
      `}
    >
      <div className={`mb-2 p-2 rounded-full ${level === lvl ? 'bg-blue-100' : 'bg-slate-100'}`}>
        <Icon className={`w-5 h-5 ${level === lvl ? 'text-blue-600' : 'text-slate-400'}`} />
      </div>
      <span className="font-bold text-sm mb-0.5">{label}</span>
      <span className="text-xs opacity-80">{desc}</span>
    </button>
  );

  // --- Teacher Mode Render ---
  if (viewMode === 'teacher') {
    return <TeacherDashboard onBack={() => setViewMode('student')} />;
  }

  // --- Focus Mode Render ---
  if (isFocusMode && result) {
    return (
        <div className={`min-h-screen transition-colors duration-300 ${getContainerStyles()} ${getFontClass()} fixed inset-0 z-[100] overflow-y-auto`}>
            <div className="max-w-3xl mx-auto p-8 pt-24 pb-20 min-h-screen">
                 {/* Floating Controls */}
                 <div className="fixed top-6 right-6 flex items-center gap-3 z-50 print:hidden">
                    <button onClick={toggleAudio} className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition-transform hover:scale-105" title={isPlaying ? "Pause" : "Read Aloud"}>
                        {status === AppStatus.GENERATING_AUDIO ? <RefreshCw className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1" />}
                    </button>
                    <button onClick={() => setIsFocusMode(false)} className={`flex items-center justify-center w-12 h-12 rounded-full shadow-xl transition-transform hover:scale-105 border ${settings.theme === Theme.DARK ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`} title="Exit Focus Mode (ESC)">
                        <Minimize2 className="w-5 h-5" />
                    </button>
                 </div>
                 
                 {/* Content */}
                 {result?.summary && level !== SimplificationLevel.LEVEL_3 && (
                   <div className={`mb-12 p-8 rounded-3xl border ${settings.theme === Theme.DARK ? 'bg-slate-800 border-slate-700' : 'bg-blue-50/50 border-blue-100/50'}`}>
                      <h3 className="opacity-60 uppercase text-sm font-bold tracking-widest mb-4">Summary</h3>
                      <p className="text-xl leading-relaxed font-sans font-medium opacity-90">
                        {result.summary}
                      </p>
                   </div>
                 )}

                 <div style={getContentStyles()} className="whitespace-pre-wrap">
                    {renderTextContent()}
                 </div>
            </div>
        </div>
    );
  }

  // --- Standard Render ---

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
        <div className="flex items-center gap-3">
           {status !== AppStatus.IDLE && (
            <button onClick={resetApp} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mr-2">
              <RefreshCw className="w-4 h-4" /> New Text
            </button>
           )}
           <button onClick={() => setViewMode('teacher')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-blue-100 hover:text-blue-700 transition-colors border border-slate-200">
              <GraduationCap className="w-4 h-4" /> Teacher Dashboard
           </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10">
        
        {/* VIEW: INPUT */}
        {status === AppStatus.IDLE || status === AppStatus.SIMPLIFYING || status === AppStatus.ERROR ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4 max-w-2xl mx-auto mt-6 mb-8">
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
                className={`w-full h-56 p-6 rounded-xl bg-transparent border-0 focus:ring-0 resize-none text-lg placeholder:text-slate-400 ${getFontClass()}`}
                disabled={status === AppStatus.SIMPLIFYING}
              />
              <div className="px-4 pb-2 pt-2 border-t border-slate-100 bg-white/40 rounded-b-xl">
                 <div className="flex justify-between items-center mb-4">
                     <span className="text-sm text-slate-400 font-medium">{inputText.length} characters</span>
                 </div>
                 
                 {/* Controls Row */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                           <Settings2 className="w-3 h-3" /> Complexity Level
                        </label>
                        <div className="flex gap-2">
                          <LevelButton lvl={SimplificationLevel.LEVEL_1} label="L1" desc="Standard" icon={AlignLeft} />
                          <LevelButton lvl={SimplificationLevel.LEVEL_2} label="L2" desc="Bullets" icon={List} />
                          <LevelButton lvl={SimplificationLevel.LEVEL_3} label="L3" desc="Short" icon={Zap} />
                        </div>
                    </div>

                     <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                           <Languages className="w-3 h-3" /> Output Language
                        </label>
                        <div className="relative">
                           <select 
                              value={targetLanguage} 
                              onChange={(e) => setTargetLanguage(e.target.value as SupportedLanguage)} 
                              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-3 pl-4 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-shadow hover:bg-white"
                              disabled={!!sharedMaterial} // Disable translation for shared material as it is pre-generated
                            >
                              {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                           </select>
                           <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500"><svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg></div>
                        </div>
                     </div>
                 </div>

                 <button 
                    onClick={handleSimplify} 
                    disabled={(!inputText.trim() && !sharedMaterial) || status === AppStatus.SIMPLIFYING || (!!sharedMaterial && inputText.startsWith("Loaded content"))} 
                    className={`w-full flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-[0.99] shadow-lg ${!inputText.trim() || status === AppStatus.SIMPLIFYING ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-300 hover:shadow-blue-400'}`}
                  >
                    {status === AppStatus.SIMPLIFYING ? <><RefreshCw className="w-5 h-5 animate-spin" /> Simplifying...</> : <><Sparkles className="w-5 h-5" /> Simplify & Translate</>}
                  </button>
              </div>
            </div>

            {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-pulse"><AlertCircle className="w-5 h-5" />{errorMsg}</div>}
          </div>
        ) : (
          /* VIEW: RESULT */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TextControls settings={settings} onUpdate={(newSettings) => setSettings(prev => ({ ...prev, ...newSettings }))} />
            <div className={`rounded-3xl shadow-xl overflow-hidden border ${settings.theme === Theme.DARK ? 'border-slate-800 bg-slate-800' : 'border-slate-100 bg-white'}`}>
              
              {/* Toolbar */}
              <div className={`px-4 md:px-6 py-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between ${settings.theme === Theme.DARK ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                 <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setInputText(result?.original || '')} className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-blue-600">Original</button>
                      <div className="h-4 w-px bg-slate-300"></div>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">{level === SimplificationLevel.LEVEL_3 ? 'Ultra-Short' : level === SimplificationLevel.LEVEL_2 ? 'Structured' : 'Simplified'}</span>
                      {targetLanguage !== 'English' && <><div className="h-4 w-px bg-slate-300"></div><span className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1"><Languages className="w-3 h-3" />{targetLanguage}</span></>}
                    </div>
                 </div>

                 {/* Audio Controls Group */}
                 <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative">
                      <select value={voice} onChange={(e) => handleVoiceChange(e.target.value as VoiceName)} className={`text-sm font-medium py-2 pl-3 pr-8 rounded-lg border appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.theme === Theme.DARK ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                        {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"><svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg></div>
                    </div>

                    <div className="relative">
                      <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className={`text-sm font-medium py-2 pl-3 pr-8 rounded-lg border appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.theme === Theme.DARK ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                         {SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"><svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg></div>
                    </div>
                    
                    <button onClick={() => setIsFocusMode(true)} className={`p-2.5 rounded-lg transition-all border ${settings.theme === Theme.DARK ? 'border-slate-600 hover:bg-slate-700 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`} title="Enter Focus Mode">
                        <Maximize2 className="w-4 h-4" />
                    </button>

                     {audioBuffer && (
                       <button onClick={handleDownloadAudio} className={`p-2.5 rounded-lg transition-all border ${settings.theme === Theme.DARK ? 'border-slate-600 hover:bg-slate-700 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'}`} title="Save Audio">
                         <Download className="w-4 h-4" />
                       </button>
                     )}

                    <button onClick={toggleAudio} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap min-w-[120px] justify-center ${isPlaying ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                        {status === AppStatus.GENERATING_AUDIO ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                        {status === AppStatus.GENERATING_AUDIO ? 'Loading...' : isPlaying ? 'Stop' : 'Read Aloud'}
                    </button>
                 </div>
              </div>

              {/* Content */}
              <div className="p-8 md:p-12 min-h-[50vh]">
                 {result?.summary && level !== SimplificationLevel.LEVEL_3 && (
                   <div className="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                      <h3 className="text-blue-900/60 uppercase text-xs font-bold tracking-widest mb-2">Summary</h3>
                      <p className="text-blue-900 font-medium text-lg leading-relaxed font-sans">
                        {result.summary}
                      </p>
                   </div>
                 )}

                 <div style={getContentStyles()} className="whitespace-pre-wrap mb-10">
                    {renderTextContent()}
                 </div>

                 {result?.quiz && result.quiz.length > 0 && (
                   <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                     <QuizSection questions={result.quiz} theme={settings.theme} />
                   </div>
                 )}
              </div>
            </div>
            
            <div className="flex justify-center pt-8">
               <button onClick={resetApp} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                 <ChevronLeft className="w-4 h-4" /> Back to Input
               </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}