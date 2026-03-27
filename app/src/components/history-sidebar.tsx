"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import {
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  GripVertical,
  ListChecks,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Folder as FolderType, Transcript } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/store";

const TRANSCRIPT_MIME = "application/x-echoes-transcript-id";

interface HistorySidebarProps {
  transcripts: Transcript[];
  folders: FolderType[];
  selectedId: string | null;
  onSelect: (transcript: Transcript) => void;
  onDelete: (id: string) => void;
  onMoveTranscript: (id: string, folderId: string | null) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkMove: (ids: string[], folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
}

function matchesSearch(t: Transcript, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return (
    t.fileName.toLowerCase().includes(s) || t.text.toLowerCase().includes(s)
  );
}

function folderMatchesSearch(f: FolderType, q: string): boolean {
  if (!q.trim()) return false;
  return f.name.toLowerCase().includes(q.toLowerCase());
}

export function HistorySidebar({
  transcripts,
  folders,
  selectedId,
  onSelect,
  onDelete,
  onMoveTranscript,
  onBulkDelete,
  onBulkMove,
  onCreateFolder,
  onDeleteFolder,
}: HistorySidebarProps) {
  const [search, setSearch] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<"root" | string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editModeIds, setEditModeIds] = useState<string[]>([]);
  const [bulkMoveKey, setBulkMoveKey] = useState(0);

  const isRowEditMode = useCallback(
    (id: string) => editModeIds.includes(id),
    [editModeIds]
  );

  const toggleRowEdit = useCallback((id: string) => {
    setEditModeIds((prev) => {
      if (prev.includes(id)) {
        setSelectedIds((s) => s.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  useEffect(() => {
    const valid = new Set(transcripts.map((t) => t.id));
    setEditModeIds((prev) => prev.filter((id) => valid.has(id)));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [transcripts]);

  const q = search.trim().toLowerCase();

  const { rootList, folderLists } = useMemo(() => {
    const root = transcripts.filter((t) => t.folderId == null);
    const byFolder = new Map<string, Transcript[]>();
    for (const t of transcripts) {
      if (t.folderId == null) continue;
      const list = byFolder.get(t.folderId) ?? [];
      list.push(t);
      byFolder.set(t.folderId, list);
    }
    return { rootList: root, folderLists: byFolder };
  }, [transcripts]);

  const sortedFolders = useMemo(() => {
    return [...folders].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [folders]);

  const visibleRoot = useMemo(() => {
    if (!q) return rootList;
    return rootList.filter((t) => matchesSearch(t, q));
  }, [rootList, q]);

  const folderRows = useMemo(() => {
    const raw = search.trim();
    return sortedFolders.map((f) => {
      const children = folderLists.get(f.id) ?? [];
      let displayChildren = children;
      if (raw) {
        if (folderMatchesSearch(f, raw)) {
          displayChildren = children;
        } else {
          displayChildren = children.filter((t) => matchesSearch(t, raw));
        }
      }
      const visible =
        !raw ||
        folderMatchesSearch(f, raw) ||
        displayChildren.length > 0;
      return { folder: f, children: displayChildren, visible };
    });
  }, [sortedFolders, folderLists, search]);

  const visibleTranscriptIds = useMemo(() => {
    const ids: string[] = [];
    for (const t of visibleRoot) ids.push(t.id);
    for (const row of folderRows) {
      if (!row.visible) continue;
      for (const t of row.children) ids.push(t.id);
    }
    return ids;
  }, [visibleRoot, folderRows]);

  /** Rows that are in edit mode (pencil clicked) and can show a checkbox */
  const selectableVisibleIds = useMemo(
    () => visibleTranscriptIds.filter((id) => editModeIds.includes(id)),
    [visibleTranscriptIds, editModeIds]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.includes(id));

  const toggleRowSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    if (selectableVisibleIds.length === 0) return;
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds([...selectableVisibleIds]);
  }, [allVisibleSelected, selectableVisibleIds]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const isExpanded = useCallback(
    (folderId: string) => expanded[folderId] !== false,
    [expanded]
  );

  const toggleFolder = useCallback((folderId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [folderId]: prev[folderId] === false ? true : false,
    }));
  }, []);

  const rootExpanded = expanded.root !== false;

  const onDragStart = useCallback((transcriptId: string) => {
    return (e: React.DragEvent) => {
      e.dataTransfer.setData(TRANSCRIPT_MIME, transcriptId);
      e.dataTransfer.setData("text/plain", transcriptId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingId(transcriptId);
    };
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const onDragOverZone = useCallback(
    (target: "root" | string) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(target);
    },
    []
  );

  const onDragLeaveZone = useCallback((e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropTarget(null);
  }, []);

  const onDropOn = useCallback(
    (folderId: string | null) => (e: React.DragEvent) => {
      e.preventDefault();
      const id =
        e.dataTransfer.getData(TRANSCRIPT_MIME) ||
        e.dataTransfer.getData("text/plain");
      setDropTarget(null);
      setDraggingId(null);
      if (!id) return;
      const moveIds =
        selectedIds.includes(id) && selectedIds.length > 0
          ? selectedIds
          : [id];
      const toMove = moveIds.filter((tid) => {
        const tr = transcripts.find((x) => x.id === tid);
        if (!tr) return false;
        return (tr.folderId ?? null) !== folderId;
      });
      if (toMove.length === 0) return;
      if (toMove.length === 1) {
        onMoveTranscript(toMove[0], folderId);
      } else {
        onBulkMove(toMove, folderId);
      }
      clearSelection();
    },
    [transcripts, onMoveTranscript, onBulkMove, selectedIds, clearSelection]
  );

  const dropRing = (target: "root" | string) =>
    draggingId && dropTarget === target
      ? "ring-2 ring-primary/45 bg-primary/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      : draggingId
        ? "transition-[box-shadow,background-color] duration-150"
        : "";

  const transcriptBody = (
    t: Transcript,
    variant: "clean" | "edit" | "editToolbar"
  ) => (
    <>
      <p
        className={`truncate font-medium leading-snug tracking-tight text-foreground ${
          variant === "clean" ? "text-[13px] pr-2" : "text-[13px]"
        } ${
          variant === "clean"
            ? ""
            : variant === "editToolbar"
              ? "pr-20"
              : "pr-[min(100%,10.5rem)] sm:pr-[12rem]"
        }`}
      >
        {t.fileName}
      </p>
      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
        {t.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
        {t.duration > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0 opacity-80" />
            {formatDuration(t.duration)}
          </span>
        )}
        <span>{formatDate(t.createdAt)}</span>
      </div>
    </>
  );

  const renderTranscriptRow = (t: Transcript) => {
    const isDragSource = draggingId === t.id;
    const rowSelected = selectedIds.includes(t.id);
    const editMode = isRowEditMode(t.id);

    const folderSelectClass =
      "max-w-[min(100%,7.5rem)] min-w-0 cursor-pointer bg-transparent py-0.5 pl-0 pr-1 text-[12px] text-foreground outline-none";

    if (!editMode) {
      return (
        <m.div
          key={t.id}
          layout
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          className={`group relative rounded-xl border p-3 text-foreground transition-all duration-200 ${
            selectedId === t.id
              ? "border-primary/30 bg-primary/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
              : "border-border/50 bg-card/50 hover:border-border hover:bg-card/80 hover:shadow-sm"
          }`}
        >
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer pr-10 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
            onClick={() => onSelect(t)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(t);
              }
            }}
          >
            {transcriptBody(t, "clean")}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRowEdit(t.id);
            }}
            className="absolute right-2 top-2 rounded-lg border border-transparent p-2 text-muted-foreground transition-all hover:border-border/60 hover:bg-secondary/80 hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            title="Edit — select, move, delete"
            aria-label="Edit row"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </m.div>
      );
    }

    return (
      <m.div
        key={t.id}
        layout
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: isDragSource ? 0.45 : 1, y: 0 }}
        className={`group relative flex gap-2 rounded-xl border border-l-[3px] p-3 transition-all duration-200 ${
          selectedId === t.id
            ? "border-primary/35 border-l-primary bg-primary/[0.05] shadow-sm"
            : rowSelected
              ? "border-border/60 border-l-primary/60 bg-card/90 ring-1 ring-primary/20 shadow-sm"
              : "border-border/55 border-l-primary/45 bg-card/85 shadow-sm"
        }`}
      >
        <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
          <input
            type="checkbox"
            checked={rowSelected}
            onChange={() => toggleRowSelect(t.id)}
            className="mt-0.5 h-4 w-4 rounded border-border/80 text-primary shadow-sm focus:ring-2 focus:ring-primary/35 focus:ring-offset-0 focus:ring-offset-background"
            aria-label={`Select ${t.fileName}`}
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <div
          draggable
          onDragStart={onDragStart(t.id)}
          onDragEnd={onDragEnd}
          className="flex shrink-0 cursor-grab touch-none items-start rounded-lg border border-transparent pt-0.5 text-muted-foreground/60 transition-colors active:cursor-grabbing hover:border-border/50 hover:bg-secondary/50 hover:text-muted-foreground"
          title={
            selectedIds.includes(t.id) && selectedIds.length > 1
              ? `Drag to move ${selectedIds.length} selected`
              : "Drag to move"
          }
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </div>
        <div
          role="button"
          tabIndex={0}
          className="min-w-0 flex-1 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md pr-1"
          onClick={() => onSelect(t)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(t);
            }
          }}
        >
          {transcriptBody(
            t,
            rowSelected && selectedIds.length === 1 ? "edit" : "editToolbar"
          )}
        </div>
        <div className="absolute right-2 top-2 flex max-w-[min(100%,calc(100%-1rem))] flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRowEdit(t.id);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-secondary/70 px-2 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition hover:bg-secondary"
            title="Done editing"
            aria-label="Done editing"
            aria-pressed
          >
            <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
            <span className="hidden sm:inline">Done</span>
          </button>
          {rowSelected && selectedIds.length === 1 && (
            <div className="flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-border bg-secondary/50 px-1.5 py-0.5">
              <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
              <select
                aria-label="Move to folder"
                value={t.folderId ?? ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const v = e.target.value;
                  onMoveTranscript(t.id, v === "" ? null : v);
                }}
                className={folderSelectClass}
              >
                <option value="">Root</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </m.div>
    );
  };

  const noSearchResults =
    transcripts.length > 0 &&
    !!search.trim() &&
    visibleRoot.length === 0 &&
    folderRows.every((r) => !r.visible);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-3 py-2">
        {!creatingFolder ? (
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 py-2.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/35 hover:bg-secondary/60 hover:text-foreground"
          >
            <Folder className="h-3.5 w-3.5" />
            New folder
          </button>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onCreateFolder(newFolderName.trim() || "Untitled folder");
              setNewFolderName("");
              setCreatingFolder(false);
            }}
          >
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground"
            >
              Add
            </button>
          </form>
        )}
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts..."
            className="h-9 w-full rounded-lg border border-border bg-secondary pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        {transcripts.length > 0 && !noSearchResults && editModeIds.length > 0 && (
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <ListChecks className="h-3.5 w-3.5" />
            {allVisibleSelected ? "Deselect all visible" : "Select all visible"}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {transcripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AudioLines className="mb-3 h-5 w-5 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No transcripts yet.</p>
          </div>
        ) : noSearchResults ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AudioLines className="mb-3 h-5 w-5 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No matches found.</p>
          </div>
        ) : (
          <div className="select-none space-y-2">
            {/* Root branch */}
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 shadow-sm">
              <div
                className={`flex flex-wrap items-center gap-1.5 rounded-t-xl border-b border-border/50 px-2.5 py-2.5 ${dropRing("root")}`}
                onDragOver={onDragOverZone("root")}
                onDragLeave={onDragLeaveZone}
                onDrop={onDropOn(null)}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((p) => ({
                      ...p,
                      root: p.root === false ? true : false,
                    }))
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
                  aria-expanded={rootExpanded}
                >
                  {rootExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Root
                </span>
                <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {rootList.length}
                </span>
                <span className="text-[10px] text-muted-foreground/75">
                  — drop here to uncategorize
                </span>
              </div>
              {rootExpanded && (
                <div className="ml-2.5 space-y-1.5 border-l-2 border-primary/20 py-1 pl-2 pr-1.5">
                  {visibleRoot.length === 0 ? (
                    <p className="px-2 py-3 text-[12px] text-muted-foreground/80">
                      {q ? "No matching items in Root." : "No transcripts in Root."}
                    </p>
                  ) : (
                    visibleRoot.map((t) => renderTranscriptRow(t))
                  )}
                </div>
              )}
            </div>

            {/* Folder branches */}
            {folderRows.map(({ folder: f, children, visible }) => {
              if (!visible) return null;
              const open = isExpanded(f.id);
              const count = (folderLists.get(f.id) ?? []).length;
              return (
                <div
                  key={f.id}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card/40 shadow-sm"
                >
                  <div
                    className={`flex flex-wrap items-center gap-1.5 rounded-t-xl border-b border-border/50 px-2.5 py-2.5 ${dropRing(f.id)}`}
                    onDragOver={onDragOverZone(f.id)}
                    onDragLeave={onDragLeaveZone}
                    onDrop={onDropOn(f.id)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFolder(f.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
                      aria-expanded={open}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <Folder className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {f.name}
                    </span>
                    <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {count}
                    </span>
                    <button
                      type="button"
                      title="Delete folder"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(f.id);
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {open && (
                    <div className="ml-2.5 space-y-1.5 border-l-2 border-primary/20 py-1 pl-2 pr-1.5">
                      {children.length === 0 ? (
                        <p className="px-2 py-3 text-[12px] text-muted-foreground/80">
                          {q
                            ? "No matching items in this folder."
                            : "Empty — drop transcripts here"}
                        </p>
                      ) : (
                        children.map((t) => renderTranscriptRow(t))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="shrink-0 rounded-t-2xl border border-b-0 border-border/80 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_-4px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:shadow-[0_-8px_32px_-4px_rgba(0,0,0,0.35)]">
          <p className="mb-2.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {selectedIds.length} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onBulkDelete(selectedIds);
                clearSelection();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            {selectedIds.length > 1 && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2 py-1">
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  Move to
                </span>
                <select
                  key={bulkMoveKey}
                  aria-label="Move selected to folder"
                  className="max-w-[10rem] min-w-0 cursor-pointer bg-transparent py-0.5 text-[11px] text-foreground outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return;
                    const folderId = v === "__root__" ? null : v;
                    onBulkMove(selectedIds, folderId);
                    clearSelection();
                    setBulkMoveKey((k) => k + 1);
                  }}
                >
                  <option value="">Choose…</option>
                  <option value="__root__">Root</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      </div>

      {transcripts.length > 0 && (
        <div className="border-t border-border px-4 py-3 text-[11px] tabular-nums text-muted-foreground">
          {transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""} on disk
        </div>
      )}
    </div>
  );
}
