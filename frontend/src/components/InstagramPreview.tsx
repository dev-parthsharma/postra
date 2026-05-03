// frontend/src/components/InstagramPreview.tsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/Spinner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { API_BASE } from "../lib/apiBase"; 

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
  status?: string;
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

// ─── MARKDOWN RENDERER ───
const renderMarkdownToHtml = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[\*\-]\s+(.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul style="margin:8px 0 8px 20px; list-style:disc;">${match}</ul>`)
    .replace(/\n\n/g, "</p><p style='margin-bottom:12px;'>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p style='margin-bottom:12px;'>")
    .replace(/$/, "</p>");
};

// ─── INLINE EDITABLE FIELD COMPONENT ───
function EditableField({
  value,
  onSave,
  label,
  color,
  multiline = true,
  disabled = false,
}: {
  value: string | null;
  onSave: (newValue: string) => Promise<void>;
  label: string;
  color: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const handleSave = async () => {
    if (draft === (value || "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setDraft(value || "");
      setEditing(false);
    }
    // Ctrl/Cmd + Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSave();
    }
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={handleKeyDown}
          rows={multiline ? 6 : 2}
          className="w-full text-slate-800 dark:text-zinc-200 text-sm sm:text-[15px] leading-relaxed bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          style={{ minHeight: multiline ? "120px" : "60px", overflow: "hidden" }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? <Spinner size={12} /> : (
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => { setDraft(value || ""); setEditing(false); }}
            className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-600 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-all"
          >
            Cancel
          </button>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-auto">Ctrl+Enter to save • Esc to cancel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="text-slate-700 dark:text-zinc-300 text-sm sm:text-[15px] leading-relaxed">
        {value ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(value) }}
          />
        ) : (
          <span className="text-slate-400 italic">Not generated yet.</span>
        )}
      </div>
      
      {!disabled && (
        <button
          onClick={() => setEditing(true)}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-semibold rounded-lg shadow-sm transition-all"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit
        </button>
      )}
    </div>
  );
}

export default function InstagramPreview({ chatId, plan }: InstagramPreviewProps) {
  const navigate = useNavigate();
  const [post, setPost] = useState<PostData | null>(null);
  const [username, setUsername] = useState("your_username");
  const [loading, setLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropImgUrl, setCropImgUrl] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const [upgradeToast, setUpgradeToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState(0);
  const [manualPublishing, setManualPublishing] = useState(false);
  const [streakToast, setStreakToast] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });

  const publishMessages = [
    "Packaging your Reel & Caption...",
    "Sending media to Meta servers...",
    "Waiting for Instagram to process the video...",
    "Applying finishing touches...",
  ];

  useEffect(() => {
    if (!isPublishing) { setPublishStep(0); return; }
    const interval = setInterval(() => {
      setPublishStep((prev) => (prev < publishMessages.length - 1 ? prev + 1 : prev));
    }, 15000);
    return () => clearInterval(interval);
  }, [isPublishing]);

  const showPremiumToast = (message: string) => {
    setUpgradeToast({ show: true, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setUpgradeToast({ show: false, message: "" });
    }, 5000);
  };

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
      setPan({ x: (CONTAINER_W - scaledW) / 2, y: (CONTAINER_H - scaledH) / 2 });
    }
  }, [imgDimensions, CONTAINER_W, CONTAINER_H, scaledW, scaledH]);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const isPremium = plan === "starter" || plan === "pro";
  const isPublished = post?.status === "published";

  // ─── 1. LOAD POST DATA ───
  useEffect(() => {
    if (!chatId) return;
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const { data: postData, error: postErr } = await supabase
          .from("posts").select("*").eq("chat_id", chatId).single();
        if (postErr || !postData) throw postErr;

        let finalPost: PostData = { ...postData };
        if (postData.cover_image) finalPost.cover_image = postData.cover_image;

        const { data: chatData } = await supabase
          .from("chats").select("title").eq("id", chatId).maybeSingle();
        if (chatData) finalPost.title = chatData.title;

        try {
          const { data: mediaLinks, error: mediaErr } = await supabase
            .from("post_media").select("media(file_url, type)").eq("post_id", postData.id);
          if (!mediaErr && mediaLinks && mediaLinks.length > 0) {
            mediaLinks.forEach((link: any) => {
              if (link.media?.type?.includes("image")) {
                if (!finalPost.cover_image) finalPost.cover_image = link.media.file_url;
              }
              if (link.media?.type?.includes("video")) finalPost.video_url = link.media.file_url;
            });
          }
        } catch (mediaCatchErr) {
          console.warn("Post Media fetch warning:", mediaCatchErr);
        }

        setPost(finalPost);

        const { data: igData } = await supabase
          .from("instagram_connections").select("instagram_username")
          .eq("user_id", user.id).maybeSingle();
        if (igData?.instagram_username) setUsername(igData.instagram_username);
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
    if (showMediaModal || showVideoModal) {
      const fetchMedia = async () => {
        setMediaLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from("media").select("*")
            .eq("user_id", user.id).order("created_at", { ascending: false });
          if (data) setMediaItems(data);
        }
        setMediaLoading(false);
      };
      fetchMedia();
    }
  }, [showMediaModal, showVideoModal]);

  // ─── 3. DB UPDATE HELPERS ───
  const updatePostField = async (field: keyof PostData, value: string) => {
    if (!post?.id) return;
    const { error } = await supabase.from("posts").update({ [field]: value }).eq("id", post.id);
    if (error) {
      console.error(`Failed to update ${field}:`, error);
      throw error;
    }
    setPost((prev) => prev ? { ...prev, [field]: value } : null);
  };

  // ─── 4. VIDEO UPLOAD HANDLERS ───
  const handleVideoUploadClick = () => {
    if (isPublished) { alert("Post is published! Cannot modify video."); return; }
    if (!isPremium) { showPremiumToast("Video uploading is a Premium feature."); return; }
    setShowVideoModal(true);
  };

  // FIX #2: Video select karte hi modal band, video URL set karo — loading ka wait nahi
  const handleVideoSelect = async (item: MediaItem) => {
    if (isPublished) return;
    if (!post || !post.id) return;
    if (!item.type.includes("video")) { alert("Please select a video file."); return; }

    // ✅ Turant modal band karo aur video set karo
    setShowVideoModal(false);
    setIsPlaying(false);
    setPost((prev) => prev ? { ...prev, video_url: item.file_url } : null);

    // Background me DB update
    try {
      const { data: allLinks } = await supabase.from("post_media").select("id, media_id").eq("post_id", post.id);
      if (allLinks && allLinks.length > 0) {
        const mediaIds = allLinks.map((l: any) => l.media_id);
        const { data: mediaRows } = await supabase.from("media").select("id, type").in("id", mediaIds);
        const videoMediaIds = mediaRows?.filter((m: any) => m.type.includes("video")).map((m: any) => m.id) || [];
        const linkIdsToDelete = allLinks.filter((l: any) => videoMediaIds.includes(l.media_id)).map((l: any) => l.id);
        if (linkIdsToDelete.length > 0) {
          await supabase.from("post_media").delete().in("id", linkIdsToDelete);
        }
      }
      await supabase.from("post_media").insert({ post_id: post.id, media_id: item.id });
    } catch (err: any) {
      console.error("Link failed:", err);
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPublished) return;
    const file = e.target.files?.[0];
    if (!file || !post) return;

    const validTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!validTypes.includes(file.type)) { alert("Only MP4, WebM, and MOV videos are allowed."); return; }
    if (file.size > 50 * 1024 * 1024) { alert("File too large (Max 50MB)."); return; }

    // ✅ Modal turant band karo, background me upload
    setShowVideoModal(false);
    setVideoUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/reel_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("postra_videos").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("postra_videos").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const { data: mediaRow, error: mediaErr } = await supabase
        .from("media")
        .insert({ file_url: publicUrl, type: "video", user_id: user.id, file_size: file.size })
        .select().single();
      if (mediaErr) throw mediaErr;

      const { error: linkErr } = await supabase
        .from("post_media").insert({ post_id: post.id, media_id: mediaRow.id }).select();
      if (linkErr) throw linkErr;

      setPost((prev) => prev ? { ...prev, video_url: publicUrl } : null);
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Failed to upload video: " + err.message);
    } finally {
      setVideoUploading(false);
    }
  };

  // ─── 5. COVER IMAGE UPLOAD & CROP ───
  const handleRemoveCover = async () => {
    if (isPublished) return;
    if (!post) return;
    setPost({ ...post, cover_image: null });
    try { await supabase.from("posts").update({ cover_image: null }).eq("id", post.id); }
    catch (err) { console.error("Failed to remove cover:", err); }
  };

  const executeMediaUpload = async (fileToUpload: File) => {
    if (isPublished) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !post) throw new Error("Not logged in");

      const fileExt = fileToUpload.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/cover_${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("postra_covers").upload(fileName, fileToUpload);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("postra_covers").getPublicUrl(fileName);

      const newMedia = {
        user_id: user.id,
        file_url: urlData.publicUrl,
        type: fileToUpload.type.substring(0, 10),
        file_size: fileToUpload.size,
      };

      const { data: insertedData, error: dbError } = await supabase
        .from("media").insert([newMedia]).select().single();
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

    if (!ctx) { executeMediaUpload(originalFile); return; }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    canvas.toBlob((blob) => {
      if (!blob) { executeMediaUpload(originalFile); return; }
      const compressedFile = new File([blob], `compressed_${Date.now()}.jpg`, { type: "image/jpeg" });
      executeMediaUpload(compressedFile);
    }, "image/jpeg", 0.7);
  };

  const handleMediaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPublished) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) { alert("Please upload an image for the cover."); return; }

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

    img.onerror = () => { setUploading(false); alert("Failed to load image."); };
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
      let newX = Math.min(0, Math.max(prev.x + dx, CONTAINER_W - scaledW));
      let newY = Math.min(0, Math.max(prev.y + dy, CONTAINER_H - scaledH));
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
    img.onerror = () => { setUploading(false); alert("Failed to process image."); };
    img.src = cropImgUrl;
  };

  // ─── 6. MEDIA SELECT FROM LIBRARY ───
  const handleMediaSelect = async (item: MediaItem) => {
    if (isPublished) return;
    if (!post || !post.id) { alert("Error: Post ID is missing."); return; }
    if (item.type.includes("video")) { alert("Cover image cannot be a video."); return; }

    const previousCover = post.cover_image;
    setPost((prev) => prev ? { ...prev, cover_image: item.file_url } : null);
    setShowMediaModal(false);

    try {
      const { data: updatedPost, error: postErr } = await supabase
        .from("posts").update({ cover_image: item.file_url }).eq("id", post.id).select();
      if (postErr || !updatedPost || updatedPost.length === 0) {
        alert("Cover Image not saved! Check Supabase UPDATE policy.");
        setPost((prev) => prev ? { ...prev, cover_image: previousCover } : null);
        return;
      }
      const { error: mediaErr } = await supabase.from("post_media").insert({ post_id: post.id, media_id: item.id });
      if (mediaErr) console.warn("Media link warning:", mediaErr.message);
    } catch (err: any) {
      console.error("DB update crash:", err);
      setPost((prev) => prev ? { ...prev, cover_image: previousCover } : null);
    }
  };

  const handleManualPublish = async () => {
    setManualPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/integrations/instagram/manual-publish/${post!.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail);
      setStreakToast({ show: true, count: result.streak_count });
      setTimeout(() => setStreakToast({ show: false, count: 0 }), 4000);
      setPost((prev) => prev ? { ...prev, status: "published" } : null);
    } catch (e: any) {
      alert("Error marking as published: " + e.message);
    } finally {
      setManualPublishing(false);
    }
  };

  const handlePublish = async () => {
    const hasReel = post?.video_url;
    if (!hasReel) { alert("Please attach a video first!"); return; }
    setIsPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/integrations/instagram/publish/${post!.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || "Publish failed");
      setPost((prev) => prev ? { ...prev, status: "published" } : null);
      alert("Published successfully! 🚀");
    } catch (e: any) {
      alert("Failed to publish: " + e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const renderMarkdownToHtml = (text: string): string => {
    return text
      // Bold: **text** → <strong>
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Bullet points: lines starting with * or - → proper list items
      .replace(/^[\*\-]\s+(.*)$/gm, "<li>$1</li>")
      // Wrap consecutive <li> in <ul>
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul style="margin:8px 0 8px 20px; list-style:disc;">${match}</ul>`)
      // Double newline → paragraph break
      .replace(/\n\n/g, "</p><p style='margin-bottom:12px;'>")
      // Single newline → line break
      .replace(/\n/g, "<br/>")
      // Wrap in paragraph
      .replace(/^/, "<p style='margin-bottom:12px;'>")
      .replace(/$/, "</p>");
  };

  const exportToPDF = async () => {
    if (!post) return;
    setExporting(true);

    try {
      const exportEl = exportRef.current;
      if (!exportEl) return;

      // Temporarily show the hidden export div
      exportEl.style.display = "block";
      exportEl.style.position = "fixed";
      exportEl.style.top = "0";
      exportEl.style.left = "0";
      exportEl.style.zIndex = "-1";
      exportEl.style.width = "800px";

      await new Promise((r) => setTimeout(r, 100)); // let DOM render

      const canvas = await html2canvas(exportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 800,
      });

      exportEl.style.display = "none";
      exportEl.style.position = "absolute";
      exportEl.style.top = "-9999px";
      exportEl.style.left = "-9999px";
      exportEl.style.zIndex = "";

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let yPos = 0;
      let remainingH = imgH;

      // Multi-page: agar content lamba ho to agle page pe continue karo
      while (remainingH > 0) {
        pdf.addImage(imgData, "PNG", 0, -yPos, imgW, imgH);
        remainingH -= pageH;
        yPos += pageH;
        if (remainingH > 0) pdf.addPage();
      }

      // ✅ Auto filename with post title
      const safeTitle = post.title
        ? post.title.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-").substring(0, 40)
        : "content";
      const fileName = `Postra-${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`;

      pdf.save(fileName);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
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

          {plan === "free" ? (
            <button
              disabled={manualPublishing || isPublished}
              onClick={handleManualPublish}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-xl transition-all ${(manualPublishing || isPublished) ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-500 active:scale-95"}`}
            >
              {isPublished ? "Posted ✅" : manualPublishing ? "Saving..." : "Mark as Posted ✅"}
            </button>
          ) : (
            <button
              disabled={!post?.video_url || isPublishing || isPublished}
              onClick={handlePublish}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white text-xs sm:text-sm font-bold rounded-xl transition-all ${(!post?.video_url || isPublishing || isPublished) ? "opacity-50 cursor-not-allowed grayscale" : "hover:from-fuchsia-500 hover:to-indigo-500 shadow-indigo-500/20 active:scale-95"}`}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>{isPublished ? "Published!" : isPublishing ? "Publishing..." : "Publish to IG"}</span>
            </button>
          )}

          {streakToast.show && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-5 fade-in duration-300">
              <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-500/30 text-slate-800 dark:text-white px-5 py-3 rounded-full shadow-2xl">
                <span className="text-xl">🔥</span>
                <span className="text-sm font-bold">Awesome! You're on a {streakToast.count}-Day Streak!</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-8 lg:gap-12 print:block print:p-8">

        {/* ── LEFT: INSTAGRAM MOCKUP ── */}
        <div className="flex-shrink-0 flex justify-center lg:justify-end w-full lg:w-auto print:hidden">
          <div className="relative w-[280px] h-[560px] sm:w-[320px] sm:h-[640px] bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] border-[8px] sm:border-[10px] border-black shadow-2xl overflow-hidden flex flex-col group shrink-0">

            {post?.cover_image ? (
              <img src={post.cover_image} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 to-purple-900/40" />
            )}

            {isPlaying && post?.video_url && (
              <video src={post.video_url} autoPlay playsInline onEnded={() => setIsPlaying(false)} onClick={() => setIsPlaying(false)} className="absolute inset-0 w-full h-full object-cover z-10 cursor-pointer" />
            )}

            {!isPlaying && (
              <div className="absolute inset-0 z-20 group/overlay">
                {post?.video_url ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                    <button onClick={() => setIsPlaying(true)} className="w-16 h-16 bg-white/30 backdrop-blur-md border border-white/40 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                      <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" className="text-white ml-1"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    {!isPublished && (
                      <button onClick={(e) => { e.stopPropagation(); handleVideoUploadClick(); }} className="absolute top-4 right-4 sm:top-6 sm:left-1/2 sm:-translate-x-1/2 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/60 sm:bg-black/50 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold rounded-full opacity-100 sm:opacity-0 group-hover/overlay:opacity-100 transition-opacity border border-white/20 whitespace-nowrap z-50">
                        Change Video
                      </button>
                    )}
                  </div>
                ) : (
                  <div onClick={isPublished ? undefined : handleVideoUploadClick} className={`absolute inset-0 flex flex-col items-center justify-center bg-black/40 transition-colors ${isPublished ? "" : "hover:bg-black/50 cursor-pointer"}`}>
                    {videoUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Spinner size={32} />
                        <span className="text-[11px] text-white/70 font-medium">Uploading video...</span>
                      </div>
                    ) : (
                      <>
                        {!isPublished && (
                          <svg width="36" height="36" fill="none" stroke="white" strokeWidth={1.5} className="mb-2 group-hover/overlay:scale-110 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        <span className="text-[11px] sm:text-xs font-medium uppercase tracking-widest text-center px-4 text-white drop-shadow-md">
                          {isPublished ? "Video Locked" : isPremium ? "Upload Reel Video" : "Upgrade to Upload"}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-30" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 sm:p-4 pt-16 sm:pt-20 pointer-events-none z-30">
              <div className="flex items-end justify-between">
                <div className="flex-1 pr-3 sm:pr-4">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border border-white/40 shrink-0">You</div>
                    <span className="text-white text-xs sm:text-sm font-semibold truncate">@{username}</span>
                    <button className="px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-white border border-white/40 rounded-lg backdrop-blur-sm">Follow</button>
                  </div>
                  <p className="text-white text-xs sm:text-sm line-clamp-2 leading-tight drop-shadow-md pr-2">{post?.caption || "Your generated caption will appear here..."}</p>
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
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {post?.cover_image && !isPublished && (
                <button onClick={handleRemoveCover} className="p-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-colors border border-red-100 dark:border-red-500/20" title="Remove Cover Image">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
              <button
                disabled={isPublished}
                onClick={() => {
                  if (isPremium) setShowMediaModal(true);
                  else showPremiumToast("Custom cover images are available on Starter & Pro plans.");
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${isPublished ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-transparent cursor-not-allowed opacity-60" : post?.cover_image ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30" : "bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 border-transparent"}`}
              >
                {post?.cover_image ? "✅ Cover Selected" : "Select Cover Image"}
              </button>
            </div>
          </div>

          {/* ── FIX #3: Hook section — "No hook selected yet." dikhaye, "idea" nahi ── */}
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-[11px] sm:text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500"></span>
                The Hook
              </h3>
            </div>
            {/* FIX #1: Hook editable — lekin sirf tab dikhaye jab hook actually hai */}
            {post?.hook ? (
              <div className="text-slate-800 dark:text-zinc-200 text-sm sm:text-[15px] leading-relaxed font-semibold">
                <EditableField
                  value={post.hook}
                  onSave={(v) => updatePostField("hook", v)}
                  label="Hook"
                  color="indigo"
                  multiline={false}
                  disabled={isPublished}
                />
              </div>
            ) : (
              // FIX #3: "No hook selected yet." — koi idea placeholder nahi
              <p className="text-slate-400 italic text-sm">No hook selected yet.</p>
            )}
          </section>

          {/* ── FIX #1: Script Editable ── */}
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500"></span>
              Full Script
            </h3>
            <EditableField
              value={cleanScript || null}
              onSave={(v) => updatePostField("script", v)}
              label="Script"
              color="orange"
              disabled={isPublished}
            />
          </section>

          {/* ── FIX #1: Caption Editable ── */}
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></span>
              Caption & Hashtags
            </h3>
            <EditableField
              value={post?.caption || null}
              onSave={(v) => updatePostField("caption", v)}
              label="Caption"
              color="emerald"
              disabled={isPublished}
            />
          </section>

          {/* ── FIX #1: Shooting Guide Editable ── */}
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500"></span>
              Shooting Guide 🎥
            </h3>
            {plan === "free" ? (
              <div className="relative mt-2">
                <div className="blur-[3px] opacity-60 pointer-events-none select-none">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">1. Camera Angle & Lighting:</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 mb-2">- Front-facing camera with natural daylight...</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">2. B-Roll Suggestions:</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">- Show the workspace and hands typing...</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button onClick={() => navigate("/upgrade")} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-md transition-all active:scale-95">
                    Upgrade to Unlock 🎥
                  </button>
                </div>
              </div>
            ) : (
              <EditableField
                value={post?.shooting_guide || null}
                onSave={(v) => updatePostField("shooting_guide", v)}
                label="Shooting Guide"
                color="blue"
                disabled={isPublished}
              />
            )}
          </section>

          {/* ── FIX #1: Editing Guide Editable ── */}
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="text-[11px] sm:text-xs font-bold text-purple-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500"></span>
              Editing Guide ✂️
            </h3>
            {plan === "free" || plan === "starter" ? (
              <div className="relative mt-2">
                <div className="blur-[3px] opacity-60 pointer-events-none select-none">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">1. Pacing & Cuts:</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 mb-2">- Fast cuts on the beat to keep retention high...</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">2. Text Overlays:</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">- Pop-up captions using bold yellow colors...</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button onClick={() => navigate("/upgrade")} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-md transition-all active:scale-95">
                    Upgrade to Unlock ✂️
                  </button>
                </div>
              </div>
            ) : (
              <EditableField
                value={post?.editing_guide || null}
                onSave={(v) => updatePostField("editing_guide", v)}
                label="Editing Guide"
                color="purple"
                disabled={isPublished}
              />
            )}
          </section>
        </div>
      </div>

      {/* ── VIDEO LIBRARY PICKER MODAL ── */}
      {showVideoModal && (
        <div className="absolute inset-0 z-[100] bg-slate-50 dark:bg-zinc-950 overflow-y-auto animate-in fade-in duration-200 flex flex-col min-h-full">
          <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[60px] pb-4 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Select Reel Video</h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Choose a video from your library or upload a new one.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={videoUploading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {videoUploading ? <Spinner size={16} /> : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  )}
                  {videoUploading ? "Uploading..." : "Upload New Video"}
                </button>
                <button onClick={() => setShowVideoModal(false)} className="ml-2 p-2.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-xl text-slate-700 dark:text-zinc-300 transition-colors">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {mediaLoading ? (
              <div className="flex h-[40vh] items-center justify-center"><Spinner size={32} /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {mediaItems.filter((item) => item.type.includes("video")).length === 0 ? (
                  <div className="col-span-full border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
                    <p className="text-slate-500 dark:text-zinc-400 text-sm">No videos uploaded yet.</p>
                  </div>
                ) : (
                  mediaItems
                    .filter((item) => item.type.includes("video"))
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleVideoSelect(item)}
                        className="group relative rounded-2xl overflow-hidden aspect-[9/16] border-2 cursor-pointer border-slate-200 dark:border-zinc-700 hover:shadow-md hover:border-indigo-400 transition-all bg-black"
                      >
                        {/* FIX #2: Video thumbnail load nahi hoga — poster use karo; instant select */}
                        <video
                          src={item.file_url + "#t=0.5"}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                          <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                            Select Reel
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur-sm">
                          {(item.file_size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MEDIA LIBRARY PICKER MODAL ── */}
      {showMediaModal && (
        <div className="absolute inset-0 z-[100] bg-slate-50 dark:bg-zinc-950 overflow-y-auto animate-in fade-in duration-200 flex flex-col min-h-full">
          <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-h-[60px] pb-4 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Select Cover Image</h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Choose an image from your library or upload a new one.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => alert("Generate Image coming soon!")}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <span>✨</span> Generate
                </button>
                <input type="file" ref={coverInputRef} onChange={handleMediaFileChange} accept="image/*" className="hidden" />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {uploading ? <Spinner size={16} /> : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  )}
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button onClick={() => setShowMediaModal(false)} className="ml-2 p-2.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-xl text-slate-700 dark:text-zinc-300 transition-colors">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {mediaLoading ? (
              <div className="flex h-[40vh] items-center justify-center"><Spinner size={32} /></div>
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
                      className={`group relative rounded-2xl overflow-hidden aspect-square border-2 transition-all ${isVideo ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-zinc-800" : "cursor-pointer border-slate-200 dark:border-zinc-700 hover:shadow-md hover:border-indigo-400"}`}
                      title={isVideo ? "Cannot use video as cover image" : "Click to select as cover"}
                    >
                      {isVideo ? (
                        <video src={item.file_url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={item.file_url} alt="Media" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      )}
                      {isVideo && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-black/70 text-white text-[10px] px-2 py-1 rounded">Video</span>
                        </div>
                      )}
                      {!isVideo && (
                        <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">Select</div>
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
                style={{ position: "absolute", width: `${scaledW}px`, height: `${scaledH}px`, transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`, maxWidth: "none" }}
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
              <button onClick={() => { setCropFile(null); setCropImgUrl(null); }} className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors">Cancel</button>
              <button onClick={saveCropAndUpload} disabled={uploading} className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-slate-900 bg-white hover:bg-slate-200 transition-colors flex justify-center">
                {uploading ? <Spinner size={20} /> : "Crop & Use"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN EXPORT CONTAINER ── */}
      <div ref={exportRef} style={{ display: "none" }} className="absolute top-[-9999px] left-[-9999px] w-[800px] bg-white p-12 text-black font-sans">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-indigo-100">
          <div>
            <h1 className="text-3xl font-black text-indigo-600">Postra</h1>
            <p className="text-sm text-gray-500 mt-1">Content Export — {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          {post?.title && <p className="text-lg font-semibold text-gray-700 text-right max-w-xs">{post.title}</p>}
        </div>

        {/* Hook */}
        {post?.hook && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">The Hook</h2>
            <p className="text-xl font-bold text-gray-900 leading-snug">{post.hook}</p>
          </div>
        )}

        {/* Script */}
        {post?.script && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">Full Script</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{cleanScript}</p>
          </div>
        )}

        {/* Caption */}
        {post?.caption && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Caption & Hashtags</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.caption}</p>
          </div>
        )}

        {/* Shooting Guide */}
        {post?.shooting_guide && plan !== "free" && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">Shooting Guide 🎥</h2>
            <div
              className="text-sm text-gray-700 leading-relaxed"
              style={{ lineHeight: "1.7" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.shooting_guide) }}
            />
          </div>
        )}

        {/* Editing Guide */}
        {post?.editing_guide && plan === "pro" && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-3">Editing Guide ✂️</h2>
            <div
              className="text-sm text-gray-700 leading-relaxed"
              style={{ lineHeight: "1.7" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.editing_guide) }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Generated by Postra • postra.app</p>
        </div>
      </div>

      {/* ── PREMIUM UPGRADE TOAST ── */}
      {upgradeToast.show && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3 bg-slate-900 dark:bg-zinc-800 border border-slate-700 dark:border-zinc-700 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-full shadow-2xl">
            <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center shrink-0">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <span className="text-sm font-medium">{upgradeToast.message}</span>
            <div className="w-px h-5 bg-slate-700 mx-1 shrink-0" />
            <button onClick={() => navigate("/upgrade")} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all whitespace-nowrap">
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* ── PUBLISHING OVERLAY ── */}
      {isPublishing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl animate-in fade-in duration-300 px-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-[5px] border-slate-100 dark:border-zinc-800"></div>
              <div className="absolute inset-0 rounded-full border-[5px] border-transparent border-t-fuchsia-600 border-r-indigo-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="url(#ig-grad)" strokeWidth={2.5} className="animate-pulse">
                  <defs>
                    <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f09433" />
                      <stop offset="25%" stopColor="#e6683c" />
                      <stop offset="50%" stopColor="#dc2743" />
                      <stop offset="75%" stopColor="#cc2366" />
                      <stop offset="100%" stopColor="#bc1888" />
                    </linearGradient>
                  </defs>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Publishing to Instagram</h3>
            <div className="h-6 mb-6">
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 animate-pulse">{publishMessages[publishStep]}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 w-full">
              <p className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-500 flex items-center justify-center gap-1.5">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                Please don't close this screen!
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1.5 leading-tight">
                Meta takes up to 60 seconds to process and publish high-quality Reels.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}