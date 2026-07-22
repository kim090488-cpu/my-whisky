// 간단한 in-memory rate limiter.
// 단일 노드/엣지가 아닌 분산 환경(여러 람다)에서는 정확하지 않지만, 같은 인스턴스 내
// brute-force는 막아준다. 더 강한 보호는 Cloudflare/Vercel WAF 또는 Upstash 권장.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MAX_ENTRIES = 5000;

function gc(now: number) {
  if (buckets.size < MAX_ENTRIES) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  gc(now);
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, retryAfterMs: 0 };
  }
  if (cur.count >= opts.max) {
    return { ok: false, remaining: 0, retryAfterMs: cur.resetAt - now };
  }
  cur.count += 1;
  return { ok: true, remaining: opts.max - cur.count, retryAfterMs: 0 };
}
