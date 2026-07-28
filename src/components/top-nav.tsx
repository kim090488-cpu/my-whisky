import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { SearchBar } from "@/components/search/search-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { buttonVariants } from "@/components/ui/button";

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let unreadCount = 0;
  if (user) {
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);
    isAdmin = p?.is_admin ?? false;
    unreadCount = count ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
      <nav className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-3.5 text-sm sm:gap-7 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-serif text-xl tracking-tight text-primary"
        >
          my·whisky
        </Link>

        <div className="hidden items-center gap-5 sm:flex">
          <NavLink href="/whiskies">위스키</NavLink>
          <NavLink href="/tastings">노트</NavLink>
          <NavLink href="/posts">모먼트</NavLink>
          <NavLink href="/community">커뮤니티</NavLink>
          <NavLink href="/distilleries">증류소</NavLink>
          <NavLink href="/ranking">랭킹</NavLink>
          <NavLink href="/picks">추천</NavLink>
          <NavLink href="/curator">큐레이터</NavLink>
        </div>

        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <div className="hidden md:block">
            <SearchBar />
          </div>

          {user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden shrink-0 rounded-full border border-primary/40 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10 sm:inline-flex"
                >
                  관리
                </Link>
              )}
              <NotificationBell initialCount={unreadCount} />
              <Link
                href="/me"
                className="hidden shrink-0 text-foreground/70 transition-colors hover:text-foreground sm:inline"
              >
                내 페이지
              </Link>
              <form action={signOut} className="shrink-0">
                <button className="text-muted-foreground transition-colors hover:text-foreground">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden shrink-0 text-foreground/70 transition-colors hover:text-foreground sm:inline"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className={buttonVariants({ size: "sm" }) + " shrink-0"}
              >
                가입
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-foreground/70 transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}
