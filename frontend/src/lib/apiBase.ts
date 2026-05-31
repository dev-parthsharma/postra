// frontend\src\lib\apiBase.ts

export const API_BASE = import.meta.env.VITE_API_URL as string;

if (!API_BASE) {
  throw new Error("VITE_API_URL is not defined");
}