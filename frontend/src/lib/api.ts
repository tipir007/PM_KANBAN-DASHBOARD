import type { BoardData } from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIChatRequest = {
  boardId?: string;
  username?: string;
  question: string;
  conversation: ChatMessage[];
};

export type AIChatResponse = {
  response: string;
  board_update: BoardData | null;
};

export type AuthResult = {
  token: string;
  username: string;
};

export type BoardSummary = {
  id: string;
  name: string;
  position: number;
};

export type BoardContent = {
  id: string;
  name: string;
  board: BoardData;
};

const TOKEN_KEY = "pm-token";
const USERNAME_KEY = "pm-username";

// --- token storage -------------------------------------------------------

export const getToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
};

export const getStoredUsername = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(USERNAME_KEY);
};

const storeSession = (result: AuthResult) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, result.token);
  window.localStorage.setItem(USERNAME_KEY, result.username);
};

export const clearSession = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USERNAME_KEY);
};

// --- helpers -------------------------------------------------------------

const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

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

// --- auth ----------------------------------------------------------------

const authenticate = async (
  path: string,
  username: string,
  password: string
): Promise<AuthResult> => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const result = (await response.json()) as AuthResult;
  storeSession(result);
  return result;
};

export const register = (username: string, password: string): Promise<AuthResult> =>
  authenticate("/api/auth/register", username, password);

export const login = (username: string, password: string): Promise<AuthResult> =>
  authenticate("/api/auth/login", username, password);

export const logout = async (): Promise<void> => {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    });
  } finally {
    clearSession();
  }
};

// --- boards --------------------------------------------------------------

export const fetchBoards = async (): Promise<BoardSummary[]> => {
  const response = await fetch("/api/boards", { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const payload = (await response.json()) as { boards: BoardSummary[] };
  return payload.boards;
};

export const createBoard = async (name: string): Promise<BoardSummary> => {
  const response = await fetch("/api/boards", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as BoardSummary;
};

export const renameBoard = async (
  boardId: string,
  name: string
): Promise<BoardSummary> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as BoardSummary;
};

export const deleteBoard = async (boardId: string): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
};

export const fetchBoardById = async (boardId: string): Promise<BoardContent> => {
  const response = await fetch(`/api/boards/${boardId}`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as BoardContent;
};

export const updateBoardById = async (
  boardId: string,
  board: BoardData
): Promise<BoardContent> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as BoardContent;
};

// --- ai ------------------------------------------------------------------

export const chatWithAI = async (
  payload: AIChatRequest
): Promise<AIChatResponse> => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      username: payload.username ?? getStoredUsername() ?? "user",
      board_id: payload.boardId,
      question: payload.question,
      conversation: payload.conversation,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as AIChatResponse;
};
