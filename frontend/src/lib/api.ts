import type { BoardData } from "@/lib/kanban";

type BoardResponse = {
  username: string;
  board: BoardData;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIChatRequest = {
  username: string;
  question: string;
  conversation: ChatMessage[];
};

export type AIChatResponse = {
  response: string;
  board_update: BoardData | null;
};

const buildUrl = (username: string) =>
  `/api/board?${new URLSearchParams({ username }).toString()}`;

const readError = async (response: Response) => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") {
      return payload.detail;
    }
  } catch {
    // Keep fallback message if response is not JSON.
  }
  return `Request failed with status ${response.status}`;
};

export const fetchBoard = async (username = "user"): Promise<BoardData> => {
  const response = await fetch(buildUrl(username));
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const payload = (await response.json()) as BoardResponse;
  return payload.board;
};

export const updateBoard = async (
  board: BoardData,
  username = "user"
): Promise<void> => {
  const response = await fetch(buildUrl(username), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
};

export const chatWithAI = async (
  payload: AIChatRequest
): Promise<AIChatResponse> => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as AIChatResponse;
};
