"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import {
  createBoard,
  deleteBoard,
  fetchBoards,
  logout as apiLogout,
  renameBoard,
  type BoardSummary,
} from "@/lib/api";

type Props = {
  username: string;
  onLogout: () => void;
};

export const BoardWorkspace = ({ username, onLogout }: Props) => {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  const loadBoards = async (preferredId?: string) => {
    const summaries = await fetchBoards();
    setBoards(summaries);
    setActiveBoardId((current) => {
      const target = preferredId ?? current;
      if (target && summaries.some((board) => board.id === target)) {
        return target;
      }
      return summaries[0]?.id ?? null;
    });
    return summaries;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadBoards();
        if (active) {
          setError(null);
        }
      } catch {
        if (active) {
          setError("Unable to load your boards.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await apiLogout();
    onLogout();
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name) {
      return;
    }
    try {
      const created = await createBoard(name);
      setNewBoardName("");
      setIsCreating(false);
      await loadBoards(created.id);
      setError(null);
    } catch {
      setError("Could not create the board.");
    }
  };

  const handleRename = async (boardId: string, name: string) => {
    const trimmed = name.trim();
    const current = boards.find((board) => board.id === boardId);
    if (!trimmed || !current || trimmed === current.name) {
      return;
    }
    try {
      await renameBoard(boardId, trimmed);
      await loadBoards(boardId);
      setError(null);
    } catch {
      setError("Could not rename the board.");
    }
  };

  const handleDelete = async (boardId: string) => {
    if (boards.length <= 1) {
      return;
    }
    try {
      await deleteBoard(boardId);
      await loadBoards();
      setError(null);
    } catch {
      setError("Could not delete the board.");
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1760px] items-center justify-center px-6 py-12">
        <p className="text-sm font-medium text-[var(--gray-text)]">Loading boards...</p>
      </main>
    );
  }

  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? null;

  return (
    <div>
      <nav
        aria-label="Boards"
        className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-3 px-6 pt-6 lg:px-10"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          {username}
        </span>
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              role="tab"
              aria-selected={board.id === activeBoardId}
              onClick={() => setActiveBoardId(board.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                board.id === activeBoardId
                  ? "border-[var(--primary-blue)] bg-[var(--primary-blue)] text-white"
                  : "border-[var(--stroke)] bg-white text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
              }`}
            >
              {board.name}
            </button>
          ))}
        </div>

        {isCreating ? (
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              aria-label="New board name"
              value={newBoardName}
              onChange={(event) => setNewBoardName(event.target.value)}
              placeholder="Board name"
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded-full border border-dashed border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--secondary-purple)] hover:border-[var(--secondary-purple)]"
          >
            + New board
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="ml-auto rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] hover:text-[var(--secondary-purple)]"
        >
          Logout
        </button>
      </nav>

      {error ? (
        <p
          role="alert"
          className="mx-auto mt-3 max-w-[1760px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {activeBoard ? (
        <KanbanBoard
          key={activeBoard.id}
          boardId={activeBoard.id}
          boardName={activeBoard.name}
          username={username}
          canDelete={boards.length > 1}
          onRenameBoard={(name) => handleRename(activeBoard.id, name)}
          onDeleteBoard={() => handleDelete(activeBoard.id)}
        />
      ) : (
        <main className="mx-auto flex max-w-[1760px] items-center justify-center px-6 py-12">
          <p className="text-sm text-[var(--gray-text)]">No board selected.</p>
        </main>
      )}
    </div>
  );
};
