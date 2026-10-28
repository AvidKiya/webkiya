import { useEffect, useState, useCallback } from 'react';
import { X, Pause, Play, ChevronLeft, ChevronRight, ShoppingBag, Eye } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../utils/format';
import { brandProfile } from '../shared/Logo';

export function StoryViewerModal() {
  const {
    stories,
    activeStoryId,
    setActiveStoryId,
    markStorySeen,
    products,
    posts,
    setSelectedPostId,
    addToRetailCart,
  } = useStore();

  const storyIndex = stories.findIndex((s) => s.id === activeStoryId);
  const story = storyIndex >= 0 ? stories[storyIndex] : null;

  const [frameIdx, setFrameIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setFrameIdx(0);
    setProgress(0);
    if (story) {
      markStorySeen(story.id);
    }
  }, [activeStoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    if (!story) return;
    if (frameIdx < story.frames.length - 1) {
      setFrameIdx((f) => f + 1);
      setProgress(0);
    } else if (storyIndex < stories.length - 1) {
      setActiveStoryId(stories[storyIndex + 1].id);
    } else {
      setActiveStoryId(null);
    }
  }, [story, frameIdx, storyIndex, stories, setActiveStoryId]);

  const goPrev = useCallback(() => {
    if (!story) return;
    if (frameIdx > 0) {
      setFrameIdx((f) => f - 1);
      setProgress(0);
    } else if (storyIndex > 0) {
      setActiveStoryId(stories[storyIndex - 1].id);
    }
  }, [story, frameIdx, storyIndex, stories, setActiveStoryId]);

  useEffect(() => {
    if (!story || paused) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goNext();
          return 0;
        }
        return prev + 2.5;
      });
    }, 110);
    return () => clearInterval(interval);
  }, [story, paused, goNext]);

  useEffect(() => {
    if (!story) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveStoryId(null);
      if (e.key === 'ArrowLeft') goNext(); // RTL next
      if (e.key === 'ArrowRight') goPrev(); // RTL prev
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [story, goNext, goPrev, setActiveStoryId]);

  if (!story) return null;

  const frame = story.frames[frameIdx] || story.frames[0];
  const linkedProduct = products.find((p) => p.id === frame.productId);
  const linkedPost = posts.find((po) => po.productId === frame.productId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`استوری ${story.title}`}
      className="fixed inset-0 z-[120] bg-[#141018]/92 backdrop-blur-md flex items-center justify-center p-2 md:p-6"
    >
      <div className="relative w-full max-w-[420px] h-[88vh] max-h-[760px] rounded-3xl overflow-hidden bg-[#211A29] shadow-e4 flex flex-col">
        {/* Background Media */}
        <img
          src={frame.image}
          alt={frame.headline}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />

        {/* Segmented Progress Bars */}
        <div className="relative z-10 px-3 pt-3 flex gap-1.5" dir="rtl">
          {story.frames.map((f, idx) => (
            <div key={f.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: idx < frameIdx ? '100%' : idx === frameIdx ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Top Header */}
        <div className="relative z-10 px-4 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <img
              src={brandProfile}
              alt="کیا"
              className="w-9 h-9 rounded-full border border-gold-400 object-contain bg-[#482780]"
            />
            <div>
              <p className="text-xs font-extrabold">{story.title}</p>
              <p className="text-[10px] text-white/75">{story.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPaused((p) => !p)}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label={paused ? 'ادامه پخش' : 'مکث'}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setActiveStoryId(null)}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label="بستن استوری"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Side Navigation Controls */}
        <div className="relative z-10 flex-1 flex items-center justify-between px-2">
          <button
            onClick={goPrev}
            className="w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55"
            aria-label="فریم قبلی"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            className="w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55"
            aria-label="فریم بعدی"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Caption & Shoppable Product Card (Strictly Retail Price Only - WH01!) */}
        <div className="relative z-10 p-4 space-y-3 text-white">
          <div>
            <h3 className="font-extrabold text-base leading-snug">{frame.headline}</h3>
            <p className="text-xs text-white/80 mt-0.5">{frame.subtext}</p>
          </div>

          {linkedProduct && (
            <div className="bg-white/95 text-[#211A2B] rounded-2xl p-3 flex items-center gap-3 shadow-e3">
              <img
                src={linkedProduct.images[0]}
                alt={linkedProduct.name}
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold truncate">{linkedProduct.name}</p>
                <p className="text-sm font-black text-[#482780] mt-0.5">
                  {formatPrice(linkedProduct.price)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {linkedPost && (
                  <button
                    onClick={() => {
                      setActiveStoryId(null);
                      setSelectedPostId(linkedPost.id);
                    }}
                    className="w-9 h-9 rounded-xl bg-[#F3EEFA] text-[#482780] flex items-center justify-center"
                    title="مشاهده جزئیات"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() =>
                    addToRetailCart(
                      linkedProduct.id,
                      linkedProduct.colors[0],
                      linkedProduct.sizes[0],
                      1
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-[#482780] text-white text-xs font-bold flex items-center gap-1"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  خرید
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
