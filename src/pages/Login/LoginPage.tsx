import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login, recordLoginActivity } from "../../api/fleetService";
import { setLoginTime, setLastActivity } from "../../utils/session";

// Layout & interaction classes
const containerClasses = 'h-full flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8';
const formClasses = 'mt-8 space-y-6';
const brandContainerClasses = 'flex items-center justify-center';
const formGroupClasses = 'space-y-4';
const inputWrapperClasses = 'space-y-1';
const inputClasses = 'w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 transition-colors';
const buttonClasses = 'flex w-full items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-70';
const headerClasses = 'flex flex-col items-center gap-2 text-center';
const cardsContainerClasses = 'w-full max-w-md space-y-8';

interface LoginPageProps {
  onLogin: () => void;
}

function getUserFriendlyLoginError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("invalid") || message.includes("unauthorized") || message.includes("401")) {
      return "The username or password you entered is incorrect. Please try again.";
    }

    if (message.includes("network") || message.includes("failed to fetch")) {
      return "We couldn't reach the sign-in service right now. Please try again in a moment.";
    }
  }

  return "We couldn't sign you in. Please check your username and password and try again.";
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const system = "VMMS" as const;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(username, password, system);
      window.localStorage.setItem("accessToken", response.accessToken);
      // session timestamps: login time and last activity
      setLoginTime(new Date());
      setLastActivity(new Date());
      await recordLoginActivity();
      onLogin();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Login failed:", error);
      setError(getUserFriendlyLoginError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={containerClasses}>
      <div className={`${cardsContainerClasses} w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 shadow-card transition-theme`}>
        <div className={headerClasses}>
          <div className={`${brandContainerClasses} h-16 w-16 rounded-xl bg-[var(--color-brand-primary)] text-white text-xl font-bold flex items-center justify-center shadow-[0_12px_40px_rgba(15,23,42,0.25)]`}>WL</div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">WeLinc Logistics</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Vehicle Maintenance Management System</p>
          </div>
        </div>

        <form className={formClasses} onSubmit={handleSubmit}>
          <div className={formGroupClasses}>
            <div className={inputWrapperClasses}>
              <label htmlFor="username" className="text-sm font-semibold text-[var(--color-text-primary)]">Username</label>
              <input
                className={inputClasses}
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                required
              />
            </div>

            <div className={inputWrapperClasses}>
              <label htmlFor="password" className="text-sm font-semibold text-[var(--color-text-primary)]">Password</label>
              <div className="relative">
                <input
                  className={`${inputClasses} pr-10`}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent text-[var(--color-text-secondary)] border-0 p-0 flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert-danger">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`${buttonClasses} btn-primary mt-2`}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
