"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { signInWithProvider } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

type Provider = "google" | "kakao";

export function OAuthButtons() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Provider | null>(null);

  function handleClick(provider: Provider) {
    setError(null);
    setActive(provider);
    startTransition(async () => {
      const res = await signInWithProvider(provider);
      if (res?.error) {
        setError(res.error);
        setActive(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() => handleClick("google")}
        className="w-full h-11 bg-white text-neutral-900 hover:bg-neutral-100 border-neutral-300"
      >
        <GoogleIcon />
        <span className="ml-2">
          {active === "google" && pending ? "Google로 이동 중…" : "Google로 계속하기"}
        </span>
      </Button>

      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={() => handleClick("kakao")}
        className="w-full h-11 bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] border-0"
      >
        <KakaoIcon />
        <span className="ml-2">
          {active === "kakao" && pending ? "카카오로 이동 중…" : "카카오로 계속하기"}
        </span>
      </Button>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1A6.62 6.62 0 0 1 5.49 12c0-.73.13-1.44.34-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.78 1.85 5.23 4.65 6.62-.2.74-.74 2.75-.85 3.18-.13.54.2.53.42.39.17-.11 2.78-1.88 3.9-2.65.62.09 1.25.14 1.88.14 5.52 0 10-3.48 10-7.78C22 6.48 17.52 3 12 3z"/>
    </svg>
  );
}
