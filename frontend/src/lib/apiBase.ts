// frontend/src/lib/apiBase.ts

export const API_BASE = import.meta.env.VITE_API_URL as string;

if (!API_BASE) {
  throw new Error("VITE_API_URL is not defined");
}

// ── Content Goal ──────────────────────────────────────────────────────────────

export async function updateContentGoal(
  contentGoal: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/profile/content-goal`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content_goal: contentGoal }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to update content goal");
  }
}