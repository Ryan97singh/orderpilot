"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, newRequestId } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth/auth-context";
import type { ChatMessage, ChatResponse, SalesOrder } from "@/lib/types";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Full agent response for assistant turns (quote, pending action, citations, steps). */
  response?: Omit<ChatResponse, "reply">;
  /** Set on the assistant turn that reports a placed order. */
  order?: SalesOrder;
  /** Set when the request for this turn failed; the UI offers a retry. */
  error?: boolean;
  /** For quote turns: has the rep confirmed it? */
  confirmed?: boolean;
}

interface ChatState {
  sessionId: string;
  messages: UiMessage[];
}

/** Scoped per user so switching demo roles in one tab doesn't show another user's chat. */
const storageKey = (userId: string) => `orderpilot.chat.${userId}`;

function freshState(): ChatState {
  return { sessionId: newRequestId(), messages: [] };
}

/** The chat survives reloads within the tab (sessionStorage), like the auth session. */
function loadState(key: string): ChatState {
  if (typeof window === "undefined") return freshState();
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ChatState) : freshState();
  } catch {
    return freshState();
  }
}

/** Only plain text goes back to the agent; cards are UI for the rep. */
function toHistory(messages: UiMessage[]): ChatMessage[] {
  return messages.filter((m) => !m.error && m.content).map(({ role, content }) => ({ role, content }));
}

export function useChat() {
  const { user } = useAuth();
  const key = storageKey(user?.id ?? "anonymous");
  const [state, setState] = useState<ChatState>(() => loadState(key));
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore: persistence is a convenience
    }
  }, [key, state]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const append = useCallback((message: UiMessage) => {
    setState((s) => ({ ...s, messages: [...s.messages, message] }));
  }, []);

  const send = useCallback(
    async (text: string, outletId: number | null, base: UiMessage[] = state.messages) => {
      const content = text.trim();
      if (!content || sending) return;
      const history = base.filter((m) => !m.error);
      const userMessage: UiMessage = { id: newRequestId(), role: "user", content };
      setState((s) => ({ ...s, messages: [...history, userMessage] }));
      setSending(true);

      abortRef.current = new AbortController();
      try {
        const { reply, ...rest } = await api.ai.chat(
          { session_id: state.sessionId, messages: toHistory([...history, userMessage]), outlet_id: outletId },
          abortRef.current.signal,
        );
        append({ id: newRequestId(), role: "assistant", content: reply, response: rest, order: rest.order ?? undefined });
      } catch (error) {
        if (abortRef.current?.signal.aborted) return;
        append({ id: newRequestId(), role: "assistant", content: errorMessage(error), error: true });
      } finally {
        setSending(false);
      }
    },
    [append, sending, state.messages, state.sessionId],
  );

  const confirm = useCallback(
    async (messageId: string) => {
      const message = state.messages.find((m) => m.id === messageId);
      const pendingAction = message?.response?.pending_action;
      if (!pendingAction) return;
      setConfirmingId(messageId);
      try {
        const { reply, order } = await api.ai.confirm({ session_id: state.sessionId, pending_action: pendingAction });
        setState((s) => ({
          ...s,
          messages: [
            ...s.messages.map((m) => (m.id === messageId ? { ...m, confirmed: true } : m)),
            { id: newRequestId(), role: "assistant", content: reply, order },
          ],
        }));
        // New order: refresh lists, dashboard and stock.
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["products"] });
      } catch (error) {
        append({ id: newRequestId(), role: "assistant", content: `Couldn't place the order: ${errorMessage(error)}`, error: true });
      } finally {
        setConfirmingId(null);
      }
    },
    [append, queryClient, state.messages, state.sessionId],
  );

  /** Re-sends the last user message after a failed turn. */
  const retry = useCallback(
    (outletId: number | null) => {
      const lastUserIndex = state.messages.findLastIndex((m) => m.role === "user");
      if (lastUserIndex < 0) return;
      const text = state.messages[lastUserIndex].content;
      setState((s) => ({ ...s, messages: s.messages.slice(0, lastUserIndex) }));
      void send(text, outletId, state.messages.slice(0, lastUserIndex));
    },
    [send, state.messages],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSending(false);
    setState(freshState());
  }, []);

  return { messages: state.messages, sending, confirmingId, send, confirm, retry, reset };
}
