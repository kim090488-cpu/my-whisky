"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/auth/rate-limit";
import type {
  WhiskyCountry, DistilleryStatus, BottlerKind, CaskType,
} from "@/types/database";

const COUNTRIES: readonly WhiskyCountry[] = [
  "scotland", "ireland", "usa", "canada", "japan", "india",
  "taiwan", "australia", "france", "sweden", "germany", "south_korea", "other",
];
const STATUSES: readonly DistilleryStatus[] = [
  "active", "silent", "closed", "demolished", "planned",
];
const BOTTLERS: readonly BottlerKind[] = ["official", "independent", "private"];
const CASKS: readonly CaskType[] = [
  "bourbon", "sherry", "port", "wine", "rum",
  "virgin_oak", "refill", "mixed", "other", "unknown",
];

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function validateUrl(v: string | null): string | null | { error: string } {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:")
      return { error: "URL은 http/https 만 가능합니다." };
    return v;
  } catch {
    return { error: "URL 형식이 올바르지 않습니다." };
  }
}

const THIS_YEAR = new Date().getFullYear();

// ────────────────────────────────────────────────
// createDistillery
// ────────────────────────────────────────────────
export async function createDistillery(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 위키 스팸 방지: 1시간에 5개까지
  const limit = rateLimit(`contrib_distillery:${user.id}`, { max: 5, windowMs: 3_600_000 });
  if (!limit.ok) {
    return { error: `증류소는 1시간에 최대 5개까지 등록할 수 있어요. ${Math.ceil(limit.retryAfterMs / 60_000)}분 후 다시 시도해주세요.` };
  }

  const name = String(formData.get("name") ?? "").trim();
  const countryRaw = String(formData.get("country") ?? "");
  const statusRaw = String(formData.get("status") ?? "active");

  if (name.length < 1 || name.length > 100)
    return { error: "이름은 1~100자." };
  if (!(COUNTRIES as readonly string[]).includes(countryRaw))
    return { error: "국가를 선택해주세요." };
  const country = countryRaw as WhiskyCountry;
  const status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as DistilleryStatus)
    : "active";

  const region = trimOrNull(formData.get("region"));
  const name_kr = trimOrNull(formData.get("name_kr"));
  if (name_kr && name_kr.length > 100)
    return { error: "한글 이름은 100자 이내." };
  const description = trimOrNull(formData.get("description"));
  if (description && description.length > 2000)
    return { error: "소개는 2000자 이내." };

  const founded = intOrNull(formData.get("founded_year"));
  if (founded !== null && (founded < 1500 || founded > THIS_YEAR + 1))
    return { error: `설립 연도는 1500~${THIS_YEAR + 1} 사이.` };

  const websiteRaw = trimOrNull(formData.get("website"));
  const websiteChecked = validateUrl(websiteRaw);
  if (websiteChecked && typeof websiteChecked === "object")
    return { error: websiteChecked.error };
  const website = websiteChecked as string | null;

  // 중복 체크
  const { data: existing } = await supabase
    .from("distilleries")
    .select("id")
    .ilike("name", name)
    .eq("country", country)
    .maybeSingle();
  if (existing)
    return { error: "같은 국가에 동일 이름의 증류소가 이미 있어요." };

  const { data: inserted, error } = await supabase
    .from("distilleries")
    .insert({
      name,
      name_kr,
      country,
      region,
      status,
      founded_year: founded,
      website,
      description,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/distilleries");
  redirect(`/distilleries/${inserted.id}`);
}

// ────────────────────────────────────────────────
// createBottling
// ────────────────────────────────────────────────
export async function createBottling(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 위키 스팸 방지: 1시간에 15개까지
  const limit = rateLimit(`contrib_bottling:${user.id}`, { max: 15, windowMs: 3_600_000 });
  if (!limit.ok) {
    return { error: `보틀링은 1시간에 최대 15개까지 등록할 수 있어요. ${Math.ceil(limit.retryAfterMs / 60_000)}분 후 다시 시도해주세요.` };
  }

  const distilleryIdRaw = String(formData.get("distillery_id") ?? "").trim();
  const distilleryId = distilleryIdRaw.length > 0 ? distilleryIdRaw : null;
  if (!distilleryId) return { error: "증류소를 선택해주세요." };
  const name_kr = trimOrNull(formData.get("name_kr"));
  const nameRaw = String(formData.get("name") ?? "").trim();
  if (!name_kr) return { error: "보틀링 한글 이름을 입력해주세요." };
  if (name_kr.length > 200) return { error: "한글 이름은 200자 이내." };
  if (nameRaw.length > 200) return { error: "영문 이름은 200자 이내." };
  // 영문 비면 한글을 복사 (name NOT NULL 만족)
  const name = nameRaw.length > 0 ? nameRaw : name_kr;

  const age_years = intOrNull(formData.get("age_years"));
  if (age_years !== null && (age_years < 0 || age_years > 100))
    return { error: "숙성 연수는 0~100." };

  const abv = numOrNull(formData.get("abv"));
  if (abv !== null && (abv < 20 || abv > 80))
    return { error: "ABV는 20~80%." };

  const vintage_year = intOrNull(formData.get("vintage_year"));
  if (vintage_year !== null && (vintage_year < 1900 || vintage_year > THIS_YEAR))
    return { error: `빈티지 연도는 1900~${THIS_YEAR}.` };

  const bottling_year = intOrNull(formData.get("bottling_year"));
  if (bottling_year !== null && (bottling_year < 1900 || bottling_year > THIS_YEAR + 1))
    return { error: `병입 연도는 1900~${THIS_YEAR + 1}.` };

  const bottle_size_ml = intOrNull(formData.get("bottle_size_ml"));
  if (bottle_size_ml !== null && (bottle_size_ml < 50 || bottle_size_ml > 10000))
    return { error: "병 용량은 50~10000ml." };

  const total_bottles = intOrNull(formData.get("total_bottles"));
  if (total_bottles !== null && total_bottles < 1)
    return { error: "총 병수는 1 이상." };

  const caskRaw = String(formData.get("cask_type") ?? "unknown");
  const cask_type = (CASKS as readonly string[]).includes(caskRaw)
    ? (caskRaw as CaskType)
    : "unknown";

  const bottlerRaw = String(formData.get("bottler") ?? "official");
  const bottler = (BOTTLERS as readonly string[]).includes(bottlerRaw)
    ? (bottlerRaw as BottlerKind)
    : "official";

  const bottler_name = trimOrNull(formData.get("bottler_name"));
  const notes = trimOrNull(formData.get("notes"));
  if (notes && notes.length > 2000) return { error: "노트는 2000자 이내." };

  const { data: inserted, error } = await supabase
    .from("bottlings")
    .insert({
      distillery_id: distilleryId,
      name,
      name_kr,
      age_years,
      abv,
      vintage_year,
      bottling_year,
      cask_type,
      bottler,
      bottler_name,
      bottle_size_ml: bottle_size_ml ?? 700,
      total_bottles,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/whiskies");
  if (distilleryId) revalidatePath(`/distilleries/${distilleryId}`);
  redirect(`/whiskies/${inserted.id}`);
}

// ────────────────────────────────────────────────
// updateBottling (위키식 — 인증된 사용자 누구나)
// ────────────────────────────────────────────────
export async function updateBottling(bottlingId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!bottlingId) return { error: "보틀링 정보가 누락됐습니다." };

  const { data: existing } = await supabase
    .from("bottlings")
    .select("id, distillery_id")
    .eq("id", bottlingId)
    .maybeSingle();
  if (!existing) return { error: "보틀링을 찾을 수 없습니다." };

  const distilleryIdRaw = String(formData.get("distillery_id") ?? "").trim();
  const distilleryId = distilleryIdRaw.length > 0 ? distilleryIdRaw : null;
  if (!distilleryId) return { error: "증류소를 선택해주세요." };
  const name_kr = trimOrNull(formData.get("name_kr"));
  const nameRaw = String(formData.get("name") ?? "").trim();
  if (!name_kr) return { error: "보틀링 한글 이름을 입력해주세요." };
  if (name_kr.length > 200) return { error: "한글 이름은 200자 이내." };
  if (nameRaw.length > 200) return { error: "영문 이름은 200자 이내." };
  const name = nameRaw.length > 0 ? nameRaw : name_kr;

  const age_years = intOrNull(formData.get("age_years"));
  if (age_years !== null && (age_years < 0 || age_years > 100))
    return { error: "숙성 연수는 0~100." };

  const abv = numOrNull(formData.get("abv"));
  if (abv !== null && (abv < 20 || abv > 80))
    return { error: "ABV는 20~80%." };

  const vintage_year = intOrNull(formData.get("vintage_year"));
  if (vintage_year !== null && (vintage_year < 1900 || vintage_year > THIS_YEAR))
    return { error: `빈티지 연도는 1900~${THIS_YEAR}.` };

  const bottling_year = intOrNull(formData.get("bottling_year"));
  if (bottling_year !== null && (bottling_year < 1900 || bottling_year > THIS_YEAR + 1))
    return { error: `병입 연도는 1900~${THIS_YEAR + 1}.` };

  const bottle_size_ml = intOrNull(formData.get("bottle_size_ml"));
  if (bottle_size_ml !== null && (bottle_size_ml < 50 || bottle_size_ml > 10000))
    return { error: "병 용량은 50~10000ml." };

  const total_bottles = intOrNull(formData.get("total_bottles"));
  if (total_bottles !== null && total_bottles < 1)
    return { error: "총 병수는 1 이상." };

  const caskRaw = String(formData.get("cask_type") ?? "unknown");
  const cask_type = (CASKS as readonly string[]).includes(caskRaw)
    ? (caskRaw as CaskType)
    : "unknown";

  const bottlerRaw = String(formData.get("bottler") ?? "official");
  const bottler = (BOTTLERS as readonly string[]).includes(bottlerRaw)
    ? (bottlerRaw as BottlerKind)
    : "official";

  const bottler_name = trimOrNull(formData.get("bottler_name"));
  const notes = trimOrNull(formData.get("notes"));
  if (notes && notes.length > 2000) return { error: "노트는 2000자 이내." };

  const { error } = await supabase
    .from("bottlings")
    .update({
      distillery_id: distilleryId,
      name,
      name_kr,
      age_years,
      abv,
      vintage_year,
      bottling_year,
      cask_type,
      bottler,
      bottler_name,
      bottle_size_ml: bottle_size_ml ?? 700,
      total_bottles,
      notes,
    })
    .eq("id", bottlingId);
  if (error) return { error: error.message };

  revalidatePath("/whiskies");
  revalidatePath(`/whiskies/${bottlingId}`);
  if (distilleryId) revalidatePath(`/distilleries/${distilleryId}`);
  if (existing.distillery_id && existing.distillery_id !== distilleryId) {
    revalidatePath(`/distilleries/${existing.distillery_id}`);
  }
  redirect(`/whiskies/${bottlingId}`);
}
