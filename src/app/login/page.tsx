import Link from "next/link";
import { LoginForm } from "./login-form";
import { OAuthButtons } from "./oauth-buttons";

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-stretch px-4 py-20 sm:py-28">
      <div className="text-center">
        <h1 className="font-serif text-4xl tracking-tight">다시 오셨네요</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          이메일과 비밀번호로 로그인하세요.
        </p>
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card/50 p-7 shadow-lg shadow-black/10">
        <OAuthButtons />
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">또는</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        계정이 없나요?{" "}
        <Link href="/signup" className="font-medium text-primary transition-opacity hover:opacity-80">
          가입하기
        </Link>
      </p>
    </main>
  );
}
