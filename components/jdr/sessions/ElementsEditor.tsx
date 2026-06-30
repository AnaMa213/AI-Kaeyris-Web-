"use client";

import { useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { components } from "@/types/api";

type Element = components["schemas"]["Element"];

/**
 * Story 8.3 (BD-26 / ADR DP-4) — structured editor for the Éléments card.
 * Free-form categories (the 4 canonical labels are only suggestions), saved as a
 * whole-card atomic PUT (no per-element endpoint). Presentational: the parent
 * panel owns the read↔edit toggle and the mutation.
 */

const CANONICAL_CATEGORIES = ["PNJ", "Lieux", "Objets", "Indices"] as const;
const CATEGORY_DATALIST_ID = "elements-category-suggestions";

interface EditorRow {
  id: string;
  category: string;
  name: string;
  description: string;
}

let rowSeq = 0;
function makeRow(element?: Element): EditorRow {
  rowSeq += 1;
  return {
    id: `el-row-${rowSeq}`,
    category: element?.category ?? "",
    name: element?.name ?? "",
    description: element?.description ?? "",
  };
}

interface ElementsEditorProps {
  initialElements: Element[];
  onSave: (elements: Element[]) => void;
  onCancel: () => void;
  saving: boolean;
  saveError?: string | null;
}

export function ElementsEditor({
  initialElements,
  onSave,
  onCancel,
  saving,
  saveError,
}: ElementsEditorProps) {
  const [rows, setRows] = useState<EditorRow[]>(() =>
    initialElements.length > 0
      ? initialElements.map((el) => makeRow(el))
      : [makeRow()],
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateRow = (id: string, patch: Partial<EditorRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, makeRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const handleSave = () => {
    const trimmed = rows.map((r) => ({
      category: r.category.trim(),
      name: r.name.trim(),
      description: r.description.trim(),
    }));
    // Drop fully-empty rows; an empty result is a legitimate "clear" (the panel
    // confirms it). Each kept row must have a category + name.
    const kept = trimmed.filter((r) => r.category || r.name || r.description);
    if (kept.some((r) => !r.category || !r.name)) {
      setValidationError(
        "Chaque élément doit avoir une catégorie et un nom.",
      );
      return;
    }
    setValidationError(null);
    onSave(kept);
  };

  const error = validationError ?? saveError ?? null;

  return (
    <div className="flex flex-col gap-3">
      <datalist id={CATEGORY_DATALIST_ID}>
        {CANONICAL_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="border-border-card/60 flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-start gap-2">
              <Input
                list={CATEGORY_DATALIST_ID}
                aria-label={`Catégorie de l'élément ${index + 1}`}
                placeholder="Catégorie (PNJ, Lieux…)"
                value={row.category}
                onChange={(e) => updateRow(row.id, { category: e.target.value })}
                disabled={saving}
                className="w-40"
              />
              <Input
                aria-label={`Nom de l'élément ${index + 1}`}
                placeholder="Nom"
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                disabled={saving}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Supprimer l'élément ${index + 1}`}
                onClick={() => removeRow(row.id)}
                disabled={saving}
              >
                <Trash2 />
              </Button>
            </div>
            <Textarea
              aria-label={`Description de l'élément ${index + 1}`}
              placeholder="Description (optionnel)"
              value={row.description}
              onChange={(e) =>
                updateRow(row.id, { description: e.target.value })
              }
              disabled={saving}
              className="min-h-16 text-sm"
            />
          </li>
        ))}
      </ul>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={saving}
        >
          <Plus />
          Ajouter un élément
        </Button>
      </div>

      {error && (
        <p className="text-state-error text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          <X />
          Annuler
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={saving ? "animate-pulse" : undefined}
        >
          <Save />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
