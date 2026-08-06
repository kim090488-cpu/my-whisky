import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-background/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} my-whisky</span>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground">개인정보 처리방침</Link>
          <Link href="/terms" className="hover:text-foreground">이용약관</Link>
          <a href="mailto:kim090488@gmail.com" className="hover:text-foreground">문의</a>
        </nav>
      </div>
    </footer>
  );
}
