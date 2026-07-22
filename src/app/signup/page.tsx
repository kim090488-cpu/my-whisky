import Link from "next/link";
import { SignupForm } from "./signup-form";
import { OAuthButtons } from "../login/oauth-buttons";

export default function SignupPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-stretch px-4 py-20 sm:py-28">
      <div className="text-center">
        <h1 className="font-serif text-4xl tracking-tight">시작해볼까요</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          위스키를 기록하고 사람들과 나눕니다.
        </p>
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card/50 p-7 shadow-lg shadow-black/10">
        <OAuthButtons />
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">또는</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-primary transition-opacity hover:opacity-80">
          로그인
        </Link>
      </p>
    </main>
  );
}
