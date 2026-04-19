// src/utils/ideaValidator.ts
// Client-side gibberish detector. Runs before any API call.
// Returns "gibberish" | "valid"

const REAL_WORDS = new Set([
  // English
  "a","an","the","and","or","but","for","in","is","it","my","you","i","we","he","she","they",
  "this","that","how","what","why","when","with","from","have","has","do","does","will","can",
  "not","are","was","were","be","been","being","had","if","then","than","so","as","at","by",
  "on","to","up","out","off","get","go","make","use","want","need","like","know","see","think",
  "come","give","take","say","tell","ask","feel","try","keep","let","put","set","run","turn",
  "show","move","live","play","work","love","start","stop","call","open","help","look","find",
  "reel","post","video","story","content","idea","about","create","share","brand","niche",
  "audience","followers","growth","viral","hook","caption","edit","trend","morning","night",
  "fitness","food","travel","fashion","tech","business","money","health","skin","workout",
  "recipe","vlog","life","day","week","tips","guide","hack","routine","challenge","review",
  "behind","scenes","tutorial","your","their","our","its","his","her","more","some","all",
  "just","also","here","there","now","then","again","new","old","good","bad","best","top",
  "real","free","easy","quick","simple","amazing","great","every","each","both","through",
  // Hinglish
  "hai","hain","kya","toh","bhi","koi","aur","jo","se","ko","ka","ki","ke","mein","par","pe",
  "ne","ho","hoga","karo","bhai","yaar","tera","mera","meri","teri","accha","nahi","sab",
  "kuch","ek","wala","wali","wale","raha","rahi","gaya","gayi","lega","legi","dena","lena",
  "abhi","phir","bas","sahi","bahut","thoda","zyada","tum","aap","woh","apna","apni","dekh",
  "kar","kab","kaise","kyun","pehle","baad","sath","lekin","agar","matlab","samajh","baat",
  "kaam","din","raat","kal","aaj","solid","badiya","mast","dope","fire","crazy","vibe",
  "chill","dil","mann","soch","iska","uska","wahan","yahan","log","time","baar","suna",
  "dekha","kiya","tha","thi","the","hoga","hogi","honge","bolna","sunna","dekhna","karna",
]);

function looksLikeRealWord(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return true;   // numbers/punctuation — skip
  if (w.length <= 2) return true;    // very short — give benefit of doubt
  if (REAL_WORDS.has(w)) return true;

  // Vowel ratio check: real words almost always have ≥15% vowels
  const vowels = w.split("").filter(c => "aeiou".includes(c)).length;
  if (vowels / w.length < 0.15) return false;

  // Consonant cluster check: >5 consecutive consonants is suspicious
  const stripped = w.replace(/[aeiou]/g, "");
  if (stripped.length > w.length * 0.85) return false;

  return true;
}

export type IdeaQuality = "gibberish" | "valid";

export function classifyIdea(text: string): IdeaQuality {
  const trimmed = text.trim();
  if (!trimmed) return "gibberish";

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "gibberish";

  // Filter to only alphabetic tokens worth checking
  const wordTokens = tokens.filter(t => /[a-zA-Z]/.test(t));
  if (wordTokens.length === 0) return "gibberish"; // all numbers/symbols

  const realCount = wordTokens.filter(t => looksLikeRealWord(t)).length;
  const realRatio = realCount / wordTokens.length;

  // Fewer than 45% real-looking words → gibberish
  if (realRatio < 0.45) return "gibberish";

  return "valid";
}