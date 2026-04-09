import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import { useAuth } from "../hooks/useAuth";

function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleSubmit = async (email: string, password: string) => {
    const response = await signup(email, password);
    if (response.error) {
      throw new Error(response.error.message);
    }
    navigate("/");
  };

  return (
    <main className="mx-auto flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <AuthForm title="Create your Postra account" submitLabel="Sign Up" onSubmit={handleSubmit} />
      </div>
    </main>
  );
}

export default Signup;
