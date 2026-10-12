import {
  createFace,
  createSegment,
  dependents,
  isPositioned,
  nextId,
  nextLabel,
  type EditorDoc,
  type EditorObject,
  type RenderSettings,
} from "./model";

export type EditorState = {
  doc: EditorDoc;
  selection: string | null;
  past: EditorDoc[];
  future: EditorDoc[];
};

export type EditorAction =
  | { type: "select"; id: string | null }
  | { type: "add"; object: EditorObject }
  /** Several objects as one undo step; the last one is selected. */
  | { type: "addMany"; objects: EditorObject[] }
  | { type: "addSegment"; from: string; to: string }
  | { type: "addFace"; points: string[] }
  | {
      type: "update";
      id: string;
      patch: Partial<EditorObject>;
      /** Live drags: the checkpoint taken at drag start is the undo step. */
      transient?: boolean;
    }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "settings"; patch: Partial<RenderSettings>; transient?: boolean }
  | { type: "title"; title: string }
  | { type: "load"; doc: EditorDoc }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 120;

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

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  const { doc } = state;
  switch (action.type) {
    case "select":
      return state.selection === action.id
        ? state
        : { ...state, selection: action.id };
    case "add":
      return {
        ...commit(state, withObjects(doc, [...doc.objects, action.object])),
        selection: action.object.id,
      };
    case "addMany": {
      if (!action.objects.length) return state;
      return {
        ...commit(state, withObjects(doc, [...doc.objects, ...action.objects])),
        selection: action.objects[action.objects.length - 1]!.id,
      };
    }
    case "addSegment": {
      const segment = createSegment(doc.objects, action.from, action.to);
      return {
        ...commit(state, withObjects(doc, [...doc.objects, segment])),
        selection: segment.id,
      };
    }
    case "addFace": {
      const face = createFace(doc.objects, action.points);
      return {
        ...commit(state, withObjects(doc, [...doc.objects, face])),
        selection: face.id,
      };
    }
    case "update": {
      const objects = doc.objects.map((object) =>
        object.id === action.id
          ? ({ ...object, ...action.patch } as EditorObject)
          : object,
      );
      const next = withObjects(doc, objects);
      return action.transient ? { ...state, doc: next } : commit(state, next);
    }
    case "remove": {
      const removed = new Set([
        action.id,
        ...dependents(doc.objects, action.id),
      ]);
      const objects = doc.objects.filter((object) => !removed.has(object.id));
      return {
        ...commit(state, withObjects(doc, objects)),
        selection: removed.has(state.selection ?? "") ? null : state.selection,
      };
    }
    case "duplicate": {
      const source = doc.objects.find((object) => object.id === action.id);
      if (!source) return state;
      const copy = {
        ...source,
        id: nextId(doc.objects, source.kind),
        name: `${source.name} 사본`,
        label: source.label ? nextLabel(doc.objects, source.kind) : "",
      } as EditorObject;
      if (isPositioned(copy)) {
        const [x, y, z] = copy.position;
        (copy as { position: readonly [number, number, number] }).position = [
          x + 0.5,
          y,
          z + 0.5,
        ];
      }
      return {
        ...commit(state, withObjects(doc, [...doc.objects, copy])),
        selection: copy.id,
      };
    }
    case "settings": {
      const next = { ...doc, settings: { ...doc.settings, ...action.patch } };
      return action.transient ? { ...state, doc: next } : commit(state, next);
    }
    case "title":
      return action.title === doc.title
        ? state
        : commit(state, { ...doc, title: action.title });
    case "load":
      return {
        doc: action.doc,
        selection: null,
        past: [...state.past, doc],
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
        selection: previous.objects.some((o) => o.id === state.selection)
          ? state.selection
          : null,
        past: state.past.slice(0, -1),
        future: [doc, ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        doc: next,
        selection: next.objects.some((o) => o.id === state.selection)
          ? state.selection
          : null,
        past: [...state.past, doc],
        future: state.future.slice(1),
      };
    }
  }
}
