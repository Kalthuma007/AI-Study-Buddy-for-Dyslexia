import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, CheckCircle, Clock, FileType, Loader2, Sparkles, BookOpen, Link as LinkIcon, Check } from 'lucide-react';
import { TeacherMaterial, SimplificationLevel } from '../types';
import { processTeacherDocument } from '../services/geminiService';
import { compressAndEncode } from '../utils/shareUtils';

interface TeacherDashboardProps {
  onBack: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onBack }) => {
  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Basic validation
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
          const material = await processTeacherDocument(base64String, file.type, file.name);
          setMaterials(prev => [material, ...prev]);
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

  const downloadVersion = (content: string, title: string, level: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title}_${level}.txt`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  const handleShare = async (material: TeacherMaterial) => {
    try {
      const hash = await compressAndEncode(material);
      const url = `${window.location.origin}${window.location.pathname}?share=${hash}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(material.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to generate link", err);
      alert("Could not generate share link.");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
       {/* Header */}
       <div className="bg-white border-b border-slate-200 px-8 py-6">
         <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                Teacher Dashboard
              </h1>
              <p className="text-slate-500 text-sm mt-1">Manage and simplify learning materials</p>
            </div>
         </div>
       </div>

       <div className="max-w-5xl mx-auto p-8">
          
          {/* Upload Section */}
          <div className="mb-12">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Upload Material</h2>
            <div 
              className={`
                relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl transition-all cursor-pointer bg-white
                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}
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
                   <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                   <p className="text-blue-900 font-medium">Analyzing & Generating 3 simplified versions...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-blue-100 rounded-full mb-4 text-blue-600">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-medium text-slate-700 mb-1">Click to upload or drag & drop</p>
                  <p className="text-sm text-slate-400">PDF or Text files supported</p>
                </>
              )}
            </div>
          </div>

          {/* Library Section */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              Material Library
            </h2>
            
            {materials.length === 0 ? (
              <div className="text-center py-20 border border-slate-200 rounded-2xl bg-white text-slate-400">
                 No materials uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                 {materials.map((item) => (
                   <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                         <div className="flex items-start gap-4">
                            <div className="p-3 bg-slate-100 rounded-lg">
                               <FileType className="w-6 h-6 text-slate-500" />
                            </div>
                            <div>
                               <h3 className="font-bold text-lg text-slate-900">{item.title}</h3>
                               <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium uppercase tracking-wide">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(item.timestamp).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-3 h-3" />
                                    Processed
                                  </span>
                               </div>
                            </div>
                         </div>
                         <button
                           onClick={() => handleShare(item)}
                           className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                         >
                           {copiedId === item.id ? (
                             <>
                               <Check className="w-4 h-4" /> Copied
                             </>
                           ) : (
                             <>
                               <LinkIcon className="w-4 h-4" /> Share Link
                             </>
                           )}
                         </button>
                      </div>

                      <div className="bg-slate-50/50 p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                         {/* Level 1 Card */}
                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                               <span className="text-xs font-bold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded">Level 1</span>
                               <span className="text-xs text-slate-400">Standard</span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">
                               {item.versions.LEVEL_1.summary}
                            </p>
                            <button 
                              onClick={() => downloadVersion(item.versions.LEVEL_1.content, item.title, "Level_1")}
                              className="w-full py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
                            >
                               <Download className="w-4 h-4" /> Download
                            </button>
                         </div>

                         {/* Level 2 Card */}
                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                               <span className="text-xs font-bold text-purple-600 uppercase bg-purple-50 px-2 py-1 rounded">Level 2</span>
                               <span className="text-xs text-slate-400">Bullets</span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">
                               {item.versions.LEVEL_2.summary}
                            </p>
                            <button 
                              onClick={() => downloadVersion(item.versions.LEVEL_2.content, item.title, "Level_2")}
                              className="w-full py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-purple-600 flex items-center justify-center gap-2 transition-colors"
                            >
                               <Download className="w-4 h-4" /> Download
                            </button>
                         </div>

                         {/* Level 3 Card */}
                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                               <span className="text-xs font-bold text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded">Level 3</span>
                               <span className="text-xs text-slate-400">Short</span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">
                               {item.versions.LEVEL_3.summary}
                            </p>
                            <button 
                              onClick={() => downloadVersion(item.versions.LEVEL_3.content, item.title, "Level_3")}
                              className="w-full py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-amber-600 flex items-center justify-center gap-2 transition-colors"
                            >
                               <Download className="w-4 h-4" /> Download
                            </button>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
       </div>
    </div>
  );
};