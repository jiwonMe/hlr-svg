import type { CsgOperation } from "@hlr/scene/primitives/csg.js";
import { add3, type Tuple3 } from "./math";
import {
  canMerge,
  consumedIds,
  createBoolean,
  dependents,
  freePoint,
  isPositioned,
  KIND_NAMES,
  mapReferences,
  nextId,
  nextLabel,
  nextName,
  references,
  type EditorDoc,
  type EditorObject,
  type RenderSettings,
} from "./model";
import { resolvePoints } from "./resolve";

export type EditorState = {
  doc: EditorDoc;
  /** Selected ids in the order they were picked; booleans read A then B. */
  selection: string[];
  past: EditorDoc[];
  future: EditorDoc[];
};

export type ObjectPatch = { id: string; patch: Partial<EditorObject> };

export type EditorAction =
  | { type: "select"; ids: readonly string[] }
  | { type: "toggle"; id: string }
  | { type: "selectAll" }
  /** New objects as one undo step; selects `select` or the last one. */
  | { type: "add"; objects: readonly EditorObject[]; select?: readonly string[] }
  | {
      type: "update";
      id: string;
      patch: Partial<EditorObject>;
      /** Live drags: the checkpoint taken at drag start is the undo step. */
      transient?: boolean;
    }
  | { type: "updateMany"; patches: readonly ObjectPatch[]; transient?: boolean }
  | { type: "remove"; ids: readonly string[] }
  | { type: "duplicate"; ids: readonly string[] }
  /** Objects from the clipboard, already closed over their references. */
  | {
      type: "paste";
      objects: readonly EditorObject[];
      /** What was picked when copying; its copies end up selected. */
      roots?: readonly string[];
    }
  | { type: "boolean"; op: CsgOperation; a: string; b: string }
  /** Point `from` dropped onto point `into`: everything drawn through it moves over. */
  | { type: "merge"; from: string; into: string; transient?: boolean }
  /** Removes a boolean and gives its operands back. */
  | { type: "dissolve"; id: string }
  | { type: "settings"; patch: Partial<RenderSettings>; transient?: boolean }
  | { type: "title"; title: string; transient?: boolean }
  | { type: "load"; doc: EditorDoc }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 120;
const COPY_OFFSET: Tuple3 = [0.5, 0, 0.5];

function commit(state: EditorState, doc: EditorDoc): EditorState {
  return {
    ...state,
    doc,
    past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
  };
}

function withObjects(doc: EditorDoc, objects: EditorObject[]): EditorDoc {
  return { ...doc, objects };
}

function existing(doc: EditorDoc, ids: readonly string[]): string[] {
  const known = new Set(doc.objects.map((object) => object.id));
  return ids.filter((id) => known.has(id));
}

function applyPatches(
  objects: readonly EditorObject[],
  patches: readonly ObjectPatch[],
): EditorObject[] {
  const byId = new Map<string, Partial<EditorObject>>();
  for (const { id, patch } of patches)
    byId.set(id, { ...(byId.get(id) ?? {}), ...patch });
  return objects.map((object) => {
    const patch = byId.get(object.id);
    return patch ? ({ ...object, ...patch } as EditorObject) : object;
  });
}

/** A boolean takes its operands with it; anything built on a removed object goes too. */
export function removalSet(
  objects: readonly EditorObject[],
  ids: readonly string[],
): Set<string> {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const out = new Set<string>();
  const take = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    const object = byId.get(id);
    if (object?.kind === "boolean") {
      take(object.a);
      take(object.b);
    }
  };
  for (const id of ids) take(id);
  return dependents(objects, out);
}

/**
 * The objects a copy of `ids` needs: boolean operands and the points that
 * segments, faces and marks are drawn through. Constrained points are stored
 * at their current position so they can be let go if their rule is not copied.
 */
export function copyClosure(
  objects: readonly EditorObject[],
  ids: readonly string[],
): EditorObject[] {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const keep = new Set<string>();
  const visit = (id: string) => {
    const object = byId.get(id);
    if (!object || keep.has(id)) return;
    keep.add(id);
    if (object.kind === "boolean") {
      visit(object.a);
      visit(object.b);
    } else if (object.kind !== "point") references(object).forEach(visit);
  };
  ids.forEach(visit);
  const positions = resolvePoints(objects);
  return objects
    .filter((object) => keep.has(object.id))
    .map((object) =>
      object.kind === "point" && object.constraint
        ? { ...object, position: positions.get(object.id) ?? object.position }
        : object,
    );
}

/** Copies with fresh ids, names and letters, shifted by `offset`. */
function cloneInto(
  objects: readonly EditorObject[],
  sources: readonly EditorObject[],
  offset: Tuple3,
): { made: EditorObject[]; ids: Map<string, string> } {
  const all: EditorObject[] = [...objects];
  const ids = new Map<string, string>();
  for (const source of sources) {
    const id = nextId(all, source.kind);
    ids.set(source.id, id);
    // Reserve the id before naming the next copy.
    all.push({ ...source, id });
  }
  const made: EditorObject[] = [];
  const named = [...objects];
  for (const source of sources) {
    const lettered =
      (source.kind === "point" || source.kind === "plane") && source.label;
    const label = lettered ? nextLabel(named, source.kind) : source.label;
    let copy = mapReferences(
      {
        ...source,
        id: ids.get(source.id)!,
        label,
        name:
          lettered && label
            ? `${KIND_NAMES[source.kind]} ${label}`
            : nextName(named, source.kind),
      } as EditorObject,
      (ref) => ids.get(ref) ?? ref,
    );
    if (copy.kind === "point" && copy.constraint) {
      // A rule whose objects stayed behind would pin the copy onto the original.
      if (!references(source).every((ref) => ids.has(ref)))
        copy = freePoint(copy, add3(copy.position, offset));
    } else if (isPositioned(copy))
      copy = { ...copy, position: add3(copy.position, offset) } as EditorObject;
    made.push(copy);
    named.push(copy);
  }
  return { made, ids };
}

/** The copies of what was picked; without that, the copies nothing else uses. */
function pickedCopies(
  made: readonly EditorObject[],
  ids: ReadonlyMap<string, string>,
  roots: readonly string[] | undefined,
): string[] {
  const picked = (roots ?? [])
    .map((id) => ids.get(id))
    .filter((id): id is string => !!id);
  if (picked.length) return picked;
  const consumed = consumedIds(made);
  return made.filter((object) => !consumed.has(object.id)).map((o) => o.id);
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  const { doc } = state;
  switch (action.type) {
    case "select": {
      const ids = existing(doc, [...new Set(action.ids)]);
      return ids.length === state.selection.length &&
        ids.every((id, i) => id === state.selection[i])
        ? state
        : { ...state, selection: ids };
    }
    case "toggle":
      return {
        ...state,
        selection: state.selection.includes(action.id)
          ? state.selection.filter((id) => id !== action.id)
          : existing(doc, [...state.selection, action.id]),
      };
    case "selectAll": {
      const consumed = consumedIds(doc.objects);
      return {
        ...state,
        selection: doc.objects
          .filter((object) => !consumed.has(object.id) && !object.hidden)
          .map((object) => object.id),
      };
    }
    case "add": {
      if (!action.objects.length) return state;
      const next = commit(
        state,
        withObjects(doc, [...doc.objects, ...action.objects]),
      );
      return {
        ...next,
        selection: [
          ...(action.select ?? [action.objects[action.objects.length - 1]!.id]),
        ],
      };
    }
    case "update": {
      const next = withObjects(
        doc,
        applyPatches(doc.objects, [{ id: action.id, patch: action.patch }]),
      );
      return action.transient ? { ...state, doc: next } : commit(state, next);
    }
    case "updateMany": {
      if (!action.patches.length) return state;
      const next = withObjects(doc, applyPatches(doc.objects, action.patches));
      return action.transient ? { ...state, doc: next } : commit(state, next);
    }
    case "remove": {
      if (!action.ids.length) return state;
      const removed = removalSet(doc.objects, action.ids);
      return {
        ...commit(
          state,
          withObjects(
            doc,
            doc.objects.filter((object) => !removed.has(object.id)),
          ),
        ),
        selection: state.selection.filter((id) => !removed.has(id)),
      };
    }
    case "duplicate":
    case "paste": {
      const sources =
        action.type === "duplicate"
          ? copyClosure(doc.objects, action.ids)
          : action.objects;
      if (!sources.length) return state;
      const { made, ids } = cloneInto(doc.objects, sources, COPY_OFFSET);
      return {
        ...commit(state, withObjects(doc, [...doc.objects, ...made])),
        selection: pickedCopies(
          made,
          ids,
          action.type === "duplicate" ? action.ids : action.roots,
        ),
      };
    }
    case "boolean": {
      const consumed = consumedIds(doc.objects);
      if (
        action.a === action.b ||
        consumed.has(action.a) ||
        consumed.has(action.b)
      )
        return state;
      const object = createBoolean(doc.objects, action.op, action.a, action.b);
      return {
        ...commit(state, withObjects(doc, [...doc.objects, object])),
        selection: [object.id],
      };
    }
    case "merge": {
      if (!canMerge(doc.objects, action.from, action.into)) return state;
      const next = withObjects(
        doc,
        doc.objects
          .filter((object) => object.id !== action.from)
          .map((object) =>
            mapReferences(object, (id) => (id === action.from ? action.into : id)),
          ),
      );
      const selection = [
        ...new Set(
          state.selection.map((id) => (id === action.from ? action.into : id)),
        ),
      ];
      return action.transient
        ? { ...state, doc: next, selection }
        : { ...commit(state, next), selection };
    }
    case "dissolve": {
      const target = doc.objects.find((object) => object.id === action.id);
      if (target?.kind !== "boolean" || consumedIds(doc.objects).has(target.id))
        return state;
      const positions = resolvePoints(doc.objects);
      const objects = doc.objects
        .filter((object) => object.id !== target.id)
        .map((object) =>
          object.kind === "point" && references(object).includes(target.id)
            ? freePoint(object, positions.get(object.id) ?? object.position)
            : object,
        );
      return {
        ...commit(state, withObjects(doc, objects)),
        selection: [target.a, target.b],
      };
    }
    case "settings": {
      const next = { ...doc, settings: { ...doc.settings, ...action.patch } };
      return action.transient ? { ...state, doc: next } : commit(state, next);
    }
    case "title": {
      if (action.title === doc.title) return state;
      const next = { ...doc, title: action.title };
      return action.transient ? { ...state, doc: next } : commit(state, next);
    }
    case "load":
      return {
        doc: action.doc,
        selection: [],
        past: [...state.past, doc].slice(-HISTORY_LIMIT),
        future: [],
      };
    case "checkpoint":
      return {
        ...state,
        past: [...state.past, doc].slice(-HISTORY_LIMIT),
        future: [],
      };
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        doc: previous,
        selection: existing(previous, state.selection),
        past: state.past.slice(0, -1),
        future: [doc, ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        doc: next,
        selection: existing(next, state.selection),
        past: [...state.past, doc],
        future: state.future.slice(1),
      };
    }
  }
}
