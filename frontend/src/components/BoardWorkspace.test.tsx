import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardWorkspace } from "@/components/BoardWorkspace";
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

type BoardRow = { id: string; name: string; position: number };

let boardRows: BoardRow[];

const openBoardsMenu = () =>
  userEvent.click(screen.getByRole("button", { name: /boards menu/i }));

beforeEach(() => {
  window.localStorage.setItem("pm-token", "tok-123");
  window.localStorage.setItem("pm-username", "alice");
  boardRows = [{ id: "board-1", name: "My Board", position: 0 }];

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    const path = readPath(input);

    if (path.endsWith("/api/boards") && method === "GET") {
      return jsonResponse({ boards: boardRows });
    }
    if (path.endsWith("/api/boards") && method === "POST") {
      const { name } = JSON.parse(String(init?.body));
      const created = { id: `board-${boardRows.length + 1}`, name, position: boardRows.length };
      boardRows.push(created);
      return jsonResponse(created, 201);
    }
    if (path.includes("/api/boards/") && method === "DELETE") {
      const id = path.split("/api/boards/")[1];
      boardRows = boardRows.filter((row) => row.id !== id);
      return new Response(null, { status: 204 });
    }
    if (path.includes("/api/boards/") && method === "GET") {
      const id = path.split("/api/boards/")[1];
      const row = boardRows.find((r) => r.id === id) ?? boardRows[0];
      return jsonResponse({ id: row.id, name: row.name, board: initialData });
    }
    return jsonResponse({ boards: boardRows });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("BoardWorkspace", () => {
  it("lists the user's boards in the boards menu", async () => {
    render(<BoardWorkspace username="alice" onLogout={vi.fn()} />);
    await screen.findByRole("button", { name: /boards menu/i });

    await openBoardsMenu();
    expect(
      await screen.findByRole("menuitemradio", { name: "My Board" })
    ).toBeInTheDocument();
  });

  it("creates a new board from the menu", async () => {
    render(<BoardWorkspace username="alice" onLogout={vi.fn()} />);
    await screen.findByRole("button", { name: /boards menu/i });

    await openBoardsMenu();
    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    await userEvent.type(screen.getByLabelText(/new board name/i), "Roadmap");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(
      await screen.findByRole("menuitemradio", { name: "Roadmap" })
    ).toBeInTheDocument();
  });

  it("deletes a board from the menu when more than one exists", async () => {
    boardRows = [
      { id: "board-1", name: "My Board", position: 0 },
      { id: "board-2", name: "Second", position: 1 },
    ];
    render(<BoardWorkspace username="alice" onLogout={vi.fn()} />);
    await screen.findByRole("button", { name: /boards menu/i });

    await openBoardsMenu();
    await userEvent.click(screen.getByRole("button", { name: /delete my board/i }));

    await waitFor(() =>
      expect(
        screen.queryByRole("menuitemradio", { name: "My Board" })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole("menuitemradio", { name: "Second" })).toBeInTheDocument();
  });

  it("logs out from the user menu", async () => {
    const onLogout = vi.fn();
    render(<BoardWorkspace username="alice" onLogout={onLogout} />);
    await screen.findByRole("button", { name: /user menu/i });

    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /logout/i }));

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });
});
