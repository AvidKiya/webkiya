import { useState } from 'react';
import { Bot, Send, Package, ShoppingBag, MessageCircle, ExternalLink } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cn } from '../../utils/cn';
import { formatPrice, formatJalaliDateTime } from '../../utils/format';

export function DirectInboxView() {
  const {
    directThreads,
    sendDirectMessage,
    triggerBotQuickAction,
    orders,
    products,
    setRoute,
    posts,
    setSelectedPostId,
  } = useStore();

  const [selectedThreadId, setSelectedThreadId] = useState(directThreads[0]?.id || 'th-bot');
  const [draft, setDraft] = useState('');

  const activeThread =
    directThreads.find((t) => t.id === selectedThreadId) || directThreads[0];

  // F06 Security Rule: Customer NEVER sees internal staff notes!
  const visibleMessages = activeThread
    ? activeThread.messages.filter((m) => !m.isInternalNote)
    : [];

  return (
    <div className="w-full max-w-[980px] mx-auto bg-surface rounded-3xl border border-border shadow-e1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
      {/* Threads List */}
      <div className="md:col-span-4 border-b md:border-b-0 md:border-l border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-brand-500" />
            <h1 className="font-extrabold text-sm text-ink-900">دایرکت و پشتیبانی کیا</h1>
          </div>
          <a
            href="https://t.me/kiyaco24bot"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold text-brand-500 flex items-center gap-1 hover:underline"
          >
            <bdi>@kiyaco24bot</bdi>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="divide-y divide-border overflow-y-auto">
          {directThreads.map((th) => {
            const lastPublicMsg = [...th.messages].reverse().find((m) => !m.isInternalNote);
            return (
              <button
                key={th.id}
                onClick={() => setSelectedThreadId(th.id)}
                className={cn(
                  'w-full p-3.5 text-right flex items-start gap-3 transition-colors',
                  th.id === activeThread?.id ? 'bg-brand-50/80' : 'hover:bg-canvas-sunken'
                )}
              >
                <div className="w-10 h-10 rounded-2xl bg-buy text-buy-fg flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-ink-900 truncate">
                      {th.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-sunken text-ink-600 shrink-0">
                      {th.tag}
                    </span>
                  </div>
                  {lastPublicMsg && (
                    <p className="text-[11px] text-ink-500 truncate mt-1">
                      {lastPublicMsg.text}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Conversation */}
      <div className="md:col-span-8 flex flex-col bg-canvas/60">
        {activeThread && (
          <>
            <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-sm text-ink-900">{activeThread.title}</h2>
                <p className="text-[11px] text-ink-500">
                  مسئول رسیدگی: {activeThread.assignedTo}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-success-light text-success">
                پاسخ‌گویی برخط
              </span>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[420px]">
              {visibleMessages.map((msg) => {
                const isCustomer = msg.sender === 'customer';
                const attachedOrder = msg.orderCodeAttachment
                  ? orders.find((o) => o.code === msg.orderCodeAttachment)
                  : undefined;
                const attachedProd = msg.productIdAttachment
                  ? products.find((p) => p.id === msg.productIdAttachment)
                  : undefined;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col max-w-[86%]',
                      isCustomer ? 'mr-auto items-end' : 'ml-auto items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'p-3.5 rounded-2xl text-xs leading-relaxed space-y-2.5 shadow-e1',
                        isCustomer
                          ? 'bg-buy text-buy-fg rounded-bl-sm'
                          : 'bg-surface border border-border text-ink-900 rounded-br-sm'
                      )}
                    >
                      <p className="text-[10px] font-extrabold opacity-75">{msg.senderName}</p>
                      <p>{msg.text}</p>

                      {/* Rich Attached Order Card */}
                      {attachedOrder && (
                        <div className="p-2.5 rounded-xl bg-canvas-sunken text-ink-900 border border-border flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-brand-500 shrink-0" />
                            <div>
                              <p className="font-mono font-bold text-xs">
                                <bdi>{attachedOrder.code}</bdi>
                              </p>
                              <p className="text-[10px] text-ink-500">
                                مبلغ: {formatPrice(attachedOrder.totalToman)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setRoute('account')}
                            className="px-2.5 py-1 rounded-lg bg-buy text-buy-fg text-[10px] font-bold"
                          >
                            مشاهده تایم‌لاین
                          </button>
                        </div>
                      )}

                      {/* Rich Attached Product Card */}
                      {attachedProd && (
                        <div className="p-2.5 rounded-xl bg-canvas-sunken text-ink-900 border border-border flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ShoppingBag className="w-4 h-4 text-brand-500 shrink-0" />
                            <span className="font-bold text-[11px] truncate">
                              {attachedProd.name}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const p = posts.find((po) => po.productId === attachedProd.id);
                              if (p) setSelectedPostId(p.id);
                            }}
                            className="px-2 py-1 rounded-lg bg-brand-50 text-brand-600 text-[10px] font-bold shrink-0"
                          >
                            مشاهده کالا
                          </button>
                        </div>
                      )}

                      {/* Telegram Inline Quick Actions */}
                      {msg.quickActions && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {msg.quickActions.map((qa) => (
                            <button
                              key={qa.action}
                              onClick={() => triggerBotQuickAction(qa.action)}
                              className="py-2 px-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-200 font-bold text-[11px] text-right transition-colors"
                            >
                              {qa.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-ink-400 mt-1 px-1">
                      {formatJalaliDateTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                sendDirectMessage(activeThread.id, draft, 'customer');
                setDraft('');
              }}
              className="p-3 bg-surface border-t border-border flex items-center gap-2"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="پیام، شماره سفارش یا استعلام همکاری خود را بنویسید..."
                className="flex-1 h-10 px-3.5 rounded-xl bg-canvas-sunken border border-border text-xs outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="px-4 h-10 rounded-xl bg-buy text-buy-fg text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-45"
              >
                <Send className="w-4 h-4 -scale-x-100" />
                <span>ارسال</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
