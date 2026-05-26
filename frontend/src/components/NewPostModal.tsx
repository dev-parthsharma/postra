// src/components/NewPostModal.tsx
// Modal triggered from Dashboard's "Generate Idea" button.
// Mirrors the loading-message cycling behaviour of the Ideas page.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { improveIdea, generateOneClickPost, confirmIdea, saveUserIdea, type Chat } from "../lib/ideasApi";

type Step = "choice" | "input" | "guide_prompt" | "generating";

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

  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);

  // Load user plan on mount
  useEffect(() => {
    const fetchPlan = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_profile").select("plan").eq("id", user.id).single();
      if (data?.plan) setPlan(data.plan.toLowerCase());
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
    if (plan === "free" || plan === "starter") {
      setErrorMsg("Voice typing is a Pro feature! 🎙️ Please upgrade to unlock.");
      return;
    }
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
      // Mocking idea_id since it's not saved yet, improveIdea api uses pure AI
      const res = await improveIdea("temp", ideaText); 
      setIdeaText(res.improved_idea);
    } catch (e) {
      console.error(e);
    } finally {
      setIsImproving(false);
    }
  };

  const handleChatMode = async () => {
    if (!ideaText.trim()) return;
    setStep("generating");
    try {
      const saved = await saveUserIdea(ideaText);
      const chat = await confirmIdea(saved.id, saved.idea);
      onChatCreated(chat);
    } catch (e: any) {
      setErrorMsg(e.message || "Something went wrong.");
      setStep("input");
    }
  };

  const handleOneClickInitiate = () => {
    if (plan === "free") {
      setErrorMsg("Magic Create ⚡ is a premium feature. Please upgrade your plan.");
      return;
    }
    if (!ideaText.trim()) return;

    if (plan === "pro") {
      setStep("guide_prompt"); // Ask Pro users if they want guides
    } else {
      // Starter plan: Directly auto-generate without guides
      executeOneClick(false); 
    }
  };

  const executeOneClick = async (withGuides: boolean) => {
    setStep("generating");
    try {
      const chat = await generateOneClickPost(ideaText, withGuides);
      onChatCreated(chat);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to auto-generate post.");
      setStep("input");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
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
              {errorMsg}
              <button onClick={() => setErrorMsg(null)}>✖</button>
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
                {/* Mic Button */}
                <button 
                  onClick={toggleMic}
                  className={`absolute bottom-4 right-4 p-3 rounded-full shadow-md transition-all active:scale-95 ${
                    isListening 
                      ? "bg-red-500 text-white animate-pulse" 
                      : plan === "pro" 
                        ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                        : "bg-slate-200 dark:bg-zinc-700 text-slate-400 cursor-not-allowed"
                  }`}
                  title={plan !== "pro" ? "Pro feature" : "Click to speak"}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>

              {/* Action Area */}
              <div className="flex flex-col gap-3 pt-2">
                
                {/* Improve Button */}
                <button 
                  onClick={handleImprove}
                  disabled={!ideaText.trim() || isImproving}
                  className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isImproving ? "Improving..." : "🪄 Improve this idea"}
                </button>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button 
                    onClick={handleChatMode}
                    disabled={!ideaText.trim()}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 hover:border-indigo-400 hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    <span className="text-xl mb-1">💬</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-zinc-100">Step-by-Step</span>
                    <span className="text-[10px] text-slate-500 text-center leading-tight mt-0.5">Chat & build manually</span>
                  </button>

                  <button 
                    onClick={handleOneClickInitiate}
                    disabled={!ideaText.trim() || plan === "free"}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white border-2 border-indigo-600 transition-all disabled:opacity-50 shadow-md relative overflow-hidden"
                  >
                    <span className="text-xl mb-1">⚡</span>
                    <span className="font-bold text-sm">Magic Create</span>
                    <span className="text-[10px] text-indigo-100 text-center leading-tight mt-0.5">Auto-generate everything</span>
                    
                    {plan === "free" && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-black px-2 py-1 rounded-md">Upgrade</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRO GUIDE PROMPT */}
          {step === "guide_prompt" && (
            <div className="flex flex-col items-center justify-center text-center h-full space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pro Advantage 🌟</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 max-w-[280px] mx-auto">
                  Do you also want me to generate precise <span className="font-semibold text-slate-700 dark:text-zinc-300">Shooting</span> and <span className="font-semibold text-slate-700 dark:text-zinc-300">Editing</span> guides for this video?
                </p>
              </div>
              <div className="flex gap-3 w-full max-w-sm pt-4">
                <button 
                  onClick={() => executeOneClick(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  No, just content
                </button>
                <button 
                  onClick={() => executeOneClick(true)}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-all active:scale-95"
                >
                  Yes, include guides!
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: GENERATING (LOADING) */}
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

        </div>
      </div>
    </div>
  );
}