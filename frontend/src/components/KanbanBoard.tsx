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
import { fetchBoard, updateBoard } from "@/lib/api";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-12">
        <p className="text-sm font-medium text-[var(--gray-text)]">Loading board...</p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
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

        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

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
      </main>
    </div>
  );
};
