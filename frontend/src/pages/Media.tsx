// frontend\src\pages\Media.tsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

interface MediaItem {
  id: string;
  file_url: string;
  type: string;
  file_size: number;
  created_at: string;
}

export default function Media() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const[plan, setPlan] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const[uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── View, Selection & Delete States ────────────────────────────────────────
  const[viewItem, setViewItem] = useState<MediaItem | null>(null);
  const[isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemsToDelete, setItemsToDelete] = useState<MediaItem[] | null>(null);

  // ── Crop Modal States ──────────────────────────────────────────────────────
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
        y: (CONTAINER_H - scaledH) / 2
      });
    }
  },[imgDimensions, CONTAINER_W, CONTAINER_H, scaledW, scaledH]);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const { data: profile } = await supabase
        .from("user_profile")
        .select("plan")
        .eq("id", user.id)
        .single();
      
      const userPlan = profile?.plan?.toLowerCase() || "free";
      setPlan(userPlan);

      if (userPlan !== "free") {
        const { data: media } = await supabase
          .from("media")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (media) setMediaItems(media);
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  // ── Upload Engine ──────────────────────────────────────────────────────────
  const executeUpload = async (fileToUpload: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const fileExt = fileToUpload.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
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

      setMediaItems(prev =>[insertedData, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
      setCropFile(null);
      setCropImgUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Auto-Compress Engine for Direct Uploads (Already 9:16) ───────────────
  const compressAndUploadDirectly = (originalFile: File, img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    let targetW = img.width;
    let targetH = img.height;
    
    // Max cap at 1080x1920
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
      executeUpload(originalFile); // Fallback to original if canvas fails
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    canvas.toBlob((blob) => {
      if (!blob) {
        executeUpload(originalFile);
        return;
      }
      // Force JPEG and 70% quality (~200KB - 400KB limit)
      const compressedFile = new File([blob], `compressed_${Date.now()}.jpg`, { type: "image/jpeg" });
      executeUpload(compressedFile);
    }, "image/jpeg", 0.7);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type.startsWith("image/")) {
      setUploading(true); // Show loader while analyzing/compressing
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        const targetRatio = 9 / 16;
        
        if (Math.abs(ratio - targetRatio) < 0.01) {
          // It's 9:16 - compress & upload immediately
          compressAndUploadDirectly(file, img);
        } else {
          // Not 9:16 - open crop screen
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
    } else {
      // It's a video, upload directly without canvas processing
      executeUpload(file);
    }
  };

  // ── Cropper Engine ─────────────────────────────────────────────────────────
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

    setPan(prev => {
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
    if (!ctx) {
      setUploading(false);
      return;
    }

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
        if (!blob) {
          setUploading(false);
          return;
        }
        // Force JPEG and 70% quality (~200KB - 400KB limit)
        const croppedFile = new File([blob], `cropped_${Date.now()}.jpg`, { type: "image/jpeg" });
        executeUpload(croppedFile);
      }, "image/jpeg", 0.7);
    };
    img.onerror = () => {
      setUploading(false);
      alert("Failed to process image.");
    };
    img.src = cropImgUrl;
  };

  // ── Execute Delete (Storage + DB) ──────────────────────────────────────────
  const executeDelete = async () => {
    if (!itemsToDelete || itemsToDelete.length === 0) return;
    
    setDeleting(true);
    try {
      const pathsToDelete = itemsToDelete.map(item => {
        const parts = item.file_url.split('/postra_covers/');
        return parts.length > 1 ? parts[1] : null;
      }).filter(Boolean) as string[];

      if (pathsToDelete.length > 0) {
        await supabase.storage.from("postra_covers").remove(pathsToDelete);
      }

      const idsToDelete = itemsToDelete.map(i => i.id);
      await supabase.from("media").delete().in("id", idsToDelete);

      setMediaItems(prev => prev.filter(i => !idsToDelete.includes(i.id)));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setViewItem(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete media.");
    } finally {
      setDeleting(false);
      setItemsToDelete(null);
    }
  };

  // ── Interaction Handlers ───────────────────────────────────────────────────
  const handlePointerDown = (id: string) => {
    if (isSelectionMode) return;
    longPressTriggered.current = false;
    
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setIsSelectionMode(true);
      setSelectedIds(new Set([id]));
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
    }, 500); 
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleItemClick = (item: MediaItem) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (isSelectionMode) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
        if (newSelected.size === 0) setIsSelectionMode(false);
      } else {
        newSelected.add(item.id);
      }
      setSelectedIds(newSelected);
    } else {
      setViewItem(item);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === mediaItems.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(mediaItems.map(i => i.id)));
    }
  };

  const handleGenerateClick = () => {
    if (plan !== "pro") {
      alert("Generating content from media is available on the Pro plan!");
      return;
    }
    if (mediaItems.length === 0) {
      alert("Please upload some media first.");
      return;
    }
    alert(`Dummy Action: Opening content generator for your media...`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024, dm = 2, sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // ── Renders ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <span className="text-slate-400 dark:text-zinc-500 text-sm animate-pulse">Loading media...</span>
      </div>
    );
  }

  if (plan === "free") {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-slate-400 dark:text-zinc-500">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Media Library Locked</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-md mb-6">
          Upgrade to Starter or Pro to upload your images and videos, and generate AI content directly from them.
        </p>
        <button
          onClick={() => navigate("/upgrade")}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          View Plans
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 relative">
      
      {/* ── Dynamic Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[60px]">
        {isSelectionMode ? (
          <>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 transition-colors"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {selectedIds.size} Selected
              </h1>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleSelectAll}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                {selectedIds.size === mediaItems.length ? "Deselect All" : "Select All"}
              </button>
              <button
                onClick={() => setItemsToDelete(mediaItems.filter(i => selectedIds.has(i.id)))}
                disabled={deleting || selectedIds.size === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Media Library</h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Upload images to generate content ideas. {plan === "starter" && "(Upgrade to Pro)"}
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleGenerateClick}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  plan === "pro" 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
                }`}
                title={plan !== "pro" ? "Pro Plan required" : ""}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,video/*" 
                className="hidden" 
              />
              <button
                onClick={handleUploadClick}
                disabled={uploading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {uploading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Media Grid ── */}
      {mediaItems.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-slate-500 dark:text-zinc-400 text-sm">No media uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mediaItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div 
                key={item.id} 
                onPointerDown={() => handlePointerDown(item.id)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onClick={() => handleItemClick(item)}
                style={{ WebkitTouchCallout: "none", userSelect: "none" }}
                className={`group relative rounded-2xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                  isSelected 
                    ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]" 
                    : "border-slate-200 dark:border-zinc-700 hover:shadow-md"
                }`}
              >
                {item.type.includes("video") ? (
                  <video src={item.file_url} className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? 'scale-95 rounded-xl' : ''}`} />
                ) : (
                  <img src={item.file_url} alt="Media" className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? 'scale-95 rounded-xl' : ''}`} />
                )}
                
                {isSelectionMode && (
                  <div className="absolute top-3 left-3 z-10">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-indigo-500 border-indigo-500" : "bg-black/20 border-white backdrop-blur-sm"
                    }`}>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}

                {!isSelectionMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setItemsToDelete([item]); }}
                    className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Delete"
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}

                <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3 pointer-events-none ${isSelected ? 'opacity-100' : ''}`}>
                  {!isSelectionMode && <div />}
                  <div className="flex justify-between items-end mt-auto">
                    <span className="px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-[10px] font-medium text-white">
                      {item.type.split('/')[0].toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-white/90 drop-shadow-md">
                      {formatBytes(item.file_size)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Image Crop Editor Modal ── */}
      {cropFile && cropImgUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm flex flex-col items-center">
            
            <div className="text-center mb-6">
              <h3 className="text-white font-bold text-lg">Adjust Image</h3>
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
                Cancel Upload
              </button>
              <button
                onClick={saveCropAndUpload}
                disabled={uploading}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-slate-900 bg-white hover:bg-slate-200 transition-colors flex justify-center"
              >
                {uploading ? (
                  <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  "Crop & Upload"
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Fullscreen View Modal (z-50) ── */}
      {viewItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setViewItem(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); setItemsToDelete([viewItem]); }}
              className="p-2.5 bg-white/10 hover:bg-red-500 text-white rounded-xl backdrop-blur-md transition-colors"
              title="Delete"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewItem(null)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-colors"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div 
            className="relative max-w-5xl max-h-full w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()} 
          >
            {viewItem.type.includes("video") ? (
              <video src={viewItem.file_url} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" />
            ) : (
              <img src={viewItem.file_url} alt="Expanded Media" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            )}
          </div>
        </div>
      )}

      {/* ── Custom Delete Confirmation Modal (z-[60]) ── */}
      {itemsToDelete && itemsToDelete.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60 animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Media?</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
                  Are you sure you want to delete {itemsToDelete.length === 1 ? 'this item' : `these ${itemsToDelete.length} items`}? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setItemsToDelete(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
              >
                {deleting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}