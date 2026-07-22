export const FLAVOR_TAGS = [
  { value: "smoky",       label: "스모키" },
  { value: "sweet",       label: "달콤" },
  { value: "fruity",      label: "과일" },
  { value: "spicy",       label: "스파이시" },
  { value: "smooth",      label: "부드러운" },
  { value: "complex",     label: "복잡한" },
  { value: "long_finish", label: "긴 여운" },
] as const;

export type FlavorTag = (typeof FLAVOR_TAGS)[number]["value"];

export const FLAVOR_COLUMN: Record<FlavorTag, string> = {
  smoky:       "smokiness",
  sweet:       "sweetness",
  fruity:      "fruitiness",
  spicy:       "spiciness",
  smooth:      "smoothness",
  complex:     "complexity",
  long_finish: "finish_length",
};

export const FLAVOR_THRESHOLD = 7;

export const FLAVOR_VALUE_SET: Set<string> = new Set(FLAVOR_TAGS.map((t) => t.value));

export function parseFlavors(raw: string | undefined): FlavorTag[] {
  return (raw ?? "")
    .split(",")
    .filter((v) => FLAVOR_VALUE_SET.has(v)) as FlavorTag[];
}
