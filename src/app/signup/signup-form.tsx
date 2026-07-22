"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { signUp } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await signUp(fd);
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8자 이상"
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          최소 8자 · 안전한 조합을 권장합니다.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="w-full h-11"
      >
        {pending ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
