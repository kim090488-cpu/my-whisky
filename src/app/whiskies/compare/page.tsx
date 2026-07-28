import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CompareClient } from "./compare-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "위스키 비교 · my-whisky",
  description: "두 위스키의 스펙·평점·향미를 나란히 비교해보세요.",
};

type SearchParams = Promise<{ a?: string; b?: string }>;

export default async function CompareWhiskiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/whiskies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        위스키 카탈로그
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="font-serif text-3xl tracking-tight">위스키 비교</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          두 위스키를 고르면 스펙·평점·향미가 나란히 표시됩니다.
        </p>
      </header>

      <CompareClient initialA={sp.a ?? null} initialB={sp.b ?? null} />
    </main>
  );
}
