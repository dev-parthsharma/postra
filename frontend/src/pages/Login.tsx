import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import { useAuth } from "../hooks/useAuth";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (email: string, password: string) => {
    const response = await login(email, password);
    if (response.error) {
      throw new Error(response.error.message);
    }
    navigate("/");
  };

  return (
    <main className="mx-auto flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <AuthForm title="Login to Postra" submitLabel="Login" onSubmit={handleSubmit} />
      </div>
    </main>
  );
}

export default Login;
