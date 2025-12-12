
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, Brain, Mic, Play, Pause, RefreshCw, ChevronLeft, Volume2, Sparkles, AlertCircle, Layers, List, AlignLeft, Zap, Settings2, Maximize2, Minimize2, Languages, GraduationCap, Download, ArrowRight, X, ChevronRight, Trash2 } from 'lucide-react';
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
  { value: 0.75, label: 'Slow' },
  { value: 1.0, label: 'Normal' },
  { value: 1.25, label: 'Fast' },
  { value: 1.5, label: 'Very Fast' },
];

const LANGUAGES: SupportedLanguage[] = ['English', 'Somali', 'Arabic', 'Spanish', 'Chinese'];

const CHARS_PER_PAGE = 1200;

interface Page {
  content: string;
  start: number; // char index in full text
  end: number;
}

export default function App() {
  // --- State ---
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<SimplificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'student' | 'teacher'>('student');
  const [sharedMaterial, setSharedMaterial] = useState<TeacherMaterial | null>(null);
  
  // Pagination State
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

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
  const playbackSpeedRef = useRef<number>(1.0);
  const audioStartOffsetRef = useRef<number>(0); 
  const animationFrameRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Settings state
  const [settings, setSettings] = useState<UserSettings>({
    fontSize: 18,
    lineHeight: 1.6,
    letterSpacing: 0.01,
    theme: Theme.LIGHT,
    fontFamily: FontFamily.LEXEND 
  });

  // --- Effects ---
  
  const isRTL = targetLanguage === 'Arabic';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    const shareLevel = params.get('level') as SimplificationLevel | null;

    if (shareData) {
      const loadShared = async () => {
        setStatus(AppStatus.SIMPLIFYING);
        const material = await decodeAndDecompress(shareData);
        if (material) {
          setSharedMaterial(material);
          
          // Use shared level if available, otherwise default to LEVEL_1
          const initLevel = shareLevel || SimplificationLevel.LEVEL_1;
          setLevel(initLevel);

          const version = material.versions[initLevel];
          const fallbackVersion = material.versions[SimplificationLevel.LEVEL_1];
          const activeVersion = version || fallbackVersion;

          setResult({
            original: `(Shared File: ${material.title})`,
            simplified: activeVersion ? activeVersion.content : "Content not available.",
            summary: activeVersion ? activeVersion.summary : "",
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

  // Pagination Logic when result changes
  useEffect(() => {
    if (result?.simplified) {
      const text = result.simplified;
      // Split by paragraph
      const paragraphs = text.split('\n');
      const newPages: Page[] = [];
      
      let currentContent = '';
      let currentStart = 0;
      let pageStart = 0;

      paragraphs.forEach((para, index) => {
         const isLast = index === paragraphs.length - 1;
         // +1 for the newline char lost in split (approx)
         const paraLen = para.length + 1; 
         
         if (currentContent.length + paraLen > CHARS_PER_PAGE && currentContent.length > 0) {
            newPages.push({
               content: currentContent,
               start: pageStart,
               end: pageStart + currentContent.length
            });
            pageStart += currentContent.length;
            currentContent = para + '\n';
         } else {
            currentContent += para + (isLast ? '' : '\n');
         }
      });

      if (currentContent.length > 0) {
         newPages.push({
            content: currentContent,
            start: pageStart,
            end: pageStart + currentContent.length
         });
      }

      setPages(newPages);
      setCurrentPage(0);
    } else {
      setPages([]);
    }
  }, [result]);

  // Auto-Page Turn on Active Token change
  useEffect(() => {
    if (activeTokenId && wordTokens.length > 0 && pages.length > 1) {
       const token = wordTokens.find(t => t.id === activeTokenId);
       if (token) {
          const pageIndex = pages.findIndex(p => token.charStart >= p.start && token.charStart < p.end);
          if (pageIndex !== -1 && pageIndex !== currentPage) {
             setCurrentPage(pageIndex);
          }
       }
    }
  }, [activeTokenId, pages, wordTokens, currentPage]);

  useEffect(() => {
    // Re-anchor audio time when speed changes
    if (isPlaying && audioContextRef.current) {
        const now = audioContextRef.current.currentTime;
        const oldSpeed = playbackSpeedRef.current;
        const elapsedSinceAnchor = (now - playbackStartTimeRef.current) * oldSpeed;
        
        audioStartOffsetRef.current += elapsedSinceAnchor;
        playbackStartTimeRef.current = now;
        
        if (audioSourceRef.current) {
            audioSourceRef.current.playbackRate.value = speed;
        }
    }
    playbackSpeedRef.current = speed;
  }, [speed, isPlaying]);

  useEffect(() => {
    if (sharedMaterial && status === AppStatus.READING) {
      const version = sharedMaterial.versions[level];
      if (version) {
        setResult({
          original: `(Shared File: ${sharedMaterial.title})`,
          simplified: version.content,
          summary: version.summary,
          quiz: []
        });
        stopAudio();
        setAudioBuffer(null);
        setWordTokens([]);
      }
    }
  }, [level, sharedMaterial]);

  // Scroll to result on mobile when reading starts
  useEffect(() => {
    if (status === AppStatus.READING && resultRef.current && window.innerWidth < 1024) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocusMode(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // --- Handlers ---

  const handleSimplify = async () => {
    if (!inputText.trim()) return;
    
    setStatus(AppStatus.SIMPLIFYING);
    setErrorMsg(null);
    setAudioBuffer(null);
    setWordTokens([]);
    setActiveTokenId(null);
    audioStartOffsetRef.current = 0;

    if (sharedMaterial && !inputText.includes(sharedMaterial.title)) {
        setSharedMaterial(null);
    }

    if (sharedMaterial && inputText.startsWith("Loaded content from")) {
        return;
    }

    try {
      const data = await simplifyText(inputText, level, targetLanguage);
      setResult(data);
      setStatus(AppStatus.READING);
      setSharedMaterial(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleClear = () => {
    stopAudio();
    setInputText('');
    setResult(null);
    setStatus(AppStatus.IDLE);
    setAudioBuffer(null);
    setWordTokens([]);
    setSharedMaterial(null);
    setPages([]);
    setCurrentPage(0);
  };

  const handleVoiceChange = (newVoice: VoiceName) => {
    setVoice(newVoice);
    setAudioBuffer(null);
    setWordTokens([]);
    audioStartOffsetRef.current = 0;
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
      
      const tokens = generateWordTokens(result.simplified, buffer.duration);
      setWordTokens(tokens);

      setStatus(AppStatus.READING);
      playAudio(buffer); 
    } catch (err) {
      setErrorMsg("Failed to generate audio.");
      setStatus(AppStatus.READING);
    }
  };

  const startSyncLoop = () => {
    if (!audioContextRef.current) return;

    const loop = () => {
      if (!audioSourceRef.current) return; 
      
      const ctxTime = audioContextRef.current.currentTime;
      const elapsed = (ctxTime - playbackStartTimeRef.current) * playbackSpeedRef.current;
      const currentPos = audioStartOffsetRef.current + elapsed;

      // Check if finished
      if (audioBuffer && currentPos >= audioBuffer.duration) {
         stopAudio();
         audioStartOffsetRef.current = 0;
         setActiveTokenId(null);
         return;
      }

      const active = wordTokens.find(t => currentPos >= t.startTime && currentPos < t.endTime);
      
      if (active) {
        setActiveTokenId(active.id);
      } else {
        setActiveTokenId(null);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const playAudio = useCallback((buffer: AudioBuffer, offset: number = 0) => {
    if (!audioContextRef.current) return;
    
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { }
    }

    if (offset < 0) offset = 0;
    if (offset >= buffer.duration) offset = 0;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    source.connect(audioContextRef.current.destination);
    
    audioSourceRef.current = source;
    playbackStartTimeRef.current = audioContextRef.current.currentTime;
    audioStartOffsetRef.current = offset;

    source.start(0, offset);
    setIsPlaying(true);
    setStatus(AppStatus.PLAYING_AUDIO);
    
    startSyncLoop();
  }, [speed, wordTokens]);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { }
      
      if (audioContextRef.current) {
         const elapsed = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * playbackSpeedRef.current;
         audioStartOffsetRef.current += elapsed;
         if (audioBuffer && audioStartOffsetRef.current > audioBuffer.duration) {
             audioStartOffsetRef.current = 0;
         }
      }
    }
    setIsPlaying(false);
    setStatus(AppStatus.READING);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const toggleAudio = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      if (audioBuffer) {
        playAudio(audioBuffer, audioStartOffsetRef.current);
      } else {
        handleGenerateAudio();
      }
    }
  };

  const seekAudio = useCallback((delta: number) => {
    if (!audioBuffer) return;
    
    let currentPos = audioStartOffsetRef.current;
    if (isPlaying && audioContextRef.current) {
        const elapsed = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * playbackSpeedRef.current;
        currentPos += elapsed;
    }
    
    let newPos = currentPos + delta;
    if (newPos < 0) newPos = 0;
    if (newPos > audioBuffer.duration) newPos = audioBuffer.duration;
    
    audioStartOffsetRef.current = newPos;
    
    if (isPlaying) {
        playAudio(audioBuffer, newPos);
    } else {
         const active = wordTokens.find(t => newPos >= t.startTime && newPos < t.endTime);
         setActiveTokenId(active ? active.id : null);
    }
  }, [audioBuffer, isPlaying, playAudio, wordTokens]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
          e.preventDefault();
          toggleAudio();
      } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (currentPage < pages.length - 1) {
             setCurrentPage(p => p + 1);
          } else {
             seekAudio(5);
          }
      } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
           if (currentPage > 0) {
             setCurrentPage(p => p - 1);
          } else {
             seekAudio(-5);
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAudio, seekAudio, currentPage, pages]);

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
    handleClear();
    setIsFocusMode(false);
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
  };

  // --- Styles Helper ---

  const getContainerStyles = () => {
    switch (settings.theme) {
      case Theme.DARK: return 'bg-gray-900 text-gray-50';
      case Theme.CREAM: return 'bg-[#FDFBF7] text-slate-800'; 
      case Theme.SOFT_BLUE: return 'bg-[#EDF2F7] text-slate-900'; 
      case Theme.LIGHT: default: return 'bg-white text-gray-900';
    }
  };

  const getContentStyles = () => ({
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    letterSpacing: `${settings.letterSpacing}em`,
  });

  const getFontClass = () => {
    if (targetLanguage === 'Arabic') return 'font-arabic';
    return settings.fontFamily;
  };

  // --- Render Helpers ---

  const renderTextContent = () => {
    if (pages.length === 0) return null;
    
    const page = pages[currentPage];
    if (!page) return null;

    // Filter tokens that belong to this page
    const pageTokens = wordTokens.length > 0 
        ? wordTokens.filter(t => t.charStart >= page.start && t.charEnd <= (page.end + 50)) // tolerance
        : [];

    if (pageTokens.length > 0) {
       return pageTokens.map((token) => {
          const isActive = token.id === activeTokenId;

          let className = "mx-[1px] rounded px-[1px] transition-all duration-300 inline-block cursor-pointer relative ";
          
          if (!isActive) {
             if (settings.theme === Theme.DARK) {
                className += 'hover:bg-indigo-900/50 hover:text-indigo-100 ';
             } else {
                className += 'hover:bg-blue-100 hover:text-blue-900 ';
             }
          }
          
          if (token.isTerm) {
            if (settings.theme === Theme.DARK) {
                 className += 'text-indigo-300 font-bold border-b-2 border-indigo-300/30 ';
                 if (!isActive) className += 'bg-indigo-300/10 ';
            } else {
                 className += 'text-accent font-bold border-b-2 border-accent/30 ';
                 if (!isActive) className += 'bg-accent/5 ';
            }
          }

          if (isActive) {
             // Active: Yellow bg + smooth scale and text color change
             className += 'bg-yellow-300 text-slate-900 shadow-md scale-110 z-10 font-medium ';
          }
          
          return <span key={token.id} className={className}>{token.text}</span>;
       });
    }

    // Fallback regex rendering for simple text (no audio generated yet)
    const parts = page.content.split(/(\{\{.*?\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const content = part.slice(2, -2);
        if (settings.theme === Theme.DARK) {
             return <span key={index} className="px-1 rounded-sm mx-0.5 font-bold text-indigo-300 bg-indigo-300/10 border-b-2 border-indigo-300/30">{content}</span>;
        }
        return <span key={index} className="px-1 rounded-sm mx-0.5 font-bold text-accent bg-accent/5 border-b-2 border-accent/30">{content}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const LevelButton = ({ lvl, label, desc, icon: Icon }: { lvl: SimplificationLevel, label: string, desc: string, icon: React.ElementType }) => (
    <button
      onClick={() => setLevel(lvl)}
      className={`
        flex flex-col items-center justify-center p-3 rounded-xl border transition-all w-full
        ${level === lvl 
          ? 'border-primary bg-blue-50 text-primary shadow-sm ring-1 ring-blue-100' 
          : settings.theme === Theme.DARK 
            ? 'border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            : 'border-slate-200 bg-white text-slate-400 hover:border-primary hover:text-primary hover:bg-slate-50'
        }
      `}
    >
      <Icon className={`w-5 h-5 mb-1 ${level === lvl ? 'text-primary' : settings.theme === Theme.DARK ? 'text-gray-500' : 'text-slate-400'}`} />
      <span className="font-bold text-sm">{label}</span>
      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">{desc}</span>
    </button>
  );

  const isDark = settings.theme === Theme.DARK;

  if (viewMode === 'teacher') {
    return <TeacherDashboard onBack={() => setViewMode('student')} />;
  }

  // Focus Mode
  if (isFocusMode && result) {
    return (
        <div className={`min-h-screen transition-colors duration-300 ${getContainerStyles()} ${getFontClass()} fixed inset-0 z-[100] overflow-y-auto`}>
            <div className="max-w-4xl mx-auto p-8 pt-24 pb-20 min-h-screen flex flex-col">
                 <div className="fixed top-6 right-6 flex items-center gap-3 z-50 print:hidden">
                    <button onClick={toggleAudio} className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-xl hover:bg-blue-600 transition-transform hover:scale-105" title={isPlaying ? "Pause" : "Read Aloud"}>
                        {status === AppStatus.GENERATING_AUDIO ? <RefreshCw className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1" />}
                    </button>
                    <button onClick={() => setIsFocusMode(false)} className="flex items-center justify-center w-12 h-12 rounded-full shadow-xl transition-transform hover:scale-105 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" title="Exit Focus Mode (ESC)">
                        <Minimize2 className="w-5 h-5" />
                    </button>
                 </div>
                 
                 {/* Content Container with max-width */}
                 <div className="w-full max-w-prose mx-auto">
                    {result?.summary && level !== SimplificationLevel.LEVEL_3 && currentPage === 0 && (
                    <div className={`mb-12 p-8 rounded-3xl border ${isDark ? 'bg-indigo-900/20 border-indigo-500/20' : 'bg-accent/5 border-accent/20'}`}>
                        <h3 className={`uppercase text-sm font-bold tracking-widest mb-4 ${isDark ? 'text-indigo-300' : 'text-accent'} ${isRTL ? 'text-right' : 'text-left'}`}>Summary</h3>
                        <p className={`text-xl leading-relaxed font-sans font-medium ${isDark ? 'text-gray-50' : 'text-slate-800'} ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                            {result.summary}
                        </p>
                    </div>
                    )}

                    <div 
                      style={getContentStyles()} 
                      className={`whitespace-pre-wrap break-words ${isRTL ? 'text-right' : 'text-left'}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      lang={isRTL ? 'ar' : 'en'}
                    >
                        {renderTextContent()}
                    </div>
                 </div>

                 {/* Pagination Footer */}
                 {pages.length > 1 && (
                     <div className="mt-12 flex items-center justify-center gap-6 sticky bottom-6 py-4 backdrop-blur-sm rounded-full bg-white/10 mx-auto">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                          disabled={currentPage === 0}
                          className={`p-3 rounded-full transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-30' : 'bg-white hover:bg-slate-100 text-slate-800 shadow-md disabled:opacity-30'}`}
                        >
                           <ChevronLeft className="w-6 h-6" />
                        </button>
                        <span className={`font-bold ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                           Page {currentPage + 1} of {pages.length}
                        </span>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
                          disabled={currentPage === pages.length - 1}
                          className={`p-3 rounded-full transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-30' : 'bg-white hover:bg-slate-100 text-slate-800 shadow-md disabled:opacity-30'}`}
                        >
                           <ChevronRight className="w-6 h-6" />
                        </button>
                     </div>
                 )}
            </div>
        </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${isDark ? 'bg-gray-900 text-gray-50' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b h-20 flex-none transition-all ${isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-screen-2xl mx-auto px-6 h-full flex items-center justify-between">
          
          <div className="flex items-center gap-3">
             <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-blue-50'}`}>
                <BookOpen className="w-6 h-6 text-primary absolute" strokeWidth={2.5} />
                <Brain className="w-4 h-4 text-accent absolute -top-1 -right-1 fill-white" strokeWidth={2.5} />
             </div>
             <div className="flex flex-col">
                 <h1 className={`text-xl font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>Lexi</h1>
                 <span className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>AI Study Buddy</span>
             </div>
          </div>

          <div className="flex items-center gap-3">
             {status !== AppStatus.IDLE && (
                <button onClick={resetApp} className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`} title="Reset">
                   <RefreshCw className="w-5 h-5" />
                </button>
             )}
             <button 
                onClick={() => setViewMode('teacher')} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all shadow-sm group ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 text-indigo-300 hover:bg-indigo-900/30' 
                    : 'bg-purple-50 border-purple-100 text-accent hover:bg-accent hover:text-white'
                }`}
             >
                <GraduationCap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Teacher Dashboard</span>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 overflow-hidden">
        
        {/* Input Panel */}
        <div className={`flex flex-col rounded-3xl shadow-sm border overflow-hidden min-h-[500px] transition-all duration-500 ease-in-out ${status === AppStatus.IDLE ? 'w-full max-w-3xl mx-auto' : 'flex-1'} ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
          
          <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-slate-50/30 border-slate-50'}`}>
             <div className="flex items-center gap-2">
               <Layers className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-primary'}`} />
               <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Input Text</span>
             </div>
             {inputText.length > 0 && (
                <button onClick={handleClear} className="text-xs font-bold text-red-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                    <Trash2 className="w-3 h-3" /> Clear
                </button>
             )}
          </div>

          <div className="flex-1 p-6 relative group">
             <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your study text here..."
                className={`w-full h-full resize-none border-0 focus:ring-0 text-lg sm:text-xl leading-relaxed bg-transparent pb-8 ${getFontClass()} ${isDark ? 'text-gray-50 placeholder:text-gray-600' : 'text-slate-800 placeholder:text-slate-300'}`}
                disabled={status === AppStatus.SIMPLIFYING || !!sharedMaterial}
              />
              <div className="absolute bottom-4 right-6 pointer-events-none transition-opacity duration-300 opacity-50 group-hover:opacity-100 focus-within:opacity-100">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                  isDark 
                    ? 'text-gray-400 bg-gray-700 border border-gray-600' 
                    : 'text-slate-400 bg-slate-100 border border-slate-200'
                }`}>
                  {inputText.length} chars
                </span>
              </div>
          </div>

          <div className={`p-6 border-t space-y-6 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Complexity Level</label>
                     <div className="flex gap-2">
                        <LevelButton lvl={SimplificationLevel.LEVEL_1} label="L1" desc="Standard" icon={AlignLeft} />
                        <LevelButton lvl={SimplificationLevel.LEVEL_2} label="L2" desc="Structured" icon={List} />
                        <LevelButton lvl={SimplificationLevel.LEVEL_3} label="L3" desc="Short" icon={Zap} />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Language</label>
                     <div className="relative">
                        <select 
                           value={targetLanguage} 
                           onChange={(e) => setTargetLanguage(e.target.value as SupportedLanguage)} 
                           className={`w-full appearance-none border py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-bold shadow-sm ${
                             isDark 
                               ? 'bg-gray-700 border-gray-600 text-gray-200' 
                               : 'bg-white border-slate-200 text-slate-700'
                           }`}
                           disabled={!!sharedMaterial}
                         >
                           {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                        </select>
                        <Languages className={`pointer-events-none absolute inset-y-0 right-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                     </div>
                  </div>
              </div>

              <button 
                 onClick={handleSimplify} 
                 disabled={(!inputText.trim() && !sharedMaterial) || status === AppStatus.SIMPLIFYING}
                 className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-lg
                   ${!inputText.trim() || status === AppStatus.SIMPLIFYING 
                      ? (isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed shadow-none' : 'bg-slate-300 cursor-not-allowed shadow-none') 
                      : (isDark ? 'bg-primary hover:bg-blue-600 shadow-blue-900/20' : 'bg-primary hover:bg-blue-600 shadow-blue-200')}`}
               >
                 {status === AppStatus.SIMPLIFYING ? <><RefreshCw className="w-5 h-5 animate-spin" /> Simplifying...</> : <><Sparkles className="w-5 h-5" /> Simplify Text</>}
               </button>
          </div>
        </div>

        {/* Output Panel (Shown when active) */}
        {(status !== AppStatus.IDLE || result) && (
            <div ref={resultRef} className={`flex-1 flex flex-col rounded-3xl shadow-sm border overflow-hidden min-h-[500px] relative animate-in slide-in-from-right-8 fade-in duration-700 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
            
            <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-slate-400">
                        <Settings2 className="w-4 h-4" />
                    </div>
                    {/* Audio Controls */}
                    <div className={`flex items-center gap-2 p-1 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-slate-50 border-slate-100'}`}>
                        <button onClick={toggleAudio} disabled={!result} className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${isPlaying ? 'bg-white text-red-500 shadow-sm' : 'text-primary hover:bg-white hover:shadow-sm'} disabled:opacity-50`} title="Play/Pause (Space)">
                            {status === AppStatus.GENERATING_AUDIO ? <RefreshCw className="w-3 h-3 animate-spin" /> : isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 ml-0.5" />}
                        </button>
                        <select disabled={!result} value={voice} onChange={(e) => handleVoiceChange(e.target.value as VoiceName)} className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer hover:text-primary disabled:opacity-50 px-1 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                            {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                        </select>
                        <div className={`w-px h-3 ${isDark ? 'bg-gray-600' : 'bg-slate-200'}`}></div>
                        <select disabled={!result} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer hover:text-primary disabled:opacity-50 px-1 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                            {SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setIsFocusMode(true)} disabled={!result} className="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    {audioBuffer && (
                        <button onClick={handleDownloadAudio} className="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto ${getContainerStyles()} transition-colors`}>
                {status === AppStatus.ERROR ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 text-red-500">
                        <AlertCircle className="w-12 h-12 mb-4" />
                        <p className="font-bold">{errorMsg}</p>
                    </div>
                ) : (
                    <div className="p-8 md:p-10 flex flex-col h-full">
                        <div className="mb-6">
                           <TextControls settings={settings} onUpdate={(s) => setSettings(p => ({...p, ...s}))} />
                        </div>
                        
                        <div className="flex-1 min-h-0 flex flex-col">
                           {/* Max Width Container for Text Readability */}
                           <div className="w-full max-w-prose mx-auto flex flex-col h-full">
                              
                              {result?.summary && level !== SimplificationLevel.LEVEL_3 && currentPage === 0 && (
                                <div className={`mb-8 p-6 rounded-2xl border ${isDark ? 'bg-indigo-900/20 border-indigo-500/20' : 'bg-accent/5 border-accent/10'}`}>
                                    <h3 className={`text-xs font-extrabold uppercase tracking-widest mb-2 ${isDark ? 'text-indigo-300' : 'text-accent'} ${isRTL ? 'text-right' : 'text-left'}`}>Summary</h3>
                                    <p className={`font-medium text-lg leading-relaxed ${isDark ? 'text-gray-50' : 'text-slate-800'} ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
                                    {result.summary}
                                    </p>
                                </div>
                              )}

                              <div 
                                style={getContentStyles()} 
                                className={`whitespace-pre-wrap break-words flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                                dir={isRTL ? 'rtl' : 'ltr'}
                                lang={isRTL ? 'ar' : 'en'}
                              >
                                {renderTextContent()}
                              </div>
                           </div>
                        </div>

                        {/* Pagination Controls */}
                        {pages.length > 1 && (
                            <div className={`mt-8 flex items-center justify-center gap-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-slate-100'}`}>
                                <button 
                                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                  disabled={currentPage === 0}
                                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 disabled:opacity-30' : 'hover:bg-slate-100 disabled:opacity-30'}`}
                                >
                                   <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                                   Page {currentPage + 1} / {pages.length}
                                </span>
                                <button 
                                  onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
                                  disabled={currentPage === pages.length - 1}
                                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 disabled:opacity-30' : 'hover:bg-slate-100 disabled:opacity-30'}`}
                                >
                                   <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {result?.quiz && result.quiz.length > 0 && currentPage === pages.length - 1 && (
                        <div className={`mt-10 pt-8 border-t ${isDark ? 'border-gray-700' : 'border-slate-200/50'}`}>
                            <QuizSection questions={result.quiz} theme={settings.theme} />
                        </div>
                        )}
                    </div>
                )}
            </div>
            </div>
        )}
      </main>
    </div>
  );
}
