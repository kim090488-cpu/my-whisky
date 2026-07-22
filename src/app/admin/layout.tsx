import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminGuard } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getAdminGuard();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin) redirect("/me");

  return (
    <div>
      <div className="border-b border-amber-900/30 bg-amber-950/20">
        <nav className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-amber-300">관리</span>
          <Link href="/admin" className="text-neutral-300 hover:text-amber-200">대시보드</Link>
          <Link href="/admin/reports" className="text-neutral-300 hover:text-amber-200">신고 큐</Link>
          <Link href="/admin/users" className="text-neutral-300 hover:text-amber-200">사용자</Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
