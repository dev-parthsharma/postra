// frontend/src/components/InstagramPreview.tsx

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Spinner } from "../components/Spinner"

interface PostData {
  id: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  editing_guide: string | null;
  shooting_guide: string | null;
  cover_image: string | null;
  status: string;
}

interface InstagramPreviewProps {
  chatId?: string;
  plan: string;
}

export default function InstagramPreview({ chatId, plan }: InstagramPreviewProps) {
  const [post, setPost] = useState<PostData | null>(null);
  const [username, setUsername] = useState("your_username");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId) return;

    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Post Data
      const { data: postData } = await supabase
        .from("posts")
        .select("*")
        .eq("chat_id", chatId)
        .single();

      if (postData) setPost(postData);

      // Fetch IG Profile Data (if connected)
      const { data: igData } = await supabase
        .from("instagram_connections")
        .select("instagram_username")
        .eq("user_id", user.id)
        .maybeSingle();

      if (igData?.instagram_username) {
        setUsername(igData.instagram_username);
      }

      setLoading(false);
    };

    loadData();
  }, [chatId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !post) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/cover_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("postra_covers")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("postra_covers")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update DB
      await supabase
        .from("posts")
        .update({ cover_image: publicUrl })
        .eq("id", post.id);

      setPost({ ...post, cover_image: publicUrl });
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload cover image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportToPDF = async () => {
    if (!exportRef.current || !post) return;
    setExporting(true);

    try {
      // Temporarily make the hidden export div visible
      exportRef.current.style.display = "block";

      const canvas = await html2canvas(exportRef.current, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: "#ffffff"
      });

      exportRef.current.style.display = "none";

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Postra_Content_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  const isVideo = post?.cover_image?.match(/\.(mp4|mov|webm)$/i);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-slate-400 dark:text-zinc-500 text-sm animate-pulse">Loading preview...</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-slate-400 dark:text-zinc-500">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Post Data Yet</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
          Please interact with the chat to generate a hook or script first.
        </p>
      </div>
    );
  }

  return (
    // 🟢 FIX 1: Mobile pe overflow-y-auto rakha hai taaki poora page scroll ho, 
    // par lg pe overflow-hidden kar diya taaki dono columns alag-alag scroll hon.
    <div className="flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden bg-slate-50 dark:bg-zinc-950">
      
      {/* ── LEFT COLUMN: INSTAGRAM PREVIEW UI ── */}
      <div className="lg:w-[420px] flex-shrink-0 flex items-center justify-center py-10 px-4 sm:p-6 lg:bg-slate-100/50 dark:lg:bg-zinc-900/30 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-zinc-800 lg:overflow-y-auto">
        
        {/* Mobile Phone Mockup */}
        {/* 🟢 FIX 2: Mobile pe mockup scale down (w-[280px] h-[560px]) aur sm/lg pe normal (w-[320px] h-[650px]) */}
        <div className="w-[280px] h-[560px] sm:w-[320px] sm:h-[650px] shrink-0 bg-black rounded-[2.5rem] sm:rounded-[40px] shadow-2xl overflow-hidden relative border-[6px] sm:border-[8px] border-slate-800 dark:border-zinc-800 ring-1 ring-slate-200/50 dark:ring-black">
          
          {/* Top Notch/UI */}
          <div className="absolute top-0 inset-x-0 h-6 sm:h-7 flex items-center justify-between px-5 sm:px-6 z-20 text-white">
            <span className="text-[9px] sm:text-[10px] font-semibold">9:41</span>
            <div className="flex gap-1.5">
              <div className="w-3 h-2 sm:w-3.5 sm:h-2.5 bg-white rounded-sm" />
              <div className="w-2.5 h-2 sm:w-3 sm:h-2.5 bg-white rounded-sm" />
            </div>
          </div>

          {/* Media Background */}
          <div className="absolute inset-0 z-0 bg-zinc-900 flex items-center justify-center">
            {post.cover_image ? (
              isVideo ? (
                <video src={post.cover_image} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-90" />
              ) : (
                <img src={post.cover_image} alt="Cover" className="w-full h-full object-cover opacity-90" />
              )
            ) : (
              <div className="flex flex-col items-center justify-center opacity-30">
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.5} className="mb-2 sm:w-12 sm:h-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-white text-[10px] sm:text-xs font-semibold">No media uploaded</span>
              </div>
            )}
          </div>

          {/* Gradient Overlays for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-10 pointer-events-none" />

          {/* Reel Top Bar */}
          <div className="absolute top-8 sm:top-10 left-4 right-4 z-20 flex justify-between items-center text-white">
            <span className="text-base sm:text-lg font-bold tracking-tight">Reels</span>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {/* Bottom Info Area */}
          <div className="absolute bottom-3 sm:bottom-4 left-3 right-12 sm:right-14 z-20 text-white">
            <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[1.5px]">
                <div className="w-full h-full bg-zinc-900 rounded-full border-2 border-black" />
              </div>
              <span className="font-semibold text-xs sm:text-sm drop-shadow-md">{username}</span>
              <button className="px-1.5 sm:px-2 py-0.5 border border-white rounded-md text-[9px] sm:text-[10px] font-semibold backdrop-blur-sm bg-white/10">Follow</button>
            </div>
            
            {/* Caption Preview */}
            <div className="text-[11px] sm:text-[13px] leading-snug drop-shadow-md line-clamp-2">
              {post.caption ? post.caption : "Your catchy Instagram caption will appear here..."}
            </div>

            {/* Audio Track */}
            <div className="flex items-center gap-1.5 mt-2 bg-black/30 backdrop-blur-md w-fit px-2 py-1 rounded-full border border-white/10">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} className="sm:w-3 sm:h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="text-[9px] sm:text-[10px] font-medium truncate max-w-[100px] sm:max-w-[120px]">Original Audio - {username}</span>
            </div>
          </div>

          {/* Right Action Sidebar */}
          <div className="absolute bottom-3 sm:bottom-4 right-2 z-20 flex flex-col items-center gap-4 sm:gap-5 text-white">
            <div className="flex flex-col items-center gap-1">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} className="sm:w-7 sm:h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              <span className="text-[10px] sm:text-xs font-semibold drop-shadow-md">0</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} className="sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="text-[10px] sm:text-xs font-semibold drop-shadow-md">0</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2} className="sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              <span className="text-[10px] sm:text-xs font-semibold drop-shadow-md">Share</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-zinc-800 rounded-md border-2 border-white/80 overflow-hidden flex-shrink-0 mt-1">
              {post.cover_image && <img src={post.cover_image} className="w-full h-full object-cover" />}
            </div>
          </div>
        </div>

      </div>

      {/* ── RIGHT COLUMN: POST DETAILS & ACTIONS ── */}
      {/* 🟢 FIX 3: lg pe independent scroll (overflow-y-auto), mobile pe natural flow */}
      <div className="flex-1 lg:overflow-y-auto p-4 sm:p-6 lg:p-8 pb-16 lg:pb-8">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
          
          {/* Header & Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">Content Package</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Review, upload media, or export your post.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
              <button
                onClick={handleUploadClick}
                disabled={uploading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs sm:text-sm font-semibold transition-all disabled:opacity-50"
              >
                {uploading ? <Spinner size={16} /> : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                Cover
              </button>
              <button
                onClick={exportToPDF}
                disabled={exporting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {exporting ? <Spinner size={16} /> : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                Export PDF
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            
            {/* Hook & Script */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
                <span className="text-base sm:text-lg">📝</span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">Video Script</h3>
              </div>
              <div className="p-4 sm:p-5">
                {post.hook && (
                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Selected Hook</span>
                    <p className="text-[13px] sm:text-[15px] font-medium text-slate-800 dark:text-zinc-200">{post.hook}</p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Spoken Script</span>
                  {post.script ? (
                    <p className="text-[13px] sm:text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{post.script}</p>
                  ) : (
                    <p className="text-[13px] sm:text-sm text-slate-400 italic">Generate a script in the chat first.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
                <span className="text-base sm:text-lg">✍️</span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">Caption & Hashtags</h3>
              </div>
              <div className="p-4 sm:p-5">
                {post.caption ? (
                  <p className="text-[13px] sm:text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                ) : (
                  <p className="text-[13px] sm:text-sm text-slate-400 italic">Generate a caption in the chat first.</p>
                )}
              </div>
            </div>

            {/* Guides */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
                  <span className="text-base sm:text-lg">🎥</span>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">Shooting Guide</h3>
                </div>
                <div className="p-4 sm:p-5">
                  {post.shooting_guide ? (
                    <p className="text-[13px] sm:text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{post.shooting_guide}</p>
                  ) : (
                    <p className="text-[13px] sm:text-sm text-slate-400 italic">Generate shooting guide in chat.</p>
                  )}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
                  <span className="text-base sm:text-lg">✂️</span>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">Editing Guide</h3>
                </div>
                <div className="p-4 sm:p-5">
                  {post.editing_guide ? (
                    <p className="text-[13px] sm:text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{post.editing_guide}</p>
                  ) : (
                    <p className="text-[13px] sm:text-sm text-slate-400 italic">Generate editing guide in chat.</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── HIDDEN EXPORT CONTAINER (FOR HIGH QUALITY PDF) ── */}
      <div 
        ref={exportRef} 
        style={{ display: "none" }}
        className="absolute top-[-9999px] left-[-9999px] w-[800px] bg-white p-12 text-black"
      >
        <div className="flex items-center gap-3 mb-8 border-b pb-4">
          <img src="https://postra-landing.vercel.app/assets/postra.png" className="w-10 h-10" />
          <h1 className="text-3xl font-black">Postra Content Export</h1>
        </div>
        
        <h2 className="text-xl font-bold text-indigo-600 mb-2">1. The Hook</h2>
        <p className="text-lg font-medium mb-6">{post.hook || "N/A"}</p>

        <h2 className="text-xl font-bold text-indigo-600 mb-2">2. Video Script</h2>
        <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">{post.script || "N/A"}</p>

        <h2 className="text-xl font-bold text-indigo-600 mb-2">3. Caption & Hashtags</h2>
        <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">{post.caption || "N/A"}</p>

        <h2 className="text-xl font-bold text-indigo-600 mb-2">4. Shooting Guide</h2>
        <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">{post.shooting_guide || "N/A"}</p>

        <h2 className="text-xl font-bold text-indigo-600 mb-2">5. Editing Guide</h2>
        <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">{post.editing_guide || "N/A"}</p>
      </div>

    </div>
  );
}