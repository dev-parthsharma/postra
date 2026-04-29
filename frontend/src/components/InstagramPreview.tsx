// frontend/src/components/InstagramPreview.tsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/Spinner";
// Importing original dependencies
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PostData {
  id: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  editing_guide: string | null;
  shooting_guide: string | null;
  cover_image?: string | null;
  video_url?: string | null;
  title?: string | null;
}

interface MediaItem {
  id: string;
  file_url: string;
  type: string;
  file_size: number;
  created_at: string;
}

interface InstagramPreviewProps {
  chatId?: string;
  plan: string;
}

export default function InstagramPreview({ chatId, plan }: InstagramPreviewProps) {
  const navigate = useNavigate();
  const [post, setPost] = useState<PostData | null>(null);
  const [username, setUsername] = useState("your_username");
  const [loading, setLoading] = useState(true);

  // Upload & Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── MEDIA PICKER MODAL STATES ───
  const[showMediaModal, setShowMediaModal] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ─── CROPPER STATES ───
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropImgUrl, setCropImgUrl] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const CONTAINER_W = 270;
  const CONTAINER_H = 480;

  let cropScale = 1;
  let scaledW = CONTAINER_W;
  let scaledH = CONTAINER_H;

  if (imgDimensions.w > 0 && imgDimensions.h > 0) {
    cropScale = Math.max(CONTAINER_W / imgDimensions.w, CONTAINER_H / imgDimensions.h);
    scaledW = imgDimensions.w * cropScale;
    scaledH = imgDimensions.h * cropScale;
  }

  useEffect(() => {
    if (imgDimensions.w > 0 && imgDimensions.h > 0) {
      setPan({
        x: (CONTAINER_W - scaledW) / 2,
        y: (CONTAINER_H - scaledH) / 2,
      });
    }
  },[imgDimensions, CONTAINER_W, CONTAINER_H, scaledW, scaledH]);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const isPremium = plan === "starter" || plan === "pro";

  // ─── 1. LOAD POST DATA ───
  useEffect(() => {
    if (!chatId) return;

    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data: postData, error: postErr } = await supabase
          .from("posts")
          .select("*")
          .eq("chat_id", chatId)
          .single();

        if (postErr || !postData) throw postErr;

        let finalPost: PostData = { ...postData };
        if (postData.cover_image) finalPost.cover_image = postData.cover_image;

        const { data: chatData } = await supabase
          .from("chats")
          .select("title")
          .eq("id", chatId)
          .maybeSingle();

        if (chatData) finalPost.title = chatData.title;

        try {
          const { data: mediaLinks, error: mediaErr } = await supabase
            .from("post_media")
            .select("media(file_url, type)")
            .eq("post_id", postData.id);

          if (!mediaErr && mediaLinks && mediaLinks.length > 0) {
            mediaLinks.forEach((link: any) => {
              if (link.media?.type?.includes("image")) {
                if (!finalPost.cover_image) finalPost.cover_image = link.media.file_url;
              }
              if (link.media?.type?.includes("video")) {
                finalPost.video_url = link.media.file_url;
              }
            });
          }
        } catch (mediaCatchErr) {
          console.warn("Post Media fetch warning:", mediaCatchErr);
        }

        setPost(finalPost);

        const { data: igData } = await supabase
          .from("instagram_connections")
          .select("instagram_username")
          .eq("user_id", user.id)
          .maybeSingle();

        if (igData?.instagram_username) {
          setUsername(igData.instagram_username);
        }
      } catch (err) {
        console.error("Fatal load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [chatId]);

  // ─── 2. LOAD MEDIA LIBRARY WHEN MODAL OPENS ───
  useEffect(() => {
    if (showMediaModal) {
      const fetchMedia = async () => {
        setMediaLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("media")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
          if (data) setMediaItems(data);
        }
        setMediaLoading(false);
      };
      fetchMedia();
    }
  }, [showMediaModal]);

  // ─── 3. VIDEO UPLOAD HANDLER ───
  const handleVideoUploadClick = () => {
    if (!isPremium) {
      navigate("/upgrade");
      return;
    }
    videoInputRef.current?.click();
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !post) return;

    // Strict validation
    const validTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      alert("Only MP4, WebM, and MOV videos are allowed.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed size is 50MB.`);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    setVideoUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/reel_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("postra_videos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("postra_videos")
        .getPublicUrl(fileName);
        
      const publicUrl = urlData.publicUrl;

      // Optimistic Update
      setPost((prev) => prev ? { ...prev, video_url: publicUrl } : null);
      setIsPlaying(false);

      // Delete old video link to enforce 1 video per post
      const { data: allLinks } = await supabase
        .from("post_media")
        .select("id, media_id")
        .eq("post_id", post.id);

      if (allLinks && allLinks.length > 0) {
        const mediaIds = allLinks.map(l => l.media_id);
        const { data: mediaRows } = await supabase
          .from("media")
          .select("id, type")
          .in("id", mediaIds);
          
        const videoMediaIds = mediaRows?.filter(m => m.type.includes("video")).map(m => m.id) ||[];
        const linkIdsToDelete = allLinks.filter(l => videoMediaIds.includes(l.media_id)).map(l => l.id);
        
        if (linkIdsToDelete.length > 0) {
          await supabase.from("post_media").delete().in("id", linkIdsToDelete);
        }
      }

      // Save to 'media' table (Type MUST BE 'video' - max 10 chars constraint fix)
      const { data: mediaRow, error: mediaErr } = await supabase
        .from("media")
        .insert({ 
          file_url: publicUrl, 
          type: "video", 
          user_id: user.id,
          file_size: file.size
        })
        .select()
        .single();

      if (mediaErr) {
        console.error("Media Table Insert Error:", mediaErr);
        alert("Video uploaded but failed to link with media library.");
      } else if (mediaRow) {
        // Connect media to 'posts' using 'post_media' table
        const { error: linkErr } = await supabase
          .from("post_media")
          .insert({ post_id: post.id, media_id: mediaRow.id });
          
        if (linkErr) console.warn("Failed to link video with post:", linkErr);
      }

    } catch (err: any) {
      console.error("Upload failed:", err);
      alert(`Failed to upload video: ${err.message}`);
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  // ─── 4. COVER IMAGE UPLOAD & CROP LOGIC ───
  
  const handleRemoveCover = async () => {
    if (!post) return;
    setPost({ ...post, cover_image: null });
    try {
      await supabase.from("posts").update({ cover_image: null }).eq("id", post.id);
    } catch (err) {
      console.error("Failed to remove cover:", err);
    }
  };

  const executeMediaUpload = async (fileToUpload: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !post) throw new Error("Not logged in");

      const fileExt = fileToUpload.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/cover_${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("postra_covers")
        .upload(fileName, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("postra_covers")
        .getPublicUrl(fileName);

      const newMedia = {
        user_id: user.id,
        file_url: urlData.publicUrl,
        type: fileToUpload.type.substring(0, 10),
        file_size: fileToUpload.size,
      };

      const { data: insertedData, error: dbError } = await supabase
        .from("media")
        .insert([newMedia])
        .select()
        .single();

      if (dbError) throw dbError;

      setMediaItems((prev) => [insertedData, ...prev]);
      handleMediaSelect(insertedData);

    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
      setCropFile(null);
      setCropImgUrl(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const compressAndUploadDirectly = (originalFile: File, img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    let targetW = img.width;
    let targetH = img.height;
    const MAX_W = 1080;
    const MAX_H = 1920;

    if (targetW > MAX_W || targetH > MAX_H) {
      const scale = Math.min(MAX_W / targetW, MAX_H / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      executeMediaUpload(originalFile);
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    canvas.toBlob((blob) => {
      if (!blob) {
        executeMediaUpload(originalFile);
        return;
      }
      const compressedFile = new File([blob], `compressed_${Date.now()}.jpg`, { type: "image/jpeg" });
      executeMediaUpload(compressedFile);
    }, "image/jpeg", 0.7);
  };

  const handleMediaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image for the cover.");
      return;
    }

    setUploading(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      const ratio = img.width / img.height;
      const targetRatio = 9 / 16;
      if (Math.abs(ratio - targetRatio) < 0.01) {
        compressAndUploadDirectly(file, img);
      } else {
        setUploading(false);
        setImgDimensions({ w: img.width, h: img.height });
        setCropFile(file);
        setCropImgUrl(url);
      }
    };
    
    img.onerror = () => {
      setUploading(false);
      alert("Failed to load image.");
    };
    
    img.src = url;
  };

  const handleCropPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    setPan((prev) => {
      let newX = prev.x + dx;
      let newY = prev.y + dy;
      newX = Math.min(0, Math.max(newX, CONTAINER_W - scaledW));
      newY = Math.min(0, Math.max(newY, CONTAINER_H - scaledH));
      return { x: newX, y: newY };
    });
  };

  const handleCropPointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const saveCropAndUpload = () => {
    if (!cropFile || !cropImgUrl) return;
    setUploading(true);

    const canvas = document.createElement("canvas");
    const TARGET_W = 1080;
    const TARGET_H = 1920;
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return setUploading(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scaleFactor = 1 / cropScale;
      const sourceX = Math.abs(pan.x) * scaleFactor;
      const sourceY = Math.abs(pan.y) * scaleFactor;
      const sourceW = CONTAINER_W * scaleFactor;
      const sourceH = CONTAINER_H * scaleFactor;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);
      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, TARGET_W, TARGET_H);

      canvas.toBlob((blob) => {
        if (!blob) return setUploading(false);
        const croppedFile = new File([blob], `cropped_${Date.now()}.jpg`, { type: "image/jpeg" });
        executeMediaUpload(croppedFile);
      }, "image/jpeg", 0.7);
    };
    
    img.onerror = () => {
      setUploading(false);
      alert("Failed to process image.");
    };
    
    img.src = cropImgUrl;
  };

  // ─── 5. HANDLE SELECTING IMAGE FROM LIBRARY ───
  const handleMediaSelect = async (item: MediaItem) => {
    if (!post || !post.id) {
      alert("Error: Post ID is missing. Cannot save to Database.");
      return;
    }

    if (item.type.includes("video")) {
      alert("Cover image cannot be a video. Please select an image.");
      return;
    }

    const previousCover = post.cover_image;

    // Optimistic UI Update
    setPost((prev) => prev ? { ...prev, cover_image: item.file_url } : null);
    setShowMediaModal(false);

    try {
      // Update 'posts' table with .select() to force execution check
      const { data: updatedPost, error: postErr } = await supabase
        .from("posts")
        .update({ cover_image: item.file_url })
        .eq("id", post.id)
        .select();

      if (postErr || !updatedPost || updatedPost.length === 0) {
        console.warn("Update Error / RLS Issue:", postErr);
        alert("Cover Image not saved! Please check if 'UPDATE' policy is enabled for 'posts' table in Supabase.");
        setPost((prev) => prev ? { ...prev, cover_image: previousCover } : null);
        return;
      }

      // Link inside 'post_media' table
      const { error: mediaErr } = await supabase
        .from("post_media")
        .insert({ post_id: post.id, media_id: item.id });
        
      if (mediaErr) {
        console.warn("Notice: Media already linked in post_media table or error:", mediaErr.message);
      }

    } catch (err: any) {
      console.error("DB update crash:", err);
      alert(`Unexpected Error: ${err.message}`);
      setPost((prev) => prev ? { ...prev, cover_image: previousCover } : null);
    }
  };

  const handlePublish = () => {
    alert("Publish feature coming soon! It will push this post directly to your Instagram account.");
  };

  const exportToPDF = async () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-1 h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <span className="text-slate-400 dark:text-zinc-500 text-sm animate-pulse">Loading preview...</span>
      </div>
    );
  }

  const cleanScript = post?.script?.replace(/Hook:\n.*?\n\nBody:\n/s, "").replace(/\n\nCTA:\n/s, "\n\nCTA: ") || post?.script;

  return (
    <div className="relative flex-1 overflow-y-auto bg-slate-50 dark:bg-zinc-950 print:bg-white print:fixed print:inset-0 print:z-[9999] print:block print:w-screen print:h-screen print:overflow-visible pb-10">
      
      {/* ── HIDDEN INPUTS ── */}
      <input type="file" ref={videoInputRef} onChange={handleVideoFileChange} accept="video/mp4,video/webm,video/quicktime" className="hidden" />
      
      {/* ── HEADER ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100">Post Preview</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">See how your Reel will look.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button 
            onClick={exportToPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Export PDF</span>
          </button>
          
          <button 
            onClick={handlePublish}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="hidden sm:inline">Publish to IG</span>
            <span className="inline sm:hidden">Publish</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-8 lg:gap-12 print:block print:p-8">
        
        {/* ── LEFT: INSTAGRAM MOCKUP (WITH PLAY/PAUSE) ── */}
        <div className="flex-shrink-0 flex justify-center lg:justify-end w-full lg:w-auto print:hidden">
          <div className="relative w-[280px] h-[560px] sm:w-[320px] sm:h-[640px] bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] border-[8px] sm:border-[10px] border-black shadow-2xl overflow-hidden flex flex-col group shrink-0">
            
            {/* Background Layer: Cover Image or Gradient */}
            {post?.cover_image ? (
              <img src={post.cover_image} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 to-purple-900/40" />
            )}

            {/* Video Player Layer */}
            {isPlaying && post?.video_url && (
              <video 
                src={post.video_url} 
                autoPlay 
                playsInline 
                onEnded={() => setIsPlaying(false)}
                onClick={() => setIsPlaying(false)} 
                className="absolute inset-0 w-full h-full object-cover z-10 cursor-pointer" 
              />
            )}

            {/* UI Overlay (Hidden when playing) */}
            {!isPlaying && (
              <div className="absolute inset-0 z-20 group/overlay">
                {post?.video_url ? (
                  // Overlay when video is present (Play Button)
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                    <button 
                      onClick={() => setIsPlaying(true)} 
                      className="w-16 h-16 bg-white/30 backdrop-blur-md border border-white/40 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    >
                       <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" className="text-white ml-1">
                         <path d="M8 5v14l11-7z" />
                       </svg>
                    </button>
                    
                    <button 
                      onClick={handleVideoUploadClick} 
                      className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-md text-white text-[11px] font-bold rounded-full opacity-0 group-hover/overlay:opacity-100 transition-opacity border border-white/20 whitespace-nowrap"
                    >
                      Change Video
                    </button>
                  </div>
                ) : (
                  // Overlay when no video is present (Upload Area)
                  <div 
                    onClick={handleVideoUploadClick} 
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/50 cursor-pointer transition-colors"
                  >
                    {videoUploading ? (
                      <Spinner size={32} />
                    ) : (
                      <>
                        <svg width="36" height="36" fill="none" stroke="white" strokeWidth={1.5} className="mb-2 group-hover/overlay:scale-110 transition-transform">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-[11px] sm:text-xs font-medium uppercase tracking-widest text-center px-4 text-white drop-shadow-md">
                          {isPremium ? "Upload Reel Video" : "Upgrade to Upload"}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Static UI Elements (Top & Bottom gradients and user info) */}
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-30" />

            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 sm:p-4 pt-16 sm:pt-20 pointer-events-none z-30">
              <div className="flex items-end justify-between">
                <div className="flex-1 pr-3 sm:pr-4">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border border-white/40 shrink-0">
                      You
                    </div>
                    <span className="text-white text-xs sm:text-sm font-semibold truncate">@{username}</span>
                    <button className="px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-white border border-white/40 rounded-lg backdrop-blur-sm">Follow</button>
                  </div>
                  <p className="text-white text-xs sm:text-sm line-clamp-2 leading-tight drop-shadow-md pr-2">
                    {post?.caption || "Your generated caption will appear here..."}
                  </p>
                  <div className="mt-2 sm:mt-3 flex items-center gap-2">
                    <div className="px-2 py-1 bg-black/40 backdrop-blur-md rounded-md flex items-center gap-1.5 border border-white/10">
                      <span className="text-[9px] sm:text-[10px] text-white font-medium">🎵 Original Audio</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-4 sm:gap-5 text-white pb-1 shrink-0">
                  <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="sm:w-7 sm:h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <span className="text-[10px] sm:text-xs font-semibold">12K</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="sm:w-7 sm:h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <span className="text-[10px] sm:text-xs font-semibold">142</span>
                  </div>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="sm:w-7 sm:h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: CONTENT DETAILS ── */}
        <div className="flex-1 w-full space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 print:hidden">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">Content Package</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Review, upload media, or export your post.</p>
            </div>
            
            {/* UPDATED CONTENT PACKAGE BUTTONS */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {post?.cover_image && (
                <button
                  onClick={handleRemoveCover}
                  className="p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-colors border border-red-100 dark:border-red-500/20"
                  title="Remove Cover Image"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button 
                onClick={() => isPremium ? setShowMediaModal(true) : navigate("/upgrade")} 
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${post?.cover_image ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 border-transparent'}`}
              >
                {post?.cover_image ? "✅ Cover Selected" : "Select Cover Image"}
              </button>
            </div>
          </div>

          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500"></span>
              The Hook
            </h3>
            <p className="text-slate-800 dark:text-zinc-200 text-sm sm:text-[15px] leading-relaxed font-semibold">
              {post?.hook || <span className="text-slate-400 italic">No hook selected yet.</span>}
            </p>
          </section>

          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500"></span>
              Full Script
            </h3>
            {post?.script ? (
              <div className="text-slate-700 dark:text-zinc-300 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap">
                {cleanScript}
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">Script not generated yet.</p>
            )}
          </section>

          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></span>
              Caption & Hashtags
            </h3>
            <p className="text-slate-700 dark:text-zinc-300 text-sm sm:text-[14px] leading-relaxed whitespace-pre-wrap">
              {post?.caption || <span className="text-slate-400 italic text-sm">Caption not written yet.</span>}
            </p>
          </section>
        </div>
      </div>

      {/* ── MEDIA LIBRARY PICKER MODAL ── */}
      {showMediaModal && (
        <div className="absolute inset-0 z-[100] bg-slate-50 dark:bg-zinc-950 overflow-y-auto animate-in fade-in duration-200 flex flex-col min-h-full">
          <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 relative">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[60px] pb-4 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Select Cover Image</h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                  Choose an image from your library or upload a new one.
                </p>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => alert("Generate Image coming soon!")}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <span>✨</span> Generate
                </button>

                <input 
                  type="file" 
                  ref={coverInputRef} 
                  onChange={handleMediaFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {uploading ? (
                    <Spinner size={16} />
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  {uploading ? "Uploading..." : "Upload"}
                </button>

                {/* Close Button */}
                <button 
                  onClick={() => setShowMediaModal(false)} 
                  className="ml-2 p-2.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-xl text-slate-700 dark:text-zinc-300 transition-colors"
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Media Grid */}
            {mediaLoading ? (
               <div className="flex h-[40vh] items-center justify-center">
                 <Spinner size={32} />
               </div>
            ) : mediaItems.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
                <p className="text-slate-500 dark:text-zinc-400 text-sm">No media uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {mediaItems.map((item) => {
                  const isVideo = item.type.includes("video");
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => !isVideo && handleMediaSelect(item)}
                      className={`group relative rounded-2xl overflow-hidden aspect-square border-2 transition-all ${
                        isVideo 
                          ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-zinc-800' 
                          : 'cursor-pointer border-slate-200 dark:border-zinc-700 hover:shadow-md hover:border-indigo-400'
                      }`}
                      title={isVideo ? "Cannot use video as a cover image" : "Click to select as cover"}
                    >
                      {isVideo ? (
                        <video src={item.file_url} className="w-full h-full object-cover" />
                      ) : (
                        <img 
                          src={item.file_url} 
                          alt="Media" 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                      )}
                      
                      {isVideo && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                           <span className="bg-black/70 text-white text-[10px] px-2 py-1 rounded">Video</span>
                        </div>
                      )}
                      
                      {!isVideo && (
                        <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                             Select
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── IMAGE CROPPER MODAL ── */}
      {cropFile && cropImgUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm flex flex-col items-center">
            
            <div className="text-center mb-6">
              <h3 className="text-white font-bold text-lg">Adjust Cover Image</h3>
              <p className="text-white/60 text-sm mt-1">Image must be 9:16 (Story/Reel size)</p>
            </div>

            <div 
              className="relative overflow-hidden bg-zinc-900 border border-white/20 shadow-2xl rounded-xl cursor-grab active:cursor-grabbing"
              style={{ width: CONTAINER_W, height: CONTAINER_H, touchAction: "none" }}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              <img 
                src={cropImgUrl} 
                alt="Crop preview" 
                draggable={false}
                style={{
                  position: "absolute",
                  width: `${scaledW}px`,
                  height: `${scaledH}px`,
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
                  maxWidth: "none"
                }}
              />
              
              <div className="absolute inset-0 pointer-events-none border border-white/30 flex flex-col justify-evenly opacity-50">
                <div className="border-t border-white/30 w-full" />
                <div className="border-t border-white/30 w-full" />
              </div>
              <div className="absolute inset-0 pointer-events-none border border-white/30 flex justify-evenly opacity-50">
                <div className="border-l border-white/30 h-full" />
                <div className="border-l border-white/30 h-full" />
              </div>
            </div>

            <div className="flex items-center gap-4 w-full mt-8 px-6">
              <button
                onClick={() => { setCropFile(null); setCropImgUrl(null); }}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCropAndUpload}
                disabled={uploading}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-slate-900 bg-white hover:bg-slate-200 transition-colors flex justify-center"
              >
                {uploading ? (
                  <Spinner size={20} />
                ) : (
                  "Crop & Use"
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── HIDDEN EXPORT CONTAINER (FOR PDF) ── */}
      <div ref={exportRef} style={{ display: "none" }} className="absolute top-[-9999px] left-[-9999px] w-[800px] bg-white p-12 text-black">
        <h1 className="text-3xl font-black mb-8 border-b pb-4">Postra Content Export</h1>
        <h2 className="text-xl font-bold text-indigo-600 mb-2">1. The Hook</h2>
        <p className="text-lg font-medium mb-6">{post?.hook || "N/A"}</p>
        <h2 className="text-xl font-bold text-indigo-600 mb-2">2. Video Script</h2>
        <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">{post?.script || "N/A"}</p>
        <h2 className="text-xl font-bold text-indigo-600 mb-2">3. Caption & Hashtags</h2>
        <p className="text-base whitespace-pre-wrap leading-relaxed mb-6">{post?.caption || "N/A"}</p>
      </div>

    </div>
  );
}