import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { recordLoginActivity } from "../../lib/api/authService";
import { setLoginTime, setLastActivity } from "../../lib/utils/session";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const ssoToken = searchParams.get("token");
    if (!ssoToken) {
      const existingToken = window.localStorage.getItem("accessToken");
      if (existingToken) {
        onLogin();
        navigate("/dashboard", { replace: true });
        return;
      }
      // If no token is provided, redirect directly to the unified portal
      const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://localhost:8000";
      window.location.href = `${portalUrl}/login`;
      return;
    }

    try {
      window.localStorage.setItem("accessToken", ssoToken);
      
      // Session timestamps: login time and last activity
      setLoginTime(new Date());
      setLastActivity(new Date());
      
      // Async notify activity (non-blocking)
      recordLoginActivity().catch((err: any) => console.error("Failed to record activity", err));

      onLogin();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("[SSO Login Error]", err);
      setError("Invalid or expired authentication token.");
      window.localStorage.removeItem("accessToken");
    }
  }, [searchParams, onLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
        {error ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-red-500">
              <AlertCircle size={48} />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Authentication Failed</h2>
            <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
            <button
              onClick={() => {
                const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://localhost:8000";
                window.location.href = `${portalUrl}/login`;
              }}
              className="mt-4 w-full bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Back to Portal Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="animate-spin text-[var(--color-brand-primary)] mx-auto" size={40} />
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Verifying SSO Session</h2>
            <p className="text-[var(--color-text-secondary)] text-sm">Please wait while we redirect you to your dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
