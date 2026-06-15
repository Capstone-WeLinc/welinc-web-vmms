import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login, recordLoginActivity } from "../../api/fleetService";
import { ApiError } from "../../api/requestClient";
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

const MAX_LOGIN_ATTEMPTS = 5;

function getAttemptStorageKey(username: string) {
  return `login-attempts-remaining:${username.trim().toLowerCase()}`;
}

function getStoredRemainingAttempts(username: string) {
  if (!username.trim()) return MAX_LOGIN_ATTEMPTS;

  const storedValue = Number(
    window.localStorage.getItem(getAttemptStorageKey(username)),
  );

  return Number.isInteger(storedValue) &&
    storedValue >= 0 &&
    storedValue <= MAX_LOGIN_ATTEMPTS
    ? storedValue
    : MAX_LOGIN_ATTEMPTS;
}

type LoginFeedback = {
  message: string;
  isLocked: boolean;
  remainingAttempts?: number;
};

function getUserFriendlyLoginError(error: unknown): LoginFeedback {
  if (error instanceof ApiError && typeof error.data === "object" && error.data !== null) {
    const data = error.data as {
      remainingAttempts?: unknown;
      isLocked?: unknown;
    };

    if (data.isLocked === true) {
      return {
        message:
          "Your account is now locked. Contact an administrator to unlock it.",
        isLocked: true,
        remainingAttempts: 0,
      };
    }

    if (typeof data.remainingAttempts === "number") {
      return {
        message:
          "The username or password you entered is incorrect. Please try again.",
        isLocked: false,
        remainingAttempts: data.remainingAttempts,
      };
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("account is locked") || message.includes("locked")) {
      return {
        message:
          "Your account is now locked. Contact an administrator to unlock it.",
        isLocked: true,
      };
    }

    if (message.includes("invalid") || message.includes("unauthorized") || message.includes("401")) {
      return {
        message:
          "The username or password you entered is incorrect. Please try again.",
        isLocked: false,
      };
    }

    if (message.includes("network") || message.includes("failed to fetch")) {
      return {
        message:
          "We couldn't reach the sign-in service right now. Please try again in a moment.",
        isLocked: false,
      };
    }
  }

  return {
    message:
      "We couldn't sign you in. Please check your username and password and try again.",
    isLocked: false,
  };
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<LoginFeedback | null>(null);
  const [remainingAttempts, setRemainingAttempts] =
    useState(MAX_LOGIN_ATTEMPTS);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const system = "VMMS" as const;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setLoading(true);

    try {
      const response = await login(username, password, system);
      window.localStorage.removeItem(getAttemptStorageKey(username));
      window.localStorage.setItem("accessToken", response.accessToken);
      // session timestamps: login time and last activity
      setLoginTime(new Date());
      setLastActivity(new Date());
      await recordLoginActivity();
      onLogin();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Login failed:", error);
      const nextFeedback = getUserFriendlyLoginError(error);
      setFeedback(nextFeedback);
      if (typeof nextFeedback.remainingAttempts === "number") {
        const nextRemaining = nextFeedback.remainingAttempts;
        window.localStorage.setItem(
          getAttemptStorageKey(username),
          String(nextRemaining),
        );
        setRemainingAttempts(nextRemaining);
      }
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
                onChange={(event) => {
                  const nextUsername = event.target.value;
                  setUsername(nextUsername);
                  setFeedback(null);
                  setRemainingAttempts(
                    getStoredRemainingAttempts(nextUsername),
                  );
                }}
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

          {feedback && (
            <div
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200"
              role="alert"
            >
              {feedback.isLocked ? (
                <>
                  <p className="font-semibold">Account is locked</p>
                  <p className="mt-1">
                    Contact an administrator to unlock your account.
                  </p>
                </>
              ) : typeof feedback.remainingAttempts === "number" ? (
                <p className="font-semibold">
                  {remainingAttempts}{" "}
                  {remainingAttempts === 1 ? "attempt" : "attempts"} remaining
                  before your account is locked.
                </p>
              ) : (
                <p className="font-semibold">{feedback.message}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || feedback?.isLocked}
            className={`${buttonClasses} btn-primary mt-2`}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
