/**
 * Client-side chat service for Ask API thread management.
 *
 * Uses REST polling for thread updates instead of real-time subscriptions.
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{
    tool: string;
    input: unknown;
    result: unknown;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  created_at: string;
  updated_at: string;
};

export type ChatMonthlySpend = {
  total_usd: number;
  query_count: number;
};

/**
 * Fetch all threads (newest first).
 */
export async function fetchThreads(): Promise<ChatThread[]> {
  const res = await fetch("/api/chat/threads");
  if (!res.ok) throw new Error("Failed to fetch threads");
  const json = await res.json();
  return json.data || [];
}

/**
 * Create a new thread.
 */
export async function createThread(
  title: string,
  initialMessages: ChatMessage[] = []
): Promise<string> {
  const res = await fetch("/api/chat/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      messages: initialMessages,
    }),
  });
  if (!res.ok) throw new Error("Failed to create thread");
  const json = await res.json();
  return json.data.id;
}

/**
 * Update an existing thread.
 */
export async function saveThread(
  threadId: string,
  data: {
    title?: string;
    messages: ChatMessage[];
    costUsd: number;
    tokensInput: number;
    tokensOutput: number;
  }
): Promise<void> {
  const res = await fetch(`/api/chat/threads?id=${threadId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      messages: data.messages,
      costUsd: data.costUsd,
      tokensInput: data.tokensInput,
      tokensOutput: data.tokensOutput,
    }),
  });
  if (!res.ok) throw new Error("Failed to save thread");
}

/**
 * Delete a thread.
 */
export async function deleteThread(threadId: string): Promise<void> {
  const res = await fetch(`/api/chat/threads?id=${threadId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete thread");
}

/**
 * Fetch monthly spend for a given month (YYYY-MM).
 */
export async function fetchMonthlySpend(
  monthKey: string
): Promise<ChatMonthlySpend> {
  const res = await fetch(`/api/chat/spend/${monthKey}`);
  if (!res.ok) throw new Error("Failed to fetch spend");
  const json = await res.json();
  return json.data;
}

/**
 * Ask a question and get an answer with tool calls.
 */
export async function askAPI(
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{
  answer: string;
  toolCalls: Array<{ tool: string; input: unknown; result: unknown }>;
  usage: { input_tokens: number; output_tokens: number };
}> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.errors?.[0]?.message || "Failed to process question");
  }
  const json = await res.json();
  return json.data;
}

/**
 * Rough USD cost estimate from token usage (Haiku 5.5: $0.10/M input, $0.50/M output).
 */
export function estimateCostUsd(usage?: {
  input_tokens: number;
  output_tokens: number;
} | null): number {
  if (!usage) return 0;
  return (usage.input_tokens * 0.1 + usage.output_tokens * 0.5) / 1_000_000;
}
