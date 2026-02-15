"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

type AuthMode = "login" | "signup";

export default function AuthClient({ mode }: { mode: AuthMode }) {
  const [hasGoogleProvider, setHasGoogleProvider] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const checkProvider = async () => {
      try {
        const response = await fetch("/api/auth/providers");
        const providers = (await response.json()) as Record<string, unknown>;
        if (active) {
          setHasGoogleProvider(Boolean(providers.google));
        }
      } catch {
        if (active) {
          setHasGoogleProvider(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    checkProvider();

    return () => {
      active = false;
    };
  }, []);

  const labels = useMemo(() => {
    if (mode === "login") {
      return {
        title: "계정으로 로그인",
        subtitle: "Google 계정으로 빠르게 시작하세요.",
        button: "Google로 계속하기",
        helper: "계정이 없다면 첫 로그인 시 자동으로 가입 처리됩니다.",
        switchLabel: "아직 회원가입이 필요하신가요?",
        switchTarget: "/auth/signup",
      };
    }

    return {
      title: "회원가입",
      subtitle: "Google 로그인 하나로 빠르게 시작하세요.",
      button: "Google로 회원가입",
      helper: "실제로는 Google 인증으로 시작되며, 별도 비밀번호가 필요 없습니다.",
      switchLabel: "이미 계정이 있으신가요?",
      switchTarget: "/auth/login",
    };
  }, [mode]);

  const handleGoogle = async () => {
    if (!hasGoogleProvider) {
      setMessage("현재 OAuth 설정이 준비되지 않았습니다. 운영 설정을 확인해 주세요.");
      return;
    }

    await signIn("google", {
      callbackUrl: "/",
    });
  };

  return (
    <main className="relative min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-16rem] h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute right-[-8rem] bottom-[-10rem] h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md sm:p-8">
          <p className="inline-flex rounded-full bg-emerald-300/25 px-3 py-1 text-xs font-medium text-emerald-100">
            paste-thumbs · Google 전용 인증
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-tight">{labels.title}</h1>
          <p className="mt-2 text-sm text-white/80">{labels.subtitle}</p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={checking}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:brightness-95 disabled:opacity-60"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs font-black text-white">G</span>
              {checking ? "확인 중..." : labels.button}
            </button>

            <p className="text-xs leading-relaxed text-white/70">{labels.helper}</p>
            {message ? <p className="text-sm text-rose-200">{message}</p> : null}
          </div>

          <p className="mt-8 text-sm text-white/70">
            {labels.switchLabel}{" "}
            <Link href={labels.switchTarget} className="font-semibold text-emerald-200 underline-offset-2 hover:underline">
              {mode === "login" ? "회원가입 하기" : "로그인 하기"}
            </Link>
          </p>

          <div className="mt-3 border-t border-white/15 pt-4 text-xs text-white/60">
            <p>비밀번호, 닉네임 관리 없이 Google 계정으로만 이용 가능합니다.</p>
            <Link href="/" className="mt-2 inline-block text-emerald-200 underline-offset-2 hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
