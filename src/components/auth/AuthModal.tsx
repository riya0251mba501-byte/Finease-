import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FIREBASE_PROJECT_ID } from '../../lib/firebase';

type AuthMode = 'login' | 'register' | 'reset';

function mapAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/operation-not-allowed':
      return `Email/Password sign-in is not yet enabled in Firebase project "${FIREBASE_PROJECT_ID}". Enable it in Firebase Console → Authentication → Sign-in method → Email/Password, or use Continue with Google.`;
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  }
}

export function AuthModal({
  open,
  onClose,
  initialMode = 'login',
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}) {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, sendResetEmail, authLoading } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const resetMessages = () => {
    setErrorMsg('');
    setInfoMsg('');
  };

  const switchMode = (next: AuthMode) => {
    resetMessages();
    setMode(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'reset') {
      try {
        await sendResetEmail(cleanEmail);
        setInfoMsg('Password reset link sent. Check your inbox and spam folder.');
        showToast('Password reset email sent.', 'success');
      } catch (err) {
        setErrorMsg(mapAuthError(err));
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (displayName.trim().length < 2) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      try {
        await registerWithEmail({
          displayName: displayName.trim(),
          email: cleanEmail,
          password,
          phone: phone.trim(),
        });
        showToast('Account created! Please check your email to verify your address.', 'success');
        onClose();
      } catch (err) {
        setErrorMsg(mapAuthError(err));
      }
      return;
    }

    try {
      await loginWithEmail(cleanEmail, password);
      showToast('Signed in to FinEase.', 'success');
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    }
  };

  const handleGoogle = async () => {
    resetMessages();
    try {
      await loginWithGoogle();
      showToast('Signed in with Google.', 'success');
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    }
  };

  const title =
    mode === 'login'
      ? 'Sign in to FinEase'
      : mode === 'register'
        ? 'Create your FinEase account'
        : 'Reset your password';

  const subtitle =
    mode === 'login'
      ? 'Access your saved Dehradun addresses, orders, and support tickets.'
      : mode === 'register'
        ? 'Start ordering daily groceries with doorstep Cash on Delivery.'
        : 'Enter your registered email to receive a password reset link.';

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} maxWidthClass="max-w-md">
      {mode === 'reset' && (
        <div className="mb-4 flex items-center justify-start">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary-text)] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--status-danger-bg)] px-3.5 py-3 text-xs text-[var(--status-danger-text)] leading-relaxed"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--status-success-bg)] px-3.5 py-3 text-xs text-[var(--status-success-text)] leading-relaxed"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{infoMsg}</span>
        </div>
      )}

      {mode !== 'reset' && (
        <>
          <button
            type="button"
            disabled={authLoading}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-hairline)]" />
            <span className="text-xs text-[var(--text-muted)]">or continue with email</span>
            <div className="h-px flex-1 bg-[var(--border-hairline)]" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {mode === 'register' && (
          <>
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="auth-phone"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
              >
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98370 00000"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>
        </div>

        {mode !== 'reset' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Password
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-xs font-medium text-[var(--brand-primary-text)] hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-10 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-confirm-password"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
        >
          {authLoading
            ? 'Please wait...'
            : mode === 'login'
              ? 'Sign In'
              : mode === 'register'
                ? 'Create Account'
                : 'Send Reset Link'}
        </button>
      </form>

      {mode !== 'reset' && (
        <div className="mt-5 pt-4 border-t border-[var(--border-hairline)] text-center text-xs text-[var(--text-secondary)]">
          {mode === 'login' ? (
            <>
              New to FinEase?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-semibold text-[var(--brand-primary-text)] hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-[var(--brand-primary-text)] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
