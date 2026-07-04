from app.integrations.supabase_client import get_supabase_client, get_http_client

class AuthService:
    @staticmethod
    def verify_token(access_token: str) -> bool:
        response = get_http_client().get(
            "/auth/v1/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        return response.status_code == 200

    @staticmethod
    def create_user(email: str, password: str) -> dict:
        response = get_http_client().post(
            "/auth/v1/admin/users",
            json={"email": email, "password": password, "email_confirm": True},
        )
        if response.status_code >= 400:
            raise ValueError(response.text)
        return response.json()
    
    @staticmethod
    def check_password_status(email: str) -> dict:
        client = get_supabase_client()
        
        # 1. Fetch user through Admin API to verify existence
        response = get_http_client().get(
            "/auth/v1/admin/users",
            params={"filter": email}
        )
        if response.status_code >= 400:
            raise ValueError(f"Supabase Admin API error: {response.text}")
            
        data = response.json()
        if not data:
            return {"exists": False, "has_password": False}
            
        users = data.get("users") or []
        
        # Match exact email
        exact_user = None
        for u in users:
            if u and u.get("email", "").strip().lower() == email.strip().lower():
                exact_user = u
                break
                
        if not exact_user:
            return {"exists": False, "has_password": False}
            
        # 2. Invoke our custom Postgres RPC to read the password state directly
        try:
            res = client.rpc("check_user_password_set", {"user_email": email.strip()}).execute()
            has_password = res.data if (res and res.data is not None) else False
        except Exception as e:
            # Fallback to provider check in case the RPC is missing
            print("RPC password check failed, falling back to providers:", str(e))
            identities = exact_user.get("identities") or []
            app_metadata = exact_user.get("app_metadata") or {}
            providers = app_metadata.get("providers") or []
            
            has_password = "email" in providers or any(
                id_obj.get("provider") == "email" 
                for id_obj in identities 
                if id_obj and isinstance(id_obj, dict)
            )
            
        return {
            "exists": True,
            "has_password": has_password
        }