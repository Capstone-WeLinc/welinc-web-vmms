import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  login,
  recordLoginActivity,
  testLoginAccounts,
} from "../../lib/api/authService";
import { clearSession, setLoginTime, setLastActivity } from "../../lib/utils/session";

interface LoginPageProps {
  onLogin: () => void;
}

const getPortalLoginUrl = () => {
  const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://localhost:8000";
  const vmmsLoginUrl = `${window.location.origin}/login`;
  const params = new URLSearchParams({
    system: "VMMS",
    redirect: vmmsLoginUrl,
    returnUrl: vmmsLoginUrl,
  });

  return `${portalUrl}/login?${params.toString()}`;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ssoToken = searchParams.get("token");
  const hasSsoToken = Boolean(ssoToken);

  const displayedAccounts = useMemo(
    () =>
      testLoginAccounts.map((account) => ({
        ...account,
        dashboard:
          account.label === "Chief Mechanic" || account.label === "Operations",
      })),
    [],
  );

  useEffect(() => {
    if (!ssoToken) {
      return;
    }

    try {
      window.localStorage.removeItem("accessToken");
      clearSession();
      window.localStorage.setItem("accessToken", ssoToken);
      
      // Session timestamps: login time and last activity
      setLoginTime(new Date());
      setLastActivity(new Date());
      
      // Async notify activity (non-blocking)
      recordLoginActivity().catch((err: unknown) =>
        console.error("Failed to record activity", err),
      );

      onLogin();
    } catch (err) {
      console.error("[SSO Login Error]", err);
      requestAnimationFrame(() => {
        setError("Invalid or expired authentication token.");
      });
      window.localStorage.removeItem("accessToken");
    }
  }, [ssoToken, onLogin]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      clearSession();
      window.localStorage.removeItem("accessToken");
      const result = await login(email.trim(), password);
      window.localStorage.setItem("accessToken", result.accessToken);
      setLoginTime(new Date());
      setLastActivity(new Date());
      recordLoginActivity().catch((err: unknown) =>
        console.error("Failed to record activity", err),
      );
      onLogin();
    } catch (loginError) {
      console.error("[Login Error]", loginError);
      setError("Invalid credentials. Please use one of the hardcoded test accounts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
        {hasSsoToken ? (
          <div className="text-center space-y-4">
            {error ? (
              <>
                <div className="flex items-center justify-center text-red-500">
                  <AlertCircle size={48} />
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Authentication Failed</h2>
                <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
                <button
                  onClick={() => {
                    window.location.href = getPortalLoginUrl();
                  }}
                  className="mt-4 h-10 w-full bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-white font-bold rounded-xl transition-all cursor-pointer"
                  type="button"
                >
                  Back to Portal Login
                </button>
              </>
            ) : (
              <>
                <Loader2 className="animate-spin text-[var(--color-brand-primary)] mx-auto" size={40} />
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Verifying SSO Session</h2>
                <p className="text-[var(--color-text-secondary)] text-sm">Please wait while we sign you in.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">VMMS Test Login</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Use any hardcoded account below to test the frontend.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1.5" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-text-primary)]"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter account email"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1.5" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-text-primary)]"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter account password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="h-10 w-full bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-white font-bold rounded-xl transition-all cursor-pointer disabled:opacity-70"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Quick Test Accounts</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {displayedAccounts.map((account) => (
                  <button
                    key={account.userId}
                    type="button"
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3 text-left hover:border-[var(--color-brand-primary)] transition-colors"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                    }}
                  >
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{account.label}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{account.email}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Password: {account.password}
                    </p>
                    {account.dashboard ? (
                      <p className="text-xs font-semibold text-[var(--color-brand-primary)] mt-1">
                        Includes dashboard access
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
