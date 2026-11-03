"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Bot, MessageSquarePlus, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AgentSteps } from "@/components/chat/agent-steps";
import { Citations } from "@/components/chat/citations";
import { OrderPlacedCard } from "@/components/chat/order-placed-card";
import { QuoteCard, type QuoteCardState } from "@/components/chat/quote-card";
import { useChat, type UiMessage } from "@/components/chat/use-chat";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import type { Quote } from "@/lib/types";

const QUOTE_INTRO = "Here's your quote. Check the lines below, then **Confirm**, or tell me what to change.";

const SUGGESTIONS = [
  "Order 20 cases of FizzUp Cola 330ml for Al Noor Grocery",
  "What is the credit approval policy?",
  "Any promotions on Oasis Juice this week?",
  "Order 15 cases of Oasis Orange Juice 1L and 30 cases of Pure Peak Water 500ml for Marina Bay Café",
];

/** Turns a quote back into an editable instruction for the composer. */
function quoteToPrompt(quote: Quote) {
  const lines = quote.lines.map((l) => `${l.qtyCases} cases of ${l.productName}`).join(" and ");
  return `Order ${lines} for ${quote.outlet.name}`;
}

function TypingIndicator() {
  return (
    <div role="status" className="flex items-center gap-3">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
        <Bot aria-hidden className="size-4" />
      </span>
      <span className="flex gap-1" aria-hidden>
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </span>
      <span className="sr-only">OrderPilot is thinking…</span>
    </div>
  );
}

function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  const { user } = useAuth();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center sm:py-16">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
        <Sparkles aria-hidden className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        Hi {user?.name.split(" ")[0]}, what would you like to order?
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Type it the way you&apos;d text it. I&apos;ll check stock, credit and promotions and show you a quote to confirm.
      </p>
      <ul className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.slice(0, 3).map((s, i) => (
          <li key={s} className={cn(i === 0 && "sm:col-span-2")}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="h-full w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageView({
  message,
  quoteState,
  onConfirm,
  onEdit,
  onRetry,
}: {
  message: UiMessage;
  quoteState: QuoteCardState;
  onConfirm: () => void;
  onEdit: (quote: Quote) => void;
  onRetry: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  const r = message.response;
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text"
      >
        <Bot className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="sr-only">OrderPilot:</span>
        {message.error ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <span className="text-foreground/85">{message.content}</span>
            <Button size="sm" variant="secondary" onClick={onRetry}>
              <RotateCw aria-hidden className="size-3.5" /> Retry
            </Button>
          </div>
        ) : (
          // The quote card already shows the lines and totals, so skip the markdown table the API returns for plain clients.
          <Markdown>{r?.quote ? QUOTE_INTRO : message.content}</Markdown>
        )}
        {r?.quote && (
          <QuoteCard
            quote={r.quote}
            canConfirm={Boolean(r.pending_action)}
            state={quoteState}
            onConfirm={onConfirm}
            onEdit={() => onEdit(r.quote!)}
          />
        )}
        {message.order && <OrderPlacedCard order={message.order} />}
        {r?.citations && <Citations citations={r.citations} />}
        {r?.steps && <AgentSteps steps={r.steps} />}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { messages, sending, confirmingId, send, confirm, retry, reset } = useChat();
  const [draft, setDraft] = useState("");
  const [outletId, setOutletId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const outlets = useQuery({
    queryKey: queryKeys.outlets,
    queryFn: ({ signal }) => api.outlets.search(undefined, signal),
    staleTime: 5 * 60_000,
  });

  // Keep the newest message in view (the composer is sticky at the bottom of the page).
  useEffect(() => {
    if (messages.length || sending) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  // Auto-grow the composer up to a max height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const latestQuoteId = [...messages].reverse().find((m) => m.response?.quote)?.id;

  function submit(text: string) {
    if (!text.trim()) return;
    setDraft("");
    void send(text, outletId);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(draft);
    }
  }

  function editQuote(quote: Quote) {
    setDraft(quoteToPrompt(quote));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function quoteState(m: UiMessage): QuoteCardState {
    if (m.confirmed) return "confirmed";
    if (confirmingId === m.id) return "confirming";
    return m.id === latestQuoteId ? "actionable" : "inactive";
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem-5rem)] max-w-3xl flex-col px-4 lg:min-h-dvh lg:px-6">
      <div className="sticky top-14 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:top-0 lg:-mx-6 lg:px-6">
        <h1 className="text-sm font-semibold">Agent chat</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="outlet-context" className="sr-only">
            Outlet context
          </label>
          <Select
            id="outlet-context"
            value={outletId ?? ""}
            onChange={(e) => setOutletId(e.target.value ? Number(e.target.value) : null)}
            className="h-8 max-w-[11rem] text-xs sm:max-w-[14rem]"
          >
            <option value="">Any outlet (detect from message)</option>
            {outlets.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={reset} disabled={!messages.length && !sending} aria-label="New chat">
            <MessageSquarePlus aria-hidden className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 py-5">
        {messages.length === 0 && !sending ? (
          <EmptyChat onPick={submit} />
        ) : (
          <div role="log" aria-live="polite" aria-label="Conversation" className="flex flex-col gap-5">
            {messages.map((m) => (
              <MessageView
                key={m.id}
                message={m}
                quoteState={quoteState(m)}
                onConfirm={() => void confirm(m.id)}
                onEdit={editQuote}
                onRetry={() => retry(outletId)}
              />
            ))}
            {sending && <TypingIndicator />}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-16 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:-mx-6 lg:px-6"
      >
        {messages.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {SUGGESTIONS.slice(1).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                disabled={sending}
                className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
              >
                {s.length > 48 ? `${s.slice(0, 46)}…` : s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-surface p-1.5 pl-3 shadow-xs focus-within:border-ring">
          <label htmlFor="chat-input" className="sr-only">
            Message OrderPilot
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. Order 20 cases of FizzUp Cola for Al Noor Grocery"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <Button type="submit" size="icon" className="rounded-xl" disabled={!draft.trim()} loading={sending} aria-label="Send">
            {!sending && <ArrowUp aria-hidden className="size-4" />}
          </Button>
        </div>
        <p className="mt-1.5 hidden text-center text-xs text-muted sm:block">
          Enter to send · Shift+Enter for a new line · Orders are only placed after you confirm
        </p>
      </form>
    </div>
  );
}
