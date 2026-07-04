// frontend/src/lib/referralApi.ts

import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getReferralDashboard() {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const resp = await fetch(`${API_URL}/api/referrals/dashboard`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!resp.ok) {
    throw new Error("Failed to fetch referral dashboard data");
  }
  return resp.json();
}

export async function applyReferralCode(referralCode: string, deviceId: string) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const resp = await fetch(`${API_URL}/api/referrals/apply`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ referral_code: referralCode, device_id: deviceId })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.detail || "Failed to apply referral code");
  }
  return data;
}