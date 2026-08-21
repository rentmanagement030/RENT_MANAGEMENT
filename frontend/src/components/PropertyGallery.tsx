import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, X } from "lucide-react";
import type { PropertyImage } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";

interface PropertyGalleryProps {
  images: PropertyImage[];
  alt?: string;
  editable?: boolean;
  uploading?: boolean;
  onUpload?: (files: File[]) => void;
  onRemove?: (image: PropertyImage) => void;
  onSetPrimary?: (image: PropertyImage) => void;
  className?: string;
}

export default function PropertyGallery({
  images,
  alt = "Property",
  editable = false,
  uploading = false,
  onUpload,
  onRemove,
  onSetPrimary,
  className,
}: PropertyGalleryProps) {
  const sorted = useMemo(() => {
    const list = [...images];
    list.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
    return list;
  }, [images]);

  const [lightbox, setLightbox] = useState<number | null>(null);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const open = (i: number) => setLightbox(i);
  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (dir: 1 | -1) => {
      setLightbox((cur) => {
        if (cur === null || sorted.length === 0) return cur;
        return (cur + dir + sorted.length) % sorted.length;
      });
    },
    [sorted.length],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close, step]);

  const active = lightbox !== null ? sorted[lightbox] : undefined;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Hero Image Display */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm group max-h-[280px] sm:max-h-[420px]">
        {sorted.length > 0 ? (
          <button
            type="button"
            className="block w-full cursor-pointer text-left focus:outline-none h-full"
            onClick={() => open(0)}
            aria-label={`View ${alt} photos`}
          >
            <img src={sorted[0].url} alt={alt} loading="eager" className="aspect-[16/9] sm:aspect-[21/9] w-full object-cover max-h-[280px] sm:max-h-[420px] transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-900/80 px-2.5 py-1 text-[10px] sm:text-xs font-extrabold text-white backdrop-blur-md border border-white/20">
                <Star className="size-3 text-amber-400 fill-amber-400" /> Main Cover Photo
              </span>
              <span className="rounded-xl bg-slate-900/80 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-slate-200 backdrop-blur-md border border-white/20">
                {sorted.length} {sorted.length === 1 ? "Photo" : "Photos"} · Click to view
              </span>
            </div>
          </button>
        ) : (
          <div className="flex h-[240px] w-full flex-col items-center justify-center bg-slate-50 p-6 text-center rounded-2xl border border-dashed border-slate-300">
            <div className="size-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              <ImagePlus className="size-6 text-slate-500" />
            </div>
            <p className="text-sm font-black text-slate-900">No property photos uploaded</p>
            <p className="mt-1 text-xs font-medium text-slate-500 max-w-xs">Add photos to showcase this property on your portal</p>
            {editable && onUpload && (
              <Button
                type="button"
                size="sm"
                onClick={() => fileInput?.click()}
                disabled={uploading}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs h-9 px-4 rounded-xl shadow-xs"
              >
                <ImagePlus className="size-4 mr-1.5" />
                {uploading ? "Uploading..." : "Add Photos"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Thumbnails Row + Integrated Upload Card */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none w-full max-w-full">
        {sorted.map((img, i) => (
          <div
            key={img.id ?? `${img.url}-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => open(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(i);
              }
            }}
            className={cn(
              "group relative h-16 w-20 sm:h-20 sm:w-28 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all shadow-xs",
              i === 0 ? "border-blue-600 ring-2 ring-blue-500/30" : "border-slate-200 hover:border-blue-400",
            )}
            aria-label={`View photo ${i + 1}`}
          >
            <img src={img.url} alt={`${alt} ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded-md bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs inline-flex items-center gap-0.5">
                <Star className="size-2.5 text-amber-300 fill-amber-300" /> Cover
              </span>

            {/* Hover Actions Overlay */}
            {editable && (
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-900/70 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title={img.isPrimary ? "Current cover photo" : "Set as cover photo"}
                  disabled={img.isPrimary}
                  className="rounded-lg bg-white p-1.5 text-slate-700 shadow-md hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary?.(img);
                  }}
                >
                  <Star className={cn("size-3.5", img.isPrimary && "fill-amber-500 text-amber-500")} />
                </button>
                <button
                  type="button"
                  title="Remove photo"
                  className="rounded-lg bg-white p-1.5 text-rose-600 shadow-md hover:bg-rose-50 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(img);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Integrated Upload Card (In-line with thumbnails) */}
        {editable && onUpload && (
          <button
            type="button"
            onClick={() => fileInput?.click()}
            disabled={uploading}
            className="flex h-16 w-20 sm:h-20 sm:w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 text-slate-600 hover:border-blue-600 hover:bg-blue-50/50 transition-all active:scale-95 disabled:opacity-50"
          >
            <ImagePlus className="size-4 sm:size-5 text-blue-600" />
            <span className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-black text-slate-800">{uploading ? "Uploading..." : "+ Add Photos"}</span>
          </button>
        )}
      </div>

      {editable && onUpload && (
        <input
          ref={setFileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onUpload(files);
            e.target.value = "";
          }}
        />
      )}

      {/* Lightbox Overlay */}
      {lightbox !== null && active && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={close}
            aria-label="Close"
          >
            <X className="size-6" />
          </button>
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            disabled={sorted.length === 1}
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-8" />
          </button>
          <img
            src={active.url}
            alt={`${alt} ${lightbox + 1}`}
            className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            disabled={sorted.length === 1}
            aria-label="Next photo"
          >
            <ChevronRight className="size-8" />
          </button>
          <p className="mt-4 rounded-xl bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md">
            Photo {lightbox + 1} of {sorted.length}
          </p>
        </div>
      )}
    </div>
  );
}
