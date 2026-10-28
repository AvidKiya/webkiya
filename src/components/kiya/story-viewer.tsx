"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Eye,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import { brandProfile } from "./brand";
import { formatPrice } from "./kit";

/**
 * Story viewer, ported from the template's StoryViewerModal. Frames are built
 * from the published catalog (one story per category), so nothing on screen is
 * invented content.
 */
export function KiyaStoryViewer({
  products,
  category,
  onClose,
  onOpenProduct,
  onAdd,
}: {
  products: Product[];
  category: string | null;
  onClose: () => void;
  onOpenProduct: (id: string) => void;
  onAdd: (product: Product) => void;
}) {
  const stories = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const product of products) {
      const list = groups.get(product.category) ?? [];
      list.push(product);
      groups.set(product.category, list);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  }, [products]);

  const [storyIndex, setStoryIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [session, setSession] = useState<string | null>(category);

  // A new category starts a fresh story; keep the viewer state derived from
  // props so nothing has to be synchronised inside an effect.
  if (category !== session) {
    setSession(category);
    setStoryIndex(
      Math.max(
        0,
        stories.findIndex((item) => item.name === category),
      ),
    );
    setFrameIndex(0);
    setProgress(0);
    setPaused(false);
  }

  const story = category ? (stories[storyIndex] ?? null) : null;
  const frame = story?.items[frameIndex] ?? null;

  const next = useCallback(() => {
    if (!story) return;
    if (frameIndex < story.items.length - 1) {
      setFrameIndex((value) => value + 1);
      setProgress(0);
    } else if (storyIndex < stories.length - 1) {
      setStoryIndex((value) => value + 1);
      setFrameIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [story, frameIndex, storyIndex, stories.length, onClose]);

  const previous = useCallback(() => {
    if (frameIndex > 0) {
      setFrameIndex((value) => value - 1);
      setProgress(0);
    } else if (storyIndex > 0) {
      setStoryIndex((value) => value - 1);
      setFrameIndex(0);
      setProgress(0);
    }
  }, [frameIndex, storyIndex]);

  useEffect(() => {
    if (!story || paused) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          next();
          return 0;
        }
        return value + 2.5;
      });
    }, 110);
    return () => window.clearInterval(timer);
  }, [story, paused, next]);

  useEffect(() => {
    if (!story) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") next();
      else if (event.key === "ArrowRight") previous();
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story, next, previous, onClose]);

  if (!story || !frame) return null;

  const available = frame.colors.filter((color) => color.available !== false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`استوری ${story.name}`}
      className="fixed inset-0 z-[120] bg-[#141018]/92 backdrop-blur-md flex items-center justify-center p-2 md:p-6"
    >
      <div className="relative w-full max-w-[420px] h-[88vh] max-h-[760px] rounded-3xl overflow-hidden bg-[#211A29] shadow-e4 flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image}
          alt={frame.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />

        <div className="relative z-10 px-3 pt-3 flex gap-1.5" dir="rtl">
          {story.items.map((item, index) => (
            <div
              key={item.id}
              className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    index < frameIndex
                      ? "100%"
                      : index === frameIndex
                        ? `${progress}%`
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative z-10 px-4 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandProfile}
              alt="کیا"
              className="w-9 h-9 rounded-full border border-gold-400 object-contain bg-[#482780]"
            />
            <div>
              <p className="text-xs font-extrabold">{story.name}</p>
              <p className="text-[10px] text-white/75">
                مجموعهٔ {story.name} · {story.items.length} کالا
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label={paused ? "ادامه پخش" : "مکث"}
            >
              {paused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label="بستن استوری"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={previous}
            className="w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55"
            aria-label="فریم قبلی"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={next}
            className="w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55"
            aria-label="فریم بعدی"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="relative z-10 p-4 space-y-3 text-white">
          <div>
            <h3 className="font-extrabold text-base leading-snug">
              {frame.name}
            </h3>
            <p className="text-xs text-white/80 mt-0.5">{frame.subtitle}</p>
          </div>

          <div className="bg-white/95 text-[#211A2B] rounded-2xl p-3 flex items-center gap-3 shadow-e3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.image}
              alt={frame.name}
              className="w-14 h-14 rounded-xl object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold truncate">{frame.name}</p>
              <p className="text-sm font-black text-[#482780] mt-0.5">
                {formatPrice(frame.price)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenProduct(frame.id)}
                className="w-9 h-9 rounded-xl bg-[#F3EEFA] text-[#482780] flex items-center justify-center"
                title="مشاهده جزئیات"
                aria-label={`جزئیات ${frame.name}`}
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={available.length === 0}
                onClick={() => onAdd(frame)}
                className="px-3 py-2 rounded-xl bg-[#482780] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                خرید
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
