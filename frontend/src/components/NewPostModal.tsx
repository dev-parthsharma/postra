// src/components/NewPostModal.tsx
// Modal triggered from Dashboard's "Generate Idea" button.
// Mirrors the loading-message cycling behaviour of the Ideas page.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { improveIdea, generateOneClickPost, generateSingleIdea, validateIdea, type Chat } from "../lib/ideasApi";

type Step = "choice" | "input" | "generating" | "success_placeholder";

export default function NewPostModal({
  onClose,
  onChatCreated,
}: {
  onClose: () => void;
  onChatCreated: (chat: Chat) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choice");
  const [plan, setPlan] = useState<string>("free");
  
  const [ideaText, setIdeaText] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 🟢 Idea generation loading state
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);

  // 🟢 Capture the generated post details for direct preview
  const [generatedChat, setGeneratedChat] = useState<Chat | null>(null);

  // ── New Validation & Warning States ──
  const [isValidating, setIsValidating] = useState(false);
  const [showNicheWarning, setShowNicheWarning] = useState(false);
  const [detectedNiche, setDetectedNiche] = useState("");
  const [userNiche, setUserNiche] = useState("");

  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);

  // Load user plan on mount
  useEffect(() => {
    const fetchPlan = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_profile").select("plan").eq("id", user.id).single();
      // 🟢 BYPASSED: Always set plan to "pro" for testing
      if (data?.plan) setPlan("pro");
    };
    fetchPlan();

    // Initialize Speech Recognition if browser supports it
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Good for English/Hinglish mixing

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          }
        }
        if (finalTranscript) {
          setIdeaText((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    // 🟢 BYPASSED: Voice typing restriction removed for testing
    // if (plan === "free" || plan === "starter") {
    //   setErrorMsg("Voice typing is a Pro feature! 🎙️ Please upgrade to unlock.");
    //   return;
    // }
    if (!recognitionRef.current) {
      setErrorMsg("Speech recognition is not supported in this browser. Try Chrome/Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleImprove = async () => {
    if (!ideaText.trim()) return;
    setIsImproving(true);
    try {
      const res = await improveIdea("temp", ideaText); 
      setIdeaText(res.improved_idea);
    } catch (e) {
      console.error(e);
    } finally {
      setIsImproving(false);
    }
  };

  // 🟢 Handles validation first before generating
  const handleOneClickInitiate = async () => {
    // 🟢 BYPASSED: Generate Post restriction removed for testing
    // if (plan === "free") {
    //   setErrorMsg("Generate Post ⚡ is a premium feature. Please upgrade your plan.");
    //   return;
    // }
    if (!ideaText.trim()) return;

    setIsValidating(true);
    setErrorMsg(null);

    try {
      const check = await validateIdea(ideaText);
      setIsValidating(false);

      if (!check.valid) {
        // 🟢 Invalid idea: Trigger error message with 5 second timeout
        setErrorMsg(check.message || "This doesn't look like a real idea.");
        setTimeout(() => {
          setErrorMsg(null);
        }, 5000); // 5 seconds timer
        return;
      }

      if (!check.niche_match) {
        // 🟢 Niche Mismatch: Open confirmation warning popup overlay
        setDetectedNiche(check.detected_niche);
        setUserNiche(check.user_niche);
        setShowNicheWarning(true);
      } else {
        // 🟢 Valid and matches Niche: Directly generate
        executeOneClick(false);
      }
    } catch (e: any) {
      setIsValidating(false);
      setErrorMsg(e.message || "Validation failed.");
    }
  };

  const executeOneClick = async (withGuides: boolean) => {
    setStep("generating");
    try {
      const chat = await generateOneClickPost(ideaText, withGuides);
      setGeneratedChat(chat); // Save generated post so we can link to it
      setStep("success_placeholder");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to auto-generate post.");
      setStep("input");
    }
  };

  const handleGetNicheIdea = async () => {
    setIsGeneratingIdea(true);
    setErrorMsg(null);
    try {
      const res = await generateSingleIdea();
      if (res?.idea) {
        setIdeaText(res.idea); // Textarea mein idea fill kar diya
      } else {
        setErrorMsg("Could not find a trending idea right now. Please try again.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate idea.");
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const isIdeaEmpty = !ideaText.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col relative">
        
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {step === "choice" ? "What's on your mind?" : "Create Post"} 
            {step !== "generating" && <span className="text-xl">✨</span>}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 transition-colors">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Dynamic Content */}
        <div className="p-6 relative flex-1 min-h-[300px]">
          
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium flex justify-between items-center border border-red-100 dark:border-red-500/20">
              <span className="flex-1 pr-2">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-xs font-bold">✖</button>
            </div>
          )}

          {/* STEP 1: CHOICE */}
          {step === "choice" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
              <div 
                onClick={() => { onClose(); navigate("/drafts"); }}
                className="group cursor-pointer p-6 rounded-2xl border-2 border-slate-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-zinc-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex flex-col items-center justify-center text-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">📂</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">View Drafts</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Continue working on saved ideas.</p>
                </div>
              </div>

              <div 
                onClick={() => setStep("input")}
                className="group cursor-pointer p-6 rounded-2xl border-2 border-slate-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex flex-col items-center justify-center text-center gap-3 shadow-sm hover:shadow-md"
              >
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🚀</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Create New</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Start a fresh post from scratch.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INPUT IDEA */}
          {step === "input" && (
            <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="relative">
                <textarea 
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  placeholder="Write or speak your idea here... (e.g. 3 morning habits for productivity)"
                  className="w-full h-40 resize-none rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 p-4 text-[15px] outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                />
              </div>

              {/* Action Area */}
              <div className="flex flex-col gap-3 pt-2">
                
                {/* Dynamic Action Button (Get Niche Idea vs Improve Idea) */}
                {isIdeaEmpty ? (
                  <button 
                    type="button"
                    onClick={handleGetNicheIdea}
                    disabled={isGeneratingIdea}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isGeneratingIdea ? (
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Generating Trending Idea...</span>
                      </div>
                    ) : (
                      "💡 Get Niche Idea"
                    )}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={handleImprove}
                    disabled={isImproving}
                    className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isImproving ? "Improving..." : "🪄 Improve this idea"}
                  </button>
                )}

                {/* One-Click Full Width Button (Generate Post) */}
                <div className="mt-2">
                  <button 
                    type="button"
                    onClick={handleOneClickInitiate}
                    disabled={isIdeaEmpty || isValidating}
                    className="w-full flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white border-2 border-indigo-600 transition-all disabled:opacity-50 shadow-md relative overflow-hidden"
                  >
                    {isValidating ? (
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Verifying Concept...</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xl mb-1">⚡</span>
                        <span className="font-bold text-sm">Generate Post ⚡</span>
                        <span className="text-[10px] text-indigo-100 text-center leading-tight mt-0.5">Auto-generate script, hooks, and caption</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* STEP 3: GENERATING (LOADING) */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center text-center h-full space-y-6 animate-in fade-in duration-300">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-slate-100 dark:border-zinc-800 rounded-full" />
                <div className="w-20 h-20 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute inset-0" />
                <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Crafting your post...</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Applying the best hooks, script strategies, and captions.</p>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS PLACEHOLDER */}
          {step === "success_placeholder" && (
            <div className="flex flex-col items-center justify-center text-center h-full space-y-6 animate-in zoom-in-95 duration-200 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl animate-bounce">
                ✅
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Post Created Successfully!</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-[300px] mx-auto">
                  Your script, hooks, and caption have been fully auto-generated in 1-Click.
                </p>
              </div>
              
              {/* Double Redirect Buttons: Primary Preview vs Secondary drafts */}
              <div className="w-full space-y-3 pt-3">
                <button 
                  onClick={() => {
                    onClose();
                    if (generatedChat?.id) {
                      navigate(`/chat/${generatedChat.id}`); 
                    } else {
                      navigate("/drafts");
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                >
                  Go to Post Preview →
                </button>
                <button 
                  onClick={() => {
                    onClose();
                    navigate("/drafts"); 
                  }}
                  className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold transition-all active:scale-95"
                >
                  View All Drafts
                </button>
              </div>
            </div>
          )}

          {/* ── 🟢 NICHE WARNING CONFIRMATION OVERLAY POPUP ── */}
          {showNicheWarning && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto text-xl">
                  ⚠️
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Niche Mismatch</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    This idea seems to belong to <span className="font-bold text-slate-800 dark:text-zinc-200">"{detectedNiche}"</span>, but your profile niche is currently set to <span className="font-bold text-slate-800 dark:text-zinc-200">"{userNiche}"</span>.
                  </p>
                  <p className="text-[11px] text-indigo-500 dark:text-indigo-400 italic bg-indigo-50/50 dark:bg-indigo-500/5 p-2 rounded-xl border border-indigo-100/30">
                    Tip: If you want to change your niche permanently, you can update it in Settings.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNicheWarning(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNicheWarning(false);
                      executeOneClick(false); 
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                  >
                    Generate Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}