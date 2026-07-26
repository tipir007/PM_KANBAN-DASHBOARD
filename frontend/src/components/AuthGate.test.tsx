import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/AuthGate";
import { initialData } from "@/lib/kanban";

const readPath = (input: RequestInfo | URL) =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const mockBackend = (options: { loginOk?: boolean } = {}) => {
  const { loginOk = true } = options;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    const path = readPath(input);

    if (path.includes("/api/auth/login")) {
      return loginOk
        ? jsonResponse({ token: "tok-123", username: "alice" })
        : jsonResponse({ detail: "invalid username or password" }, 401);
    }
    if (path.includes("/api/auth/register")) {
      return jsonResponse({ token: "tok-123", username: "alice" }, 201);
    }
    if (path.includes("/api/auth/logout")) {
      return new Response(null, { status: 204 });
    }
    if (path.endsWith("/api/boards") && method === "GET") {
      return jsonResponse({ boards: [{ id: "board-1", name: "My Board", position: 0 }] });
    }
    if (path.includes("/api/boards/board-1")) {
      return jsonResponse({ id: "board-1", name: "My Board", board: initialData });
    }
    return jsonResponse({ id: "board-1", name: "My Board", board: initialData });
  });
};

const signIn = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("AuthGate", () => {
  it("shows a backend error for invalid credentials", async () => {
    mockBackend({ loginOk: false });
    render(<AuthGate />);

    await signIn("alice", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid username or password/i);
  });

  it("renders the board after a successful login and returns to login on logout", async () => {
    mockBackend();
    render(<AuthGate />);

    await signIn("alice", "correct-pass");

    expect(await screen.findByLabelText("Board name")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("can switch to the register form", async () => {
    mockBackend();
    render(<AuthGate />);

    await userEvent.click(screen.getByRole("button", { name: /^register$/i }));
    expect(
      screen.getByRole("heading", { name: /create account/i })
    ).toBeInTheDocument();
  });
});
