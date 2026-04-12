from app.integrations.supabase_client import get_http_client

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