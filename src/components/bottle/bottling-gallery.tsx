import { bottlingImageUrl } from "@/lib/uploads/storage";
import { deleteBottlingImage } from "@/lib/uploads/actions";

type Image = {
  id: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string | null;
};

type Props = {
  images: Image[];
  currentUserId: string | null;
};

export function BottlingGallery({ images, currentUserId }: Props) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-border bg-gradient-to-b from-accent/30 to-background">
        <span className="text-sm text-muted-foreground/70">라벨 사진 없음</span>
      </div>
    );
  }

  const [hero, ...rest] = images;
  const heroUrl = bottlingImageUrl(hero.storage_path);

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-gradient-to-b from-accent/30 to-background">
        {heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroUrl} alt={hero.caption ?? ""} className="h-full w-full object-contain" />
        )}
        {currentUserId && hero.uploaded_by === currentUserId && (
          <form action={deleteBottlingImage as unknown as (fd: FormData) => Promise<void>} className="absolute right-2 top-2">
            <input type="hidden" name="image_id" value={hero.id} />
            <button className="rounded-md bg-black/60 px-2 py-1 text-[10px] text-foreground/80 backdrop-blur transition-colors hover:bg-destructive/80 hover:text-foreground">
              내 사진 삭제
            </button>
          </form>
        )}
      </div>

      {rest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {rest.map((img) => {
            const url = bottlingImageUrl(img.storage_path);
            return (
              <div
                key={img.id}
                className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-card"
              >
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={img.caption ?? ""} className="h-full w-full object-cover" />
                )}
                {currentUserId && img.uploaded_by === currentUserId && (
                  <form action={deleteBottlingImage as unknown as (fd: FormData) => Promise<void>} className="absolute right-0.5 top-0.5">
                    <input type="hidden" name="image_id" value={img.id} />
                    <button className="rounded bg-black/60 px-1 text-[9px] text-foreground/80 transition-colors hover:bg-destructive/80 hover:text-foreground">
                      ×
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
