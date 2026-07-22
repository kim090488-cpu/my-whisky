import { cn } from "@/lib/utils/cn";

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
};

export function Avatar({ name, avatarUrl, size = 48, className }: Props) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-amber-700/30 font-medium text-amber-200",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </div>
  );
}
