import { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./primitives";

export interface LightboxImage {
  url: string;
  alt?: string;
  title?: string;
}

interface ImageLightboxModalProps {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function ImageLightboxModal({ images, initialIndex = 0, open, onClose }: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!open || !images.length) return null;

  const current = images[currentIndex] || images[0];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setScale(1);
    setRotation(0);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setScale(1);
    setRotation(0);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.3, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.3, 0.6));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="text-white text-xs font-bold bg-slate-900/80 px-3.5 py-1.5 rounded-full border border-slate-700/80 backdrop-blur-md shadow-xs">
          {current.title || current.alt || `Document ${currentIndex + 1} of ${images.length}`}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800 rounded-full" onClick={zoomIn} title="Zoom In">
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800 rounded-full" onClick={zoomOut} title="Zoom Out">
            <ZoomOut className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800 rounded-full" onClick={rotate} title="Rotate">
            <RotateCw className="size-4" />
          </Button>
          <a
            href={current.url}
            download={current.alt || "download"}
            className="inline-flex size-9 items-center justify-center rounded-full text-white hover:bg-slate-800 transition-colors"
            title="Download"
          >
            <Download className="size-4" />
          </a>
          <Button variant="ghost" size="icon" className="text-white hover:bg-rose-600/80 rounded-full ml-2" onClick={onClose} title="Close">
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex size-full items-center justify-center overflow-hidden">
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 sm:left-6 z-10 inline-flex size-11 items-center justify-center rounded-full bg-slate-900/80 text-white border border-slate-700 hover:bg-blue-600 transition-all shadow-md active:scale-95"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 sm:right-6 z-10 inline-flex size-11 items-center justify-center rounded-full bg-slate-900/80 text-white border border-slate-700 hover:bg-blue-600 transition-all shadow-md active:scale-95"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}

        <img
          src={current.url}
          alt={current.alt || "Viewer Image"}
          className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-200 select-none shadow-2xl rounded-lg"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
        />
      </div>

      {/* Bottom Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-700 shadow-xs">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
