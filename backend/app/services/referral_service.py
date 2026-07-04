# backend/app/services/referral_service.py

import re
import random
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from app.integrations.supabase_client import get_supabase_client
from app.integrations.supabase_client import get_http_client

class ReferralService:

    @staticmethod
    def generate_unique_referral_code(username: str) -> str:
        """
        Generates a readable, unique referral code from the user's name.
        Example: Parth Sharma -> PARTHS824
        """
        supabase = get_supabase_client()
        clean_name = re.sub(r'[^a-zA-Z]', '', username).upper()[:6]
        if len(clean_name) < 3:
            clean_name = clean_name.ljust(3, 'X')
        
        attempts = 0
        while attempts < 10:
            suffix = str(random.randint(100, 999))
            potential_code = f"{clean_name}{suffix}"
            
            # Check uniqueness in DB
            resp = supabase.table("user_profile").select("id").eq("referral_code", potential_code).execute()
            resp_data = resp.data
            if not isinstance(resp_data, list) or len(resp_data) == 0:
                return potential_code
            attempts += 1
            
        return f"REF{random.randint(100000, 999999)}"

    @staticmethod
    async def apply_referral_code(
        referred_user_id: str, 
        code: str, 
        device_id: str, 
        ip_address: str
    ) -> dict:
        """
        Evaluates, validates, and records a referral application.
        Now uses device-only and payment-only validation to allow network-shared testing.
        """
        supabase = get_supabase_client()
        code_clean = code.strip().upper()

        # 1. Self-referral validation
        self_profile = supabase.table("user_profile").select("id", "referral_code").eq("id", referred_user_id).execute()
        self_data = self_profile.data
        if isinstance(self_data, list) and len(self_data) > 0:
            first_row = self_data[0]
            if isinstance(first_row, dict) and first_row.get("referral_code") == code_clean:
                return {"success": False, "message": "Self-referrals are blocked."}

        # 2. Verify targeted referral code exists
        referrer_profile = supabase.table("user_profile").select("id").eq("referral_code", code_clean).execute()
        ref_data = referrer_profile.data
        if not isinstance(ref_data, list) or len(ref_data) == 0 or not isinstance(ref_data[0], dict):
            return {"success": False, "message": "Invalid referral code."}
        referrer_id = ref_data[0].get("id")

        # 3. Prevent multiple referral usages
        existing_ref = supabase.table("referrals").select("id").eq("referred_id", referred_user_id).execute()
        existing_data = existing_ref.data
        if isinstance(existing_data, list) and len(existing_data) > 0:
            return {"success": False, "message": "You have already applied a referral code."}

        # 4. Abuse Prevention Check (Device ID Only for signup, IP check removed to allow local testing)
        suspicious_match = supabase.table("referrals").select("id")\
            .eq("referrer_id", referrer_id)\
            .eq("device_id", device_id)\
            .execute()
            
        susp_data = suspicious_match.data
        is_abuse = bool(isinstance(susp_data, list) and len(susp_data) > 0)
        status = "flagged_abuse" if is_abuse else "applied"

        # Record the referral connection
        ref_payload = {
            "referrer_id": referrer_id,
            "referred_id": referred_user_id,
            "code_used": code_clean,
            "status": status,
            "ip_address": ip_address,
            "device_id": device_id
        }
        ref_insert = supabase.table("referrals").insert(ref_payload).execute()
        if not ref_insert.data:
            return {"success": False, "message": "Failed to log referral."}
        
        if is_abuse:
            return {
                "success": False, 
                "message": "Referral flagged. Rewards are pending manual fraud verification."
            }

        insert_data = ref_insert.data
        if not isinstance(insert_data, list) or len(insert_data) == 0 or not isinstance(insert_data[0], dict):
            return {"success": False, "message": "Failed to extract logged referral details."}

        referral_record_id = insert_data[0].get("id")

        # 5. Distribute Step 1 Rewards
        # Referred user gets an extra 3 Days Pro Trial (Queued as pending to start when base 7-day trial ends, totaling 10 days)
        supabase.table("referral_rewards_queue").insert({
            "user_id": referred_user_id,
            "referral_id": referral_record_id,
            "reward_type": "trial_3d",
            "status": "pending",
            "duration_days": 3
        }).execute()
        
        # Record referrer association inside user_profile
        supabase.table("user_profile").update({
            "referred_by_id": referrer_id,
            "referral_step_completed": True
        }).eq("id", referred_user_id).execute()

        # Referred user gets one-time 20% discount coupon (Pending use)
        supabase.table("referral_rewards_queue").insert({
            "user_id": referred_user_id,
            "referral_id": referral_record_id,
            "reward_type": "discount_20",
            "status": "pending",
            "discount_percent": 20
        }).execute()

        # Referrer gets one-time 20% discount coupon (Pending use on next monthly renew)
        supabase.table("referral_rewards_queue").insert({
            "user_id": referrer_id,
            "referral_id": referral_record_id,
            "reward_type": "discount_20",
            "status": "pending",
            "discount_percent": 20
        }).execute()

        return {"success": True, "message": "Referral code successfully applied! Your Pro trial has been extended to 10 days."}

    @staticmethod
    def process_pending_rewards(user_id: str) -> None:
        """
        Scans and automatically activates queued plan extensions 
        if the user's current subscription has expired.
        """
        supabase = get_supabase_client()
        now_str = datetime.now(timezone.utc).isoformat()
        
        # Check if the user currently has an active plan running
        active_rewards = supabase.table("referral_rewards_queue")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("status", "active")\
            .gt("end_at", now_str)\
            .execute()
            
        act_data = active_rewards.data
        if isinstance(act_data, list) and len(act_data) > 0:
            return  # Active plan still running, leave queued items pending

        # Retrieve oldest queued reward
        pending_rewards = supabase.table("referral_rewards_queue")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("status", "pending")\
            .in_("reward_type", ["trial_7d", "plan_extension"])\
            .order("created_at", desc=False)\
            .limit(1)\
            .execute()
            
        pend_data = pending_rewards.data
        if not isinstance(pend_data, list) or len(pend_data) == 0 or not isinstance(pend_data[0], dict):
            return

        reward = pend_data[0]
        reward_id = reward.get("id")
        
        # Safely verify and cast the duration to integer for timedelta
        raw_duration = reward.get("duration_days")
        duration = int(raw_duration) if isinstance(raw_duration, (int, float)) else 0
        
        target_plan = str(reward.get("target_plan") or "pro")

        start_time = datetime.now(timezone.utc)
        end_time = start_time + timedelta(days=duration)

        # Activate the queued extension
        supabase.table("referral_rewards_queue").update({
            "status": "active",
            "start_at": start_time.isoformat(),
            "end_at": end_time.isoformat(),
            "activated_at": start_time.isoformat()
        }).eq("id", reward_id).execute()

        # Update profile tier to target plan
        supabase.table("user_profile").update({
            "plan": target_plan
        }).eq("id", user_id).execute()

    @staticmethod
    def get_referral_dashboard(user_id: str) -> dict:
        """
        Consolidates the active referral metrics, historical queue, and rewards.
        Generates and saves a code on the fly if the user doesn't have one (for old IDs).
        """
        supabase = get_supabase_client()
        
        # Ensure pending reward statuses are current
        ReferralService.process_pending_rewards(user_id)

        # Fetch referral code
        profile_res = supabase.table("user_profile").select("referral_code").eq("id", user_id).execute()
        profile_data = profile_res.data
        code = None
        if isinstance(profile_data, list) and len(profile_data) > 0 and isinstance(profile_data[0], dict):
            code = profile_data[0].get("referral_code")

        # Dynamic fallback: if an old account does not have a referral code, generate and save one now
        if not code:
            user_name_res = supabase.table("user_profile").select("name").eq("id", user_id).execute()
            name_data = user_name_res.data
            u_name = "CREATOR"
            if isinstance(name_data, list) and len(name_data) > 0 and isinstance(name_data[0], dict):
                raw_name = name_data[0].get("name")
                u_name = str(raw_name) if raw_name is not None else "CREATOR" # Cast to string explicitly
            
            code = ReferralService.generate_unique_referral_code(u_name)
            # Save it permanently to the database
            supabase.table("user_profile").update({"referral_code": code}).eq("id", user_id).execute()

        # Fetch referrals made by this user (including friend names)
        referrals_res = supabase.table("referrals")\
            .select("id, status, created_at, user_profile!referred_id(name)")\
            .eq("referrer_id", user_id)\
            .execute()

        referrals_list = []
        ref_data = referrals_res.data
        if isinstance(ref_data, list):
            for ref in ref_data:
                if isinstance(ref, dict):
                    friend_name = "Creator"
                    user_prof = ref.get("user_profile")
                    if isinstance(user_prof, dict):
                        friend_name = user_prof.get("name", "Creator")
                    referrals_list.append({
                        "id": ref.get("id"),
                        "status": ref.get("status"),
                        "created_at": ref.get("created_at"),
                        "name": friend_name
                    })

        # Fetch rewards queue status
        queue_res = supabase.table("referral_rewards_queue")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()

        rewards_queue = queue_res.data or []

        # Summarize High-Level Metrics
        total_referrals = len(referrals_list)
        successful_referrals = sum(1 for r in referrals_list if r["status"] == "completed")

        active_extensions = 0
        for r in rewards_queue:
            if isinstance(r, dict) and r.get("status") == "active":
                val = r.get("duration_days")
                if isinstance(val, (int, float)):
                    active_extensions += int(val)

        return {
            "referral_code": code,
            "referral_link": f"https://postra.co.in/signup?ref={code}" if code else "",
            "metrics": {
                "total_referrals": total_referrals,
                "successful_referrals": successful_referrals,
                "active_extensions": active_extensions
            },
            "referrals": referrals_list,
            "rewards_queue": rewards_queue
        }

    @staticmethod
    async def process_razorpay_payment(payload: dict) -> dict:
        """
        Razorpay webhook event processing. Apply referral incentives when
        referred users perform their first subscription purchase.
        """
        supabase = get_supabase_client()
        
        # Verify event properties
        event = payload.get("event")
        if event not in ["order.paid", "payment.captured"]:
            return {"status": "ignored"}

        payload_data = payload.get("payload")
        payment_entity = {}
        if isinstance(payload_data, dict):
            payment_entity = payload_data.get("payment", {}).get("entity", {}) or {}

        notes = payment_entity.get("notes") or {}
        user_id = None
        if isinstance(notes, dict):
            user_id = notes.get("user_id") # Razorpay checkout must pass user_id inside notes
        
        if not user_id:
            return {"status": "ignored", "reason": "No user_id metadata note found"}

        # Track payment hardware details (card/VPA fingerprinting)
        vpa = payment_entity.get("vpa") # UPI Identifier (e.g. name@okaxis)
        card = payment_entity.get("card") or {}
        card_id = card.get("id") if isinstance(card, dict) else None
        payment_fingerprint = vpa or card_id or "unknown_fingerprint"

        # Apply outstanding discount if queued
        discount_reward = supabase.table("referral_rewards_queue")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("reward_type", "discount_20")\
            .eq("status", "pending")\
            .execute()

        disc_data = discount_reward.data
        if isinstance(disc_data, list) and len(disc_data) > 0 and isinstance(disc_data[0], dict):
            supabase.table("referral_rewards_queue").update({"status": "redeemed"})\
                .eq("id", disc_data[0].get("id")).execute()

        # Evaluate if user is referred and triggering first milestone subscription
        referral_record = supabase.table("referrals").select("*").eq("referred_id", user_id).eq("status", "applied").execute()
        ref_records = referral_record.data
        if not isinstance(ref_records, list) or len(ref_records) == 0 or not isinstance(ref_records[0], dict):
            return {"status": "processed", "message": "No outstanding referral steps to complete"}

        ref_data = ref_records[0]
        referrer_id = ref_data.get("referrer_id")
        referral_id = ref_data.get("id")

        # Fraud Check: Prevent payment card or UPI sharing between referred account & referrer
        shared_payment = supabase.table("referrals").select("id")\
            .eq("referrer_id", referrer_id)\
            .eq("payment_fingerprint", payment_fingerprint)\
            .execute()

        shared_data = shared_payment.data
        if isinstance(shared_data, list) and len(shared_data) > 0:
            supabase.table("referrals").update({"status": "flagged_abuse"}).eq("id", referral_id).execute()
            return {"status": "fraud_blocked", "reason": "Shared billing profile matching referrer fingerprint."}

        # Update referral transition properties
        supabase.table("referrals").update({
            "status": "completed",
            "payment_fingerprint": payment_fingerprint
        }).eq("id", referral_id).execute()

        # Determine plan tier purchase values
        purchased_amount = payment_entity.get("amount", 0) / 100
        # Assume Starter if under threshold, Pro if above. Update matching your pricing structures.
        purchased_plan = "pro" if purchased_amount > 400 else "starter" 
        
        # Calculate extension incentive (Starter gets Starter, Pro gets Pro)
        # Assuming monthly base plan purchase = 30 days -> extension = 15 days
        is_annual = purchased_amount > 2000
        extension_days = 182 if is_annual else 15

        # Queue plan extension inside referrer's profile
        supabase.table("referral_rewards_queue").insert({
            "user_id": referrer_id,
            "referral_id": referral_id,
            "reward_type": "plan_extension",
            "status": "pending",
            "duration_days": extension_days,
            "target_plan": purchased_plan
        }).execute()

        return {"status": "processed", "incentive": "Referrer subscription extension queued."}