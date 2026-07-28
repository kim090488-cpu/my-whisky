import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import {
  suspendUser as _suspendUser,
  unsuspendUser as _unsuspendUser,
} from "@/lib/admin/actions";

type FormAction = (fd: FormData) => Promise<void>;
const suspendUser = _suspendUser as unknown as FormAction;
const unsuspendUser = _unsuspendUser as unknown as FormAction;

export const dynamic = "force-dynamic";

export const metadata = { title: "사용자 · my-whisky 관리" };

type SearchParams = Promise<{ q?: string; suspended?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rawQ = (sp.q ?? "").trim();
  // PostgREST `.or()` 문자열은 `,` `(` `)` `.` `*` 가 구문 문자.
  // 또 LIKE 와일드카드 `%` `_` 도 literal 처리 필요. 안전하게 알파벳·숫자·공백·한글만 허용.
  const q = rawQ.replace(/[^\p{L}\p{N}\s]/gu, "").slice(0, 40);
  const onlySuspended = sp.suspended === "1";

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, follower_count, following_count, is_admin, suspended_until, suspension_reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (onlySuspended) query = query.gt("suspended_until", new Date().toISOString());

  const { data: users } = await query;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">사용자</h1>
      <p className="mt-1 text-sm text-neutral-500">검색·정지·해제</p>

      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="username 또는 display_name 검색"
          className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
        <button className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500">
          검색
        </button>
        <Link
          href={onlySuspended ? "/admin/users" : "/admin/users?suspended=1"}
          className={
            "rounded-md border px-4 py-2 text-sm " +
            (onlySuspended
              ? "border-amber-500 bg-amber-400/10 text-amber-200"
              : "border-neutral-700 text-neutral-300 hover:border-neutral-500")
          }
        >
          정지된 사용자만
        </Link>
      </form>

      <ul className="mt-6 space-y-2">
        {(users ?? []).map((u) => {
          const name = u.display_name ?? u.username;
          const isSuspended =
            u.suspended_until && new Date(u.suspended_until) > new Date();
          return (
            <li
              key={u.id}
              className={
                "rounded-lg border p-4 " +
                (isSuspended
                  ? "border-red-900/50 bg-red-950/20"
                  : "border-neutral-800 bg-neutral-900/40")
              }
            >
              <div className="flex items-center gap-3">
                <Avatar name={name} avatarUrl={u.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={`/profile/${u.username}`}
                      className="font-medium hover:text-amber-300"
                    >
                      {name}
                    </Link>
                    <span className="text-xs text-neutral-500">@{u.username}</span>
                    {u.is_admin && (
                      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                        admin
                      </span>
                    )}
                    {isSuspended && (
                      <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-300">
                        정지 중
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    팔로워 {u.follower_count} · 팔로잉 {u.following_count} ·{" "}
                    {new Date(u.created_at).toISOString().slice(0, 10)} 가입
                  </div>
                  {isSuspended && (
                    <div className="mt-1 text-xs text-red-300">
                      ~{new Date(u.suspended_until!).toLocaleString("ko-KR")} 까지
                      {u.suspension_reason && ` · ${u.suspension_reason}`}
                    </div>
                  )}
                </div>

                {!u.is_admin && (
                  isSuspended ? (
                    <form action={unsuspendUser}>
                      <input type="hidden" name="user_id" value={u.id} />
                      <button className="rounded-md border border-emerald-700/50 px-3 py-1.5 text-xs text-emerald-300 hover:border-emerald-500">
                        정지 해제
                      </button>
                    </form>
                  ) : (
                    <SuspendForm userId={u.id} />
                  )
                )}
              </div>
            </li>
          );
        })}
        {(!users || users.length === 0) && (
          <li className="rounded-md border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-500">
            검색 결과 없음
          </li>
        )}
      </ul>
    </main>
  );
}

function SuspendForm({ userId }: { userId: string }) {
  return (
    <form action={suspendUser} className="flex items-center gap-1">
      <input type="hidden" name="user_id" value={userId} />
      <input
        name="days"
        type="number"
        defaultValue={7}
        min={1}
        max={365}
        className="w-14 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs"
        title="일수"
      />
      <input
        name="reason"
        placeholder="사유"
        className="w-32 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs"
      />
      <button className="rounded-md border border-red-700/50 px-3 py-1.5 text-xs text-red-300 hover:border-red-500">
        정지
      </button>
    </form>
  );
}
