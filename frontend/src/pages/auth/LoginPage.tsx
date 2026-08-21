import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Lock, Mail, ShieldCheck, KeyRound } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const { login, loginWithGoogle, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      toastError("Authentication failed", "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
      navigate("/admin");
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Google sign-in was cancelled or failed.";
      if (msg.includes("CONFIGURATION_NOT_FOUND") || msg.includes("configuration-not-found")) {
        msg = "Firebase Authentication is not enabled in your Firebase Console yet. Please enable Authentication & Google Provider in your Firebase Console.";
      }
      toastError("Google Sign-In failed", msg);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setResetSubmitting(true);
    try {
      await requestPasswordReset(forgotEmail);
      toastSuccess(
        "Password reset requested",
        "If an account exists, instructions have been sent to your email address.",
      );
      setShowForgotModal(false);
      setForgotEmail("");
    } catch {
      toastSuccess(
        "Password reset requested",
        "If an account exists, instructions have been sent to your email address.",
      );
      setShowForgotModal(false);
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        {/* Header / Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Building2 className="size-7" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">C2D Rentals</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Property Management Platform
          </p>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-lg font-bold text-slate-900">Welcome back</h2>
          <p className="text-xs text-slate-500">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold text-slate-700">
              Email address
            </Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@c2dtech.in"
                className="h-11 pl-10 text-sm"
              />
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-bold text-slate-700">
                Password
              </Label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline focus:outline-none"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 pl-10 pr-10 text-sm"
              />
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm shadow-blue-500/20 min-h-[44px]"
            size="lg"
            loading={submitting}
            disabled={submitting || googleSubmitting}
          >
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-slate-200" />
          <span className="absolute bg-white px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            OR
          </span>
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting || googleSubmitting}
          className="flex w-full min-h-[44px] h-11 items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50"
        >
          <svg className="size-5" viewBox="0 0 24 24">
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
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {googleSubmitting ? "Authenticating..." : "Continue with Google"}
        </button>

        {/* Demo Credentials Section */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-extrabold uppercase text-[10px] tracking-wider text-slate-800">
            <ShieldCheck className="size-3.5 text-blue-600" />
            <span>Secure Access & Demo Credentials</span>
          </div>
          <p className="font-mono text-slate-700">admin@c2dtech.in / Admin@123</p>
          <p className="font-mono text-slate-600">accounts@c2dtech.in / Accounts@123</p>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-500">
          <Link to="/" className="font-bold text-blue-600 hover:underline">
            ← Back to public property portal
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <KeyRound className="size-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-500">Send password recovery instructions</p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="forgotEmail" className="text-xs font-bold text-slate-700">
                  Account Email
                </Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-10 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 h-10 min-h-[40px]"
                  onClick={() => setShowForgotModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-1/2 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold min-h-[40px]"
                  loading={resetSubmitting}
                >
                  Send Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
