import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env 미설정 — .env에 EXPO_PUBLIC_SUPABASE_URL/KEY 확인");
}

// expo-router static web SSR(node) 환경에서 AsyncStorage가 window를 참조해 죽음.
// 노드 SSR 한정 in-memory noop — prerender HTML은 세션 안 씀.
const isNodeSSR =
  typeof process !== "undefined" &&
  !!process.versions?.node &&
  typeof globalThis.window === "undefined";

const ssrMemory = new Map<string, string>();
const ssrStorage = {
  getItem: async (k: string) => ssrMemory.get(k) ?? null,
  setItem: async (k: string, v: string) => {
    ssrMemory.set(k, v);
  },
  removeItem: async (k: string) => {
    ssrMemory.delete(k);
  },
};

// ────────────────────────────────────────────────
// 네이티브: expo-secure-store (iOS Keychain / Android Keystore)
//   - SecureStore 값 최대 2KB → 세션이 클 수 있으니 청크로 분할 저장
//   - 메타데이터(`<key>__chunks`)에 청크 개수를 보관
//   - 키 마이그레이션: 기존 AsyncStorage 세션 있으면 한 번만 옮겨오고 삭제
// ────────────────────────────────────────────────
const CHUNK_SIZE = 1800; // SecureStore 한도(2048) 아래 안전 마진

async function secureSet(key: string, value: string) {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}__chunks`, String(chunks));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(
      `${key}__${i}`,
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
}

async function secureGet(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(`${key}__chunks`);
  if (!meta) return null;
  const chunks = Number(meta);
  if (!Number.isFinite(chunks) || chunks <= 0) return null;
  const parts: string[] = [];
  for (let i = 0; i < chunks; i++) {
    const part = await SecureStore.getItemAsync(`${key}__${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function secureRemove(key: string) {
  const meta = await SecureStore.getItemAsync(`${key}__chunks`);
  if (meta) {
    const chunks = Number(meta);
    if (Number.isFinite(chunks) && chunks > 0) {
      for (let i = 0; i < chunks; i++) {
        await SecureStore.deleteItemAsync(`${key}__${i}`);
      }
    }
    await SecureStore.deleteItemAsync(`${key}__chunks`);
  }
}

const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const current = await secureGet(key);
    if (current !== null) return current;
    // 기존 AsyncStorage에 남아있던 세션을 한 번만 옮겨온다.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await secureSet(key, legacy);
      await AsyncStorage.removeItem(key);
      return legacy;
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    await secureSet(key, value);
  },
  removeItem: async (key: string) => {
    await secureRemove(key);
    await AsyncStorage.removeItem(key);
  },
};

const storage = isNodeSSR
  ? ssrStorage
  : Platform.OS === "web"
    ? AsyncStorage // 웹에서는 SecureStore 미지원
    : secureStorage;

export const supabase = createClient<Database>(url!, anon!, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
