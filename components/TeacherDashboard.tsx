
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, Clock, FileType, Loader2, Sparkles, BookOpen, Link as LinkIcon, Check, ChevronLeft, Eye, ExternalLink, Printer, Filter, X, Share2, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { TeacherMaterial, SimplificationLevel, Subject } from '../types';
import { processTeacherDocument } from '../services/geminiService';
import { compressAndEncode } from '../utils/shareUtils';

interface TeacherDashboardProps {
  onBack: () => void;
}

const SUBJECTS: Subject[] = ['General', 'Science', 'History', 'Literature', 'Geography', 'Math'];

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onBack }) => {
  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  
  // Upload State
  const [selectedSubject, setSelectedSubject] = useState<Subject>('General');
  
  // Filter State
  const [filterSubject, setFilterSubject] = useState<Subject | 'All'>('All');

  // Preview State
  const [previewMaterial, setPreviewMaterial] = useState<TeacherMaterial | null>(null);
  const [previewLevel, setPreviewLevel] = useState<SimplificationLevel>(SimplificationLevel.LEVEL_1);

  // Share Modal State
  const [shareItem, setShareItem] = useState<TeacherMaterial | null>(null);
  const [shareLevel, setShareLevel] = useState<SimplificationLevel>(SimplificationLevel.LEVEL_1);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence ---
  useEffect(() => {
    const stored = localStorage.getItem('LEXI_TEACHER_MATERIALS');
    if (stored) {
      try {
        setMaterials(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load materials from storage", e);
      }
    }
    setIsStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (isStorageLoaded) {
      localStorage.setItem('LEXI_TEACHER_MATERIALS', JSON.stringify(materials));
    }
  }, [materials, isStorageLoaded]);

  // --- Handlers ---

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.type.startsWith('text/')) {
       alert("Please upload a PDF or Text file.");
       return;
    }

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64String = (e.target?.result as string).split(',')[1];
        try {
          const material = await processTeacherDocument(base64String, file.type, file.name, selectedSubject);
          setMaterials(prev => [material, ...prev]);
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
          alert("Failed to process document. Please try again.");
          console.error(err);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this material?")) {
      return;
    }

    try {
      const response = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // We treat 404 as success (idempotent deletion) because the file might
      // be a local-only entry or already deleted on the server.
      if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => ({})); 
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      // Update UI state immediately
      setMaterials(prev => prev.filter(item => item.id !== id));
      alert("File deleted successfully");
      
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete file. Please ensure the server is running and try again.");
    }
  };

  const downloadTxt = (content: string, title: string, level: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title}_${level}.txt`;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
  };

  const downloadPDF = (content: string, title: string, level: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title} - ${level}</title>
            <style>
              body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; line-height: 1.6; color: #111827; }
              h1 { font-size: 24px; margin-bottom: 10px; color: #111827; }
              .meta { font-size: 12px; color: #6B7280; margin-bottom: 30px; border-bottom: 1px solid #E5E7EB; padding-bottom: 10px; }
              .content { white-space: pre-wrap; font-size: 14px; }
              .highlight { font-weight: bold; color: #4F46E5; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="meta">Level: ${level} | Subject: ${selectedSubject} | Lexi AI Study Buddy</div>
            <div class="content">${content.replace(/\{\{(.*?)\}\}/g, '<span class="highlight">$1</span>')}</div>
            <script>
              window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); } }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Preview Logic
  const openPreview = (material: TeacherMaterial, initialLevel: SimplificationLevel) => {
    setPreviewMaterial(material);
    setPreviewLevel(initialLevel);
  };

  const closePreview = () => {
    setPreviewMaterial(null);
  };

  // --- Share Logic ---
  const openShareModal = (item: TeacherMaterial) => {
      setShareItem(item);
      setShareLevel(SimplificationLevel.LEVEL_1); // Default
      setGeneratedLink('');
      setIsCopied(false);
  };

  const closeShareModal = () => {
      setShareItem(null);
      setGeneratedLink('');
  };

  useEffect(() => {
      const generate = async () => {
          if (shareItem) {
              try {
                  const hash = await compressAndEncode(shareItem);
                  
                  // Start with current href
                  let cleanUrl = window.location.href;
                  
                  // Remove existing query strings to ensure clean state
                  const questionMarkIndex = cleanUrl.indexOf('?');
                  if (questionMarkIndex !== -1) {
                      cleanUrl = cleanUrl.substring(0, questionMarkIndex);
                  }
                  
                  // Sanitizer for malformed protocols (common in some cloud envs or proxies)
                  // 1. Fix "googhttps://" prefix
                  if (cleanUrl.startsWith('googhttps://')) {
                      cleanUrl = cleanUrl.replace('googhttps://', 'https://');
                  }
                  // 2. Fix duplicated protocols like "https://https://"
                  cleanUrl = cleanUrl.replace(/^(https?:\/\/)+/, 'https://');

                  // Create URL object for safe parameter handling
                  const urlObj = new URL(cleanUrl);
                  
                  // If we are not on localhost, ensure https
                  if (urlObj.hostname !== 'localhost' && urlObj.protocol !== 'https:') {
                      urlObj.protocol = 'https:';
                  }

                  urlObj.searchParams.set('share', hash);
                  urlObj.searchParams.set('level', shareLevel);
                  
                  setGeneratedLink(urlObj.toString());
              } catch (e) {
                  console.error("Link generation error:", e);
                  setGeneratedLink("Error generating link");
              }
          }
      };
      generate();
  }, [shareItem, shareLevel]);

  const copyLink = async () => {
      if (generatedLink && generatedLink !== "Error generating link") {
          await navigator.clipboard.writeText(generatedLink);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  const testLink = () => {
      if (generatedLink && generatedLink !== "Error generating link") {
          window.open(generatedLink, '_blank');
      }
  };

  const filteredMaterials = filterSubject === 'All' 
    ? materials 
    : materials.filter(m => m.subject === filterSubject);

  return (
    <div className="bg-background min-h-screen text-text-main">
       {/* Header */}
       <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-6 sticky top-0 z-50">
         <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                 <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-accent" />
                  Teacher Dashboard
                </h1>
                <p className="text-slate-500 text-sm mt-1">Manage and simplify learning materials</p>
              </div>
            </div>
         </div>
       </div>

       <div className="max-w-6xl mx-auto p-8">
          
          {/* Upload Section */}
          <div className="mb-12 bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Upload Material</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Subject:</span>
                    <select 
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value as Subject)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg focus:ring-accent focus:border-accent block p-2.5"
                    >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div 
              className={`
                relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl transition-all cursor-pointer bg-slate-50/50
                ${dragActive ? 'border-accent bg-purple-50' : 'border-slate-300 hover:border-accent hover:bg-purple-50'}
                ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                onChange={handleFileChange} 
                accept=".pdf,.txt"
              />
              
              {isProcessing ? (
                <div className="flex flex-col items-center animate-pulse">
                   <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                   <p className="text-accent font-bold">Analyzing & Generating 3 simplified versions...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-white shadow-sm rounded-full mb-4 text-accent">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-bold text-slate-800 mb-1">Click to upload or drag & drop</p>
                  <p className="text-sm text-slate-400 font-medium">PDF or Text files supported</p>
                </>
              )}
            </div>
            
            {/* Upload Another Button */}
            {!isProcessing && materials.length > 0 && (
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm font-bold text-accent hover:text-purple-700 flex items-center gap-1"
                    >
                        <Upload className="w-4 h-4" /> Upload Another File
                    </button>
                </div>
            )}
          </div>

          {/* Library Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500" />
                Material Library
                </h2>

                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <div className="px-3 py-1.5 flex items-center gap-2 text-slate-400">
                        <Filter className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Filter:</span>
                    </div>
                    <select 
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value as Subject | 'All')}
                        className="bg-transparent border-none text-slate-700 text-sm font-bold focus:ring-0 cursor-pointer pr-8"
                    >
                        <option value="All">All Subjects</option>
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
            
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-20 border border-slate-200 rounded-2xl bg-white text-slate-400 font-medium">
                 {materials.length === 0 ? "No materials uploaded yet." : "No materials match the selected filter."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8">
                 {filteredMaterials.map((item) => (
                   <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 gap-4">
                         <div className="flex items-start gap-4">
                            <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                               <FileType className="w-6 h-6 text-slate-400" />
                            </div>
                            <div>
                               <h3 className="font-bold text-lg text-slate-900">{item.title}</h3>
                               <div className="flex flex-wrap items-center gap-3 mt-2">
                                  <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                      {item.subject}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-slate-500 font-bold uppercase tracking-wide">
                                    <Clock className="w-3 h-3" />
                                    {new Date(item.timestamp).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                    <CheckCircle className="w-3 h-3" />
                                    Processed
                                  </span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                             <button
                               onClick={() => openShareModal(item)}
                               className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
                             >
                               <Share2 className="w-4 h-4" /> Share
                             </button>
                             <button
                               onClick={() => handleDelete(item.id)}
                               className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                               title="Remove"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                         </div>
                      </div>

                      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                         {[
                             { level: SimplificationLevel.LEVEL_1, title: 'Standard', color: 'blue', data: item.versions.LEVEL_1 },
                             { level: SimplificationLevel.LEVEL_2, title: 'Structured', color: 'purple', data: item.versions.LEVEL_2 },
                             { level: SimplificationLevel.LEVEL_3, title: 'Short', color: 'amber', data: item.versions.LEVEL_3 }
                         ].map((ver) => (
                             <div key={ver.level} className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col hover:border-${ver.color}-200 transition-colors`}>
                                <div className="flex justify-between items-center mb-4">
                                   <span className={`text-[10px] font-extrabold uppercase bg-${ver.color}-50 text-${ver.color}-600 px-2 py-1 rounded`}>{ver.title}</span>
                                   <span className="text-xs font-bold text-slate-300">{ver.level}</span>
                                </div>
                                <p className="text-sm text-slate-600 line-clamp-4 mb-6 flex-1 font-medium leading-relaxed">
                                   {ver.data.summary || <span className="text-slate-400 italic">No summary available.</span>}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                      onClick={() => openPreview(item, ver.level)}
                                      className="col-span-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-all"
                                      title="Preview"
                                    >
                                       <Eye className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => downloadTxt(ver.data.content, item.title, ver.level)}
                                      className={`col-span-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-${ver.color}-50 hover:text-${ver.color}-600 hover:border-${ver.color}-200 flex items-center justify-center gap-1 transition-all`}
                                      title="Download Text"
                                    >
                                       <FileText className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => downloadPDF(ver.data.content, item.title, ver.level)}
                                      className={`col-span-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-${ver.color}-50 hover:text-${ver.color}-600 hover:border-${ver.color}-200 flex items-center justify-center gap-1 transition-all`}
                                      title="Download PDF"
                                    >
                                       <Printer className="w-4 h-4" />
                                    </button>
                                </div>
                             </div>
                         ))}
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
       </div>

       {/* Share Modal */}
       {shareItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-900">Share Material</h3>
                    <button onClick={closeShareModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-8">
                    <div className="mb-6">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Select Version to Share</label>
                        <div className="space-y-3">
                            {[
                                { val: SimplificationLevel.LEVEL_1, label: "Level 1 (Standard)", desc: "Simple language, full paragraphs" },
                                { val: SimplificationLevel.LEVEL_2, label: "Level 2 (Structured)", desc: "Bulleted lists, grouped ideas" },
                                { val: SimplificationLevel.LEVEL_3, label: "Level 3 (Short)", desc: "Ultra-concise summary" },
                            ].map((opt) => (
                                <button 
                                  key={opt.val}
                                  onClick={() => setShareLevel(opt.val)}
                                  className={`w-full flex items-center p-3 rounded-xl border text-left transition-all ${shareLevel === opt.val ? 'border-primary bg-blue-50 ring-1 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${shareLevel === opt.val ? 'border-primary' : 'border-slate-300'}`}>
                                        {shareLevel === opt.val && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${shareLevel === opt.val ? 'text-primary' : 'text-slate-700'}`}>{opt.label}</div>
                                        <div className="text-xs text-slate-400">{opt.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="relative">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Share Link</label>
                        <div className="flex gap-2">
                           <input 
                             type="text" 
                             readOnly 
                             value={generatedLink} 
                             className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-600 focus:outline-none"
                           />
                           <button onClick={copyLink} className="bg-primary text-white px-4 rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center min-w-[50px]">
                               {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                           </button>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <button onClick={testLink} className="text-xs font-bold text-accent hover:text-purple-700 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Test Link
                    </button>
                    <button onClick={closeShareModal} className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                        Close
                    </button>
                </div>
             </div>
          </div>
       )}

       {/* Preview Modal */}
       {previewMaterial && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                   <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                       <div className="flex items-center gap-3">
                           <div>
                               <h3 className="font-bold text-lg text-slate-900 line-clamp-1">{previewMaterial.title}</h3>
                               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{previewLevel} Preview</p>
                           </div>
                           <select 
                             value={previewLevel}
                             onChange={(e) => setPreviewLevel(e.target.value as SimplificationLevel)}
                             className="bg-slate-100 border-none text-xs font-bold text-slate-700 rounded-lg p-2 cursor-pointer focus:ring-0"
                           >
                             <option value={SimplificationLevel.LEVEL_1}>Level 1</option>
                             <option value={SimplificationLevel.LEVEL_2}>Level 2</option>
                             <option value={SimplificationLevel.LEVEL_3}>Level 3</option>
                           </select>
                       </div>
                       <button onClick={closePreview} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                           <X className="w-5 h-5" />
                       </button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {previewMaterial.versions[previewLevel]?.content ? (
                           <div className="prose prose-slate max-w-none font-readable whitespace-pre-wrap text-lg leading-relaxed text-slate-800">
                                {previewMaterial.versions[previewLevel].content.split(/(\{\{.*?\}\})/g).map((part, i) => {
                                    if (part.startsWith('{{') && part.endsWith('}}')) {
                                        return <span key={i} className="text-primary font-bold bg-blue-50 px-1 rounded">{part.slice(2, -2)}</span>;
                                    }
                                    return part;
                                })}
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center h-full text-slate-400">
                               <AlertTriangle className="w-10 h-10 mb-2 opacity-50" />
                               <p className="font-medium">No content available for this level.</p>
                           </div>
                        )}
                   </div>
                   
                   <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                       <button 
                         onClick={() => downloadPDF(previewMaterial.versions[previewLevel]?.content || '', previewMaterial.title, previewLevel)}
                         disabled={!previewMaterial.versions[previewLevel]?.content}
                         className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                       >
                           <Printer className="w-4 h-4" /> Export PDF
                       </button>
                       <button onClick={closePreview} className="px-6 py-2 rounded-xl bg-primary text-white font-bold hover:bg-blue-600 shadow-sm shadow-blue-200">
                           Done
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
