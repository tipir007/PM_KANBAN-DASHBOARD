import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];
const readPath = (input: RequestInfo | URL) =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

const renderBoard = () =>
  render(<KanbanBoard boardId="board-1" boardName="My Board" username="user" />);

const boardContent = (board = initialData) =>
  new Response(JSON.stringify({ id: "board-1", name: "My Board", board }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    const path = readPath(input);
    if (method === "POST" && path.includes("/api/ai/chat")) {
      return new Response(
        JSON.stringify({ response: "AI reply", board_update: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (method === "PUT") {
      const board = JSON.parse(String(init?.body));
      return boardContent(board);
    }

    return boardContent();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("KanbanBoard", () => {
  it("renders five columns", async () => {
    renderBoard();
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    renderBoard();
    await screen.findByLabelText("Board name");
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("only saves a column rename once, on blur, not per keystroke", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderBoard();
    await screen.findByLabelText("Board name");
    fetchMock.mockClear();

    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PUT" })
    );

    await userEvent.tab();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PUT" })
    );
    const putCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT"
    );
    expect(putCalls).toHaveLength(1);
  });

  it("adds and removes a card", async () => {
    renderBoard();
    await screen.findByLabelText("Board name");
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("renames the board on blur", async () => {
    const onRenameBoard = vi.fn();
    render(
      <KanbanBoard
        boardId="board-1"
        boardName="My Board"
        username="user"
        onRenameBoard={onRenameBoard}
      />
    );
    const nameInput = await screen.findByLabelText("Board name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Roadmap");
    await userEvent.tab();
    expect(onRenameBoard).toHaveBeenCalledWith("Roadmap");
  });

  it("sends chat messages and shows AI response", async () => {
    renderBoard();
    await screen.findByLabelText("Board name");

    const chatInput = screen.getByLabelText(/ask ai about your board/i);
    await userEvent.type(chatInput, "Help me plan this sprint.");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Help me plan this sprint.")).toBeInTheDocument();
    expect(await screen.findByText("AI reply")).toBeInTheDocument();
  });

  it("sends the board id with the chat request", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderBoard();
    await screen.findByLabelText("Board name");

    await userEvent.type(screen.getByLabelText(/ask ai about your board/i), "Hi");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText("AI reply");

    const chatCall = fetchMock.mock.calls.find(
      ([input]) => readPath(input).includes("/api/ai/chat")
    );
    expect(chatCall).toBeDefined();
    const body = JSON.parse(String((chatCall?.[1] as RequestInit).body));
    expect(body.board_id).toBe("board-1");
  });

  it("applies AI board updates to the visible board", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const method = init?.method ?? "GET";
      const path = readPath(input);
      if (method === "POST" && path.includes("/api/ai/chat")) {
        return new Response(
          JSON.stringify({
            response: "Updated.",
            board_update: {
              columns: [{ id: "col-backlog", title: "Backlog", cardIds: ["card-ai"] }],
              cards: {
                "card-ai": {
                  id: "card-ai",
                  title: "AI generated task",
                  details: "From assistant",
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (method === "PUT") {
        return boardContent(JSON.parse(String(init?.body)));
      }
      return boardContent();
    });

    renderBoard();
    await screen.findByLabelText("Board name");

    await userEvent.type(screen.getByLabelText(/ask ai about your board/i), "Update board");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("AI generated task")).toBeInTheDocument();
  });

  it("shows AI error message when chat request fails", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const method = init?.method ?? "GET";
      const path = readPath(input);
      if (method === "POST" && path.includes("/api/ai/chat")) {
        return new Response(JSON.stringify({ detail: "AI unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "PUT") {
        return boardContent(JSON.parse(String(init?.body)));
      }
      return boardContent();
    });

    renderBoard();
    await screen.findByLabelText("Board name");

    await userEvent.type(screen.getByLabelText(/ask ai about your board/i), "Any updates?");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI unavailable");
  });
});
