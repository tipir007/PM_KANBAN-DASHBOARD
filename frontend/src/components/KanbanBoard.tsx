"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragOverEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { fetchBoard, updateBoard, type ChatMessage } from "@/lib/api";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";
import { LogoutIcon } from "@/components/icons";

type KanbanBoardProps = {
  onLogout?: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps = {}) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const lastOverIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  useEffect(() => {
    let active = true;

    const loadBoard = async () => {
      try {
        const remoteBoard = await fetchBoard();
        if (active) {
          setBoard(remoteBoard);
          setLoadError(null);
        }
      } catch {
        if (active) {
          setLoadError("Unable to load board from backend. Using local data.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadBoard();

    return () => {
      active = false;
    };
  }, []);

  const applyBoardUpdate = (nextBoard: BoardData) => {
    setBoard(nextBoard);
    setIsSaving(true);
    setSaveError(null);
    void updateBoard(nextBoard)
      .catch(() => {
        setSaveError("Failed to save board changes.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleBoardUpdateFromAI = (nextBoard: BoardData) => {
    setBoard(nextBoard);
    setSaveError(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    lastOverIdRef.current = null;
    setActiveCardId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over?.id) {
      lastOverIdRef.current = String(event.over.id);
    }
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    const nextBoard = {
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    };
    applyBoardUpdate(nextBoard);
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    const nextBoard = {
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    };
    applyBoardUpdate(nextBoard);
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    const nextBoard = {
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    };
    applyBoardUpdate(nextBoard);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    const targetId = over ? String(over.id) : lastOverIdRef.current;
    lastOverIdRef.current = null;

    if (!targetId || String(active.id) === targetId) {
      return;
    }

    const nextBoard = {
      ...board,
      columns: moveCard(board.columns, String(active.id), targetId),
    };
    applyBoardUpdate(nextBoard);
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const totalCards = Object.keys(board.cards).length;

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1760px] items-center justify-center px-6 py-12">
        <p className="text-sm font-medium text-[var(--gray-text)]">Loading board...</p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1760px] flex-col gap-8 px-6 pb-16 pt-10 lg:px-10">
        {loadError ? (
          <p
            role="status"
            className="rounded-xl border border-[var(--accent-yellow)] bg-white px-4 py-3 text-sm text-[var(--navy-dark)]"
          >
            {loadError}
          </p>
        ) : null}

        {saveError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {saveError}
          </p>
        ) : null}

        {isSaving ? (
          <p className="text-sm font-medium text-[var(--gray-text)]">Saving changes...</p>
        ) : null}

        <header className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] border border-[var(--stroke)] bg-white/80 px-8 py-6 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center gap-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--navy-dark)] font-display text-2xl font-semibold text-[var(--accent-yellow)]">
              K
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="font-display text-3xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2">
              <span className="font-display text-lg font-semibold text-[var(--primary-blue)]">
                {board.columns.length}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                columns
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2">
              <span className="font-display text-lg font-semibold text-[var(--secondary-purple)]">
                {totalCards}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                cards
              </span>
            </div>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:text-[var(--secondary-purple)]"
              >
                <LogoutIcon width={14} height={14} />
                Logout
              </button>
            ) : null}
          </div>
        </header>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <AIChatSidebar
            messages={chatMessages}
            onMessagesChange={setChatMessages}
            onBoardUpdateFromAI={handleBoardUpdateFromAI}
          />
        </section>
      </main>
    </div>
  );
};
