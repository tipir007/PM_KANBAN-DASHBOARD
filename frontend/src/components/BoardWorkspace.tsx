"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/Dropdown";
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
  const canDelete = boards.length > 1;

  return (
    <div>
      <nav
        aria-label="Workspace"
        className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-3 px-6 pt-6 lg:px-10"
      >
        {/* Boards scroll menu */}
        <Dropdown
          ariaLabel="Boards menu"
          label={
            <span className="max-w-[220px] truncate">
              {activeBoard ? activeBoard.name : "Boards"}
            </span>
          }
        >
          {(close) => (
            <div>
              <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Your boards
              </p>
              <ul role="none" className="max-h-64 overflow-y-auto py-1">
                {boards.map((board) => {
                  const isActive = board.id === activeBoardId;
                  return (
                    <li key={board.id} role="none" className="flex items-center">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => {
                          setActiveBoardId(board.id);
                          close();
                        }}
                        className={`flex-1 truncate px-4 py-2 text-left text-sm transition ${
                          isActive
                            ? "font-semibold text-[var(--primary-blue)]"
                            : "text-[var(--navy-dark)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        {board.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${board.name}`}
                        disabled={!canDelete}
                        onClick={() => handleDelete(board.id)}
                        className="mr-2 rounded-md px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-[var(--stroke)] p-2">
                {isCreating ? (
                  <form onSubmit={handleCreate} className="flex items-center gap-2">
                    <input
                      aria-label="New board name"
                      value={newBoardName}
                      onChange={(event) => setNewBoardName(event.target.value)}
                      placeholder="Board name"
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--secondary-purple)] px-3 py-2 text-sm font-semibold text-white"
                    >
                      Create
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--secondary-purple)] transition hover:bg-[var(--surface)]"
                  >
                    + New board
                  </button>
                )}
              </div>
            </div>
          )}
        </Dropdown>

        {/* User management scroll menu */}
        <div className="ml-auto">
          <Dropdown ariaLabel="User menu" align="end" label={<span>{username}</span>}>
            {(close) => (
              <div className="py-1">
                <div className="px-4 pb-2 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                    Signed in as
                  </p>
                  <p className="truncate text-sm font-semibold text-[var(--navy-dark)]">
                    {username}
                  </p>
                </div>
                <div className="border-t border-[var(--stroke)] p-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      void handleLogout();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)]"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </Dropdown>
        </div>
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
          onRenameBoard={(name) => handleRename(activeBoard.id, name)}
        />
      ) : (
        <main className="mx-auto flex max-w-[1760px] items-center justify-center px-6 py-12">
          <p className="text-sm text-[var(--gray-text)]">No board selected.</p>
        </main>
      )}
    </div>
  );
};
