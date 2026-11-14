"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function SignInForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      router.push("/app");
      return;
    }

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback?next=/tao-dong-ho`, captchaToken } });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    router.push(mode === "signup" ? "/xac-minh-email" : "/app");
    router.refresh();
  }

  async function handleGoogle() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      router.push("/app");
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback${mode === "signup" ? "?next=/tao-dong-ho" : ""}` }
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <button className="google-button" type="button" onClick={handleGoogle} disabled={loading}>
        <span aria-hidden="true">G</span> Tiếp tục với Google
      </button>
      <div className="form-divider"><span>hoặc bằng email</span></div>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required placeholder="tenban@example.com" />
      </label>
      {mode === "signin" && <Link className="forgot-link" href="/quen-mat-khau">Quên mật khẩu?</Link>}
      {mode === "signup" && <TurnstileWidget action="signup" onToken={setCaptchaToken} />}
      <label>
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={10}
          placeholder="Tối thiểu 10 ký tự"
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-wide" type="submit" disabled={loading}>
        {loading ? <LoaderCircle className="spin" /> : mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
        {!loading && <ArrowRight size={18} />}
      </button>
      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
        <p className="demo-note">Chế độ demo: dùng bất kỳ email và mật khẩu 10 ký tự để mở dashboard mẫu.</p>
      )}
    </form>
  );
}
