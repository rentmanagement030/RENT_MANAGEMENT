import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, ExternalLink, FileText, Loader2, Maximize, Minimize, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { downloadUrl, getAuthToken } from "@/lib/api";

interface FileViewerProps {
  open: boolean;
  name: string;
  url: string;
  onClose: () => void;
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
const PDF_RE = /\.pdf$/i;

export default function FileViewer({ open, name, url, onClose }: FileViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resolvedUrl = downloadUrl(url);
  const isImage = IMAGE_RE.test(name) || IMAGE_RE.test(url);
  const isPdf = PDF_RE.test(name) || PDF_RE.test(url) || (!isImage && !name.includes("."));

  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setFullscreen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Load PDF as blob URL for 100% iframe compatibility across origins
  useEffect(() => {
    if (!open || !resolvedUrl || !isPdf) {
      setBlobUrl(null);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setLoadError(null);

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    fetch(resolvedUrl, {
      headers,
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const pdfBlob = new Blob([blob], { type: blob.type || "application/pdf" });
        objectUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load document");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, resolvedUrl, isPdf]);

  if (!open) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  const print = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      try {
        win.focus();
        win.print();
        return;
      } catch {
        /* fallback */
      }
    }
    window.print();
  };

  const activeDocUrl = blobUrl || resolvedUrl;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={name}>
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between border-b border-slate-700/80 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <FileText className="size-5 shrink-0 text-blue-400" />
          <p className="min-w-0 truncate text-sm font-extrabold text-slate-100">{name}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isImage && (
            <>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                title="Zoom In"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                title="Zoom Out"
              >
                <ZoomOut className="size-4" />
              </button>
            </>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>

          {isPdf && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
              onClick={print}
            >
              <Printer className="size-3.5" /> Print
            </Button>
          )}

          <a
            href={resolvedUrl}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Download className="size-3.5" /> <span className="hidden sm:inline">Download</span>
          </a>

          <button
            type="button"
            className="ml-1 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 overflow-auto" onClick={onClose}>
        {isImage ? (
          <img
            src={resolvedUrl}
            alt={name}
            style={{ transform: `scale(${zoom})`, transition: "transform 0.2s ease" }}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : isPdf ? (
          loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-300" onClick={(e) => e.stopPropagation()}>
              <Loader2 className="size-8 animate-spin text-blue-400" />
              <p className="text-xs font-bold">Loading PDF document...</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3.5 p-8 text-center text-slate-200 max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-800">
                <AlertCircle className="size-8" />
              </div>
              <div>
                <p className="text-base font-extrabold text-white">{name}</p>
                <p className="mt-1 text-xs font-medium text-rose-300">{loadError}</p>
              </div>
              <a
                href={resolvedUrl}
                download={name}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="size-4" /> Download PDF Directly
              </a>
            </div>
          ) : (
            <div className="flex h-full w-full max-w-5xl flex-col items-center justify-center">
              {/* Mobile View: Dedicated Native Document Viewer Card (Eliminates mobile iframe dark GUID box) */}
              <div className="flex sm:hidden flex-col items-center justify-center gap-4 p-6 text-center text-slate-100 max-w-sm rounded-2xl bg-slate-800/90 border border-slate-700 shadow-2xl backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex size-20 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg">
                  <FileText className="size-10 stroke-[1.75]" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    PDF Document
                  </span>
                  <p className="text-sm font-extrabold text-white line-clamp-2 px-2">{name}</p>
                </div>
                <div className="w-full space-y-2.5 pt-2">
                  <a
                    href={activeDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all min-h-[44px]"
                  >
                    <ExternalLink className="size-4" /> Open / View PDF
                  </a>
                  <a
                    href={resolvedUrl}
                    download={name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700/80 px-5 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-[0.98] transition-all min-h-[44px]"
                  >
                    <Download className="size-4" /> Download PDF
                  </a>
                </div>
              </div>

              {/* Desktop / Tablet View: Full Embedded PDF Reader */}
              <iframe
                ref={iframeRef}
                src={activeDocUrl}
                title={name}
                className="hidden sm:block h-full w-full rounded-xl border border-slate-700/80 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-3.5 p-8 text-center text-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-800 text-blue-400 border border-slate-700">
              <FileText className="size-8" />
            </div>
            <div>
              <p className="text-base font-extrabold text-white">{name}</p>
              <p className="mt-1 max-w-xs text-xs font-medium text-slate-400">
                This document format can be downloaded for viewing on your device.
              </p>
            </div>
            <a
              href={resolvedUrl}
              download={name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="size-4" /> Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
