import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Alert, Button, Modal } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { keepWorking, signOut, staySignedIn } from '../../lib/session/session';

function countdown(cutoff: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((cutoff - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formattedTime(cutoff: number): string {
  return new Date(cutoff).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function SessionExpiryNotice() {
  const warning = useAuthStore((state) => state.idleWarning);
  const [now, setNow] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const cannotExtend = warning?.cannotExtend ?? false;
  const open = warning !== null && !warning.dismissed;
  const cutoff = warning?.cutoff;

  useEffect(() => {
    if (cutoff === undefined) return;
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [cutoff]);

  const stay = async () => {
    setActionError(null);
    const result = await staySignedIn();
    if (result === 'unavailable') {
      setActionError("Couldn't confirm that the session was extended. Try again, or sign out.");
    }
  };

  const leave = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setActionError(null);
    const result = await signOut();
    setSigningOut(false);
    if (result === 'failed') {
      setActionError("Couldn't sign out because the sign-in service is unavailable. Try again.");
    }
  };

  const closeWarning = () => {
    if (cannotExtend) keepWorking();
    else void stay();
  };

  return (
    <>
      {warning && (
        <Modal
          isOpen={open}
          title={cannotExtend ? 'Your session is ending' : 'Are you still there?'}
          message={
            cannotExtend
              ? `This session reaches its 12-hour limit at ${formattedTime(warning.cutoff)}. Keep working to save what you have open, then sign in again.`
              : `There has been no activity for a while. You will be signed out at ${formattedTime(warning.cutoff)}.`
          }
          onClose={closeWarning}
          size="sm"
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => void leave()} disabled={signingOut}>
                {cannotExtend ? 'Sign out now' : 'Log out'}
              </Button>
              <Button
                onClick={cannotExtend ? keepWorking : () => void stay()}
                disabled={warning.busy || signingOut}
              >
                {cannotExtend ? 'Keep working' : warning.busy ? 'Checking...' : 'Stay signed in'}
              </Button>
            </div>
          }
        >
          <p
            role="timer"
            aria-label="Time remaining before session expiration"
            aria-live="off"
            className="text-center text-3xl font-semibold tabular-nums"
          >
            {countdown(warning.cutoff, now)}
          </p>
          {actionError && (
            <Alert variant="warning" title="Session action failed" className="mt-4">
              {actionError}
            </Alert>
          )}
        </Modal>
      )}
      {warning?.cannotExtend && warning.dismissed && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950"
        >
          <Clock aria-hidden="true" size={16} className="shrink-0" />
          <span>
            This session reaches its 12-hour limit at {formattedTime(warning.cutoff)}. Save your work and sign in again.{' '}
            <span className="font-semibold tabular-nums">{countdown(warning.cutoff, now)}</span>
          </span>
        </div>
      )}
    </>
  );
}
