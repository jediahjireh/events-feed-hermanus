"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type ChatThread,
  type ChatMessage,
  type ChatMonthlySpend,
  fetchThreads,
  createThread,
  saveThread,
  deleteThread,
  fetchMonthlySpend,
  askAPI,
  estimateCostUsd,
} from "@/lib/chat-service";
import { cn } from "@/lib/utils";

const ZERO_TOKENS = { input: 0, output: 0 };

// Preset prompts from reviewer guide + custom queries
const STARTER_PROMPTS: string[] = [
  "What's on September 14-21 for a luxury couple?",
  "Show me whale watching events",
  "What events have confidence below 0.6?",
  "What's the data freshness? When was each source last ingested?",
  "Show me all seasonal events (whale watching, etc.)",
  "What's available for families with kids in December?",
];

/**
 * Extract follow-up suggestions from an AI response.
 * Looks for a "Dig deeper:" section followed by bullet items.
 */
function extractFollowUps(content: string): string[] {
  const pattern = /\*\*Dig deeper:\*\*\s*\n((?:\s*[-*]\s+.+\n?)+)/i;
  const match = content.match(pattern);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter((line) => line.length > 0 && line.endsWith("?"));
}

const formatCost = (usd: number) =>
  usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;

export default function AskAPIChat() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [costUsd, setCostUsd] = useState(0);
  const [tokens, setTokens] = useState(ZERO_TOKENS);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [spend, setSpend] = useState<ChatMonthlySpend>({
    total_usd: 0,
    query_count: 0,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Poll threads every 5 seconds (since we don't have real-time subscriptions)
  useEffect(() => {
    let ready = false;
    const load = async () => {
      try {
        const data = await fetchThreads();
        setThreads(data);
        ready = true;
      } catch {
        // Silently retry on initial load (expected during server startup)
        if (ready) console.warn("[ask-api] fetch threads failed");
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll monthly spend
  useEffect(() => {
    let ready = false;
    const load = async () => {
      try {
        const data = await fetchMonthlySpend(monthKey);
        setSpend(data);
        ready = true;
      } catch {
        if (ready) console.warn("[ask-api] fetch spend failed");
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [monthKey]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const openThread = useCallback((t: ChatThread) => {
    setActiveId(t.id);
    setMessages(t.messages);
    setCostUsd(t.cost_usd);
    setTokens({ input: t.tokens_input, output: t.tokens_output });
    setInput("");
    setError(null);
    setMobileChatOpen(true);
  }, []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setCostUsd(0);
    setTokens(ZERO_TOKENS);
    setInput("");
    setError(null);
    setMobileChatOpen(true);
  }, []);

  const removeThread = useCallback(
    async (e: React.MouseEvent, t: ChatThread) => {
      e.stopPropagation();
      try {
        await deleteThread(t.id);
        if (t.id === activeId) newChat();
        // Refresh threads list
        const data = await fetchThreads();
        setThreads(data);
      } catch (err) {
        console.error("[ask-api] delete thread failed:", err);
      }
    },
    [activeId, newChat]
  );

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;

      setError(null);
      const priorHistory: Array<{ role: "user" | "assistant"; content: string }> =
        messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      const userMsg: ChatMessage = {
        role: "user",
        content: q,
      };
      const withUser: ChatMessage[] = [...messages, userMsg];
      setMessages(withUser);
      setInput("");

      const wasNew = !activeId;
      const baseCost = wasNew ? 0 : costUsd;
      const baseTokens = wasNew ? ZERO_TOKENS : tokens;

      let reqThreadId = activeId;
      try {
        if (wasNew) {
          reqThreadId = await createThread(q, withUser);
          if (activeIdRef.current === null) setActiveId(reqThreadId);
        }
      } catch (err) {
        if (activeIdRef.current === reqThreadId) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      const tid = reqThreadId as string;
      setLoading(true);

      try {
        const res = await askAPI(q, priorHistory);
        const assistant: ChatMessage = {
          role: "assistant",
          content: res.answer || "(no answer)",
          ...(res.toolCalls?.length ? { tool_calls: res.toolCalls } : {}),
          ...(res.usage ? { usage: res.usage } : {}),
        };
        const full = [...withUser, assistant];
        const nextCost = baseCost + estimateCostUsd(res.usage);
        const nextTokens = {
          input: baseTokens.input + (res.usage?.input_tokens || 0),
          output: baseTokens.output + (res.usage?.output_tokens || 0),
        };

        await saveThread(tid, {
          title: wasNew ? q : undefined,
          messages: full,
          costUsd: nextCost,
          tokensInput: nextTokens.input,
          tokensOutput: nextTokens.output,
        });

        if (activeIdRef.current === tid) {
          setMessages(full);
          setCostUsd(nextCost);
          setTokens(nextTokens);
        }

        // Refresh threads list
        const data = await fetchThreads();
        setThreads(data);
      } catch (err) {
        if (activeIdRef.current === tid) {
          setError(err instanceof Error ? err.message : String(err));
        } else {
          console.error("[ask-api] background query failed:", err);
        }
      } finally {
        setLoading(false);
      }
    },
    [messages, activeId, costUsd, tokens, loading]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed) void send(trimmed);
    }
  };

  // Markdown component overrides
  const md: Components = useMemo(
    () => ({
      p: ({ children }) => <p className="mb-2">{children}</p>,
      ul: ({ children }) => (
        <ul className="mb-2 list-disc pl-5">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="mb-2 list-decimal pl-5">{children}</ol>
      ),
      li: ({ children }) => <li className="my-0.5">{children}</li>,
      h1: ({ children }) => (
        <h1 className="mb-2 mt-3 text-lg font-bold">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="mb-1.5 mt-3 text-base font-bold">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mb-1 mt-2.5 text-sm font-bold">{children}</h3>
      ),
      strong: ({ children }) => (
        <strong className="font-bold">{children}</strong>
      ),
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          {children}
        </a>
      ),
      code: ({ children }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {children}
        </code>
      ),
      pre: ({ children }) => (
        <pre className="mb-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {children}
        </pre>
      ),
      blockquote: ({ children }) => (
        <blockquote className="mb-2 border-l-3 border-muted-foreground/30 pl-3 text-muted-foreground">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-3 border-border" />,
      table: ({ children }) => (
        <div className="mb-2.5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {children}
          </table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border border-border bg-muted px-2.5 py-1.5 text-left font-semibold">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-border px-2.5 py-1.5">{children}</td>
      ),
    }),
    []
  );

  const historyChars = messages.reduce((a, m) => a + m.content.length, 0);
  const longConversation = messages.length >= 12 || historyChars > 24000;
  const activeTitle = threads.find((t) => t.id === activeId)?.title;
  const empty = messages.length === 0 && !loading;
  const monthLabel = new Date(`${monthKey}-01T00:00:00Z`).toLocaleString(
    "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" }
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Thread sidebar */}
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden border-r bg-background md:w-60 md:shrink-0",
          mobileChatOpen ? "hidden md:flex" : "flex"
        )}
      >
        {/* Monthly spend */}
        <div className="px-3 pt-3">
          <div className="rounded-lg border bg-muted/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Ask API spend · {monthLabel}
            </div>
            <div className="text-base font-semibold leading-tight">
              ~{formatCost(spend.total_usd)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {spend.query_count}{" "}
              {spend.query_count === 1 ? "query" : "queries"} this month
            </div>
          </div>
        </div>

        <div className="p-3">
          <Button
            onClick={newChat}
            variant="outline"
            className="w-full gap-2"
            size="sm"
          >
            <Plus size={16} /> New chat
          </Button>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {threads.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No conversations yet.
            </p>
          )}
          {threads.map((t) => (
            <div
              key={t.id}
              onClick={() => openThread(t)}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                t.id === activeId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              )}
            >
              <MessageSquare
                size={14}
                className="shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] leading-tight">
                  {t.title}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {new Date(t.updated_at).getTime()
                    ? formatDistanceToNow(new Date(t.updated_at), {
                        addSuffix: true,
                      })
                    : ""}
                  {t.cost_usd > 0 ? ` · ~${formatCost(t.cost_usd)}` : ""}
                </div>
              </div>
              <span
                onClick={(e) => removeThread(e, t)}
                className="shrink-0 cursor-pointer rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete conversation"
              >
                <Trash2 size={13} className="text-muted-foreground" />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat column */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden",
          mobileChatOpen ? "" : "hidden md:flex"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-3 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileChatOpen(false)}
              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted-foreground md:hidden"
              title="Back to conversations"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles size={17} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight">
                {activeTitle || "Ask API"}
              </h1>
              <p className="text-[11.5px] text-muted-foreground">
                Conversational agent · queries events API via function calling
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <div
              className="shrink-0 text-right text-[11px] text-muted-foreground"
              title={`${tokens.input} input + ${tokens.output} output tokens`}
            >
              this chat ~{formatCost(costUsd)} · {messages.length} msgs
            </div>
          )}
        </div>

        {/* Long-conversation warning */}
        {longConversation && (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 md:mx-6">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              This conversation is getting long — each question re-sends the
              whole history, increasing cost.{" "}
              <button
                onClick={newChat}
                className="cursor-pointer font-medium underline"
              >
                Start a new chat
              </button>{" "}
              to keep it cheap.
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-6 md:px-6">
          <div className="mx-auto max-w-[820px]">
            {empty && (
              <div className="mt-8 flex flex-col items-center text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles size={24} className="text-primary" />
                </div>
                <h2 className="mb-1 text-lg font-semibold">
                  Ask anything about Hermanus events
                </h2>
                <p className="mb-5 text-sm text-muted-foreground">
                  Claude queries the events API with function calling —
                  query_events, get_event_detail, get_health. Try the prompts
                  below or ask your own question.
                </p>

                {/* Starter prompt pills */}
                <div className="grid w-full max-w-[640px] grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="group/chip flex cursor-pointer items-start gap-2 rounded-xl border bg-card px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted"
                    >
                      <span className="flex-1">{s}</span>
                      <ArrowRight
                        size={14}
                        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/chip:opacity-100"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="mb-4 flex flex-col items-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13.5px] text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="mb-5 flex flex-col items-start">
                  <div className="w-full max-w-full">
                    <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-[13.5px] leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={md}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                    {m.tool_calls && m.tool_calls.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                        <Search size={12} />
                        <span>
                          ran {m.tool_calls.length}{" "}
                          {m.tool_calls.length === 1 ? "query" : "queries"}:{" "}
                          {Array.from(
                            new Set(m.tool_calls.map((t) => t.tool))
                          ).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clickable follow-up suggestions from AI response */}
                  {!loading &&
                    i === messages.length - 1 &&
                    (() => {
                      const followUps = extractFollowUps(m.content);
                      if (followUps.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                          {followUps.map((fu) => (
                            <button
                              key={fu}
                              onClick={() => void send(fu)}
                              className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ArrowRight size={11} className="shrink-0" />
                              <span className="line-clamp-1">{fu}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                </div>
              )
            )}

            {loading && (
              <div className="mb-5 flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-4 py-3">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Querying the API&hellip;
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t bg-background px-3 py-3 md:px-6 md:py-4">
          <div className="mx-auto max-w-[820px]">
            <div className="flex items-end gap-2 rounded-2xl border bg-card px-3 py-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about events…"
                rows={1}
                disabled={loading}
                className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[13.5px] outline-none md:text-sm"
              />
              <Button
                onClick={() => {
                  const trimmed = input.trim();
                  if (trimmed) void send(trimmed);
                }}
                disabled={loading || !input.trim()}
                size="icon"
                title="Send"
              >
                <Send size={16} />
              </Button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
