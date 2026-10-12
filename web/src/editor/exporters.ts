import {
  parseDoc,
  parseView,
  type EditorDoc,
  type EditorObject,
  type SavedView,
} from "./model";

/* ── Share links ───────────────────────────────────────────────────────── */

export type SharedScene = { doc: EditorDoc; view?: SavedView };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A compact, URL-safe form of the scene: "z" + deflated JSON, or "j" + JSON. */
export async function encodeScene(shared: SharedScene): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(shared));
  if (typeof CompressionStream === "undefined") return `j${toBase64Url(bytes)}`;
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return `z${toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
}

export async function decodeScene(text: string): Promise<SharedScene | null> {
  try {
    const bytes = fromBase64Url(text.slice(1));
    let json: string;
    if (text[0] === "z") {
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      json = await new Response(stream).text();
    } else if (text[0] === "j") json = new TextDecoder().decode(bytes);
    else return null;
    const value = JSON.parse(json) as { doc?: unknown; view?: unknown };
    const doc = parseDoc(value.doc);
    if (!doc) return null;
    const view = parseView(value.view);
    return view ? { doc, view } : { doc };
  } catch {
    return null;
  }
}

/* ── Clipboard ─────────────────────────────────────────────────────────── */

const CLIPBOARD_TAG = "hlr-studio/objects";

export function clipboardText(
  objects: readonly EditorObject[],
  roots: readonly string[],
): string {
  return JSON.stringify({ type: CLIPBOARD_TAG, objects, roots });
}

/**
 * Objects from the clipboard. References must resolve inside the set, except
 * point rules: a copied point whose rule stays behind is pasted free.
 */
export function parseClipboard(
  text: string,
): { objects: EditorObject[]; roots: string[] } | null {
  try {
    const value = JSON.parse(text) as {
      type?: unknown;
      objects?: unknown;
      roots?: unknown;
    };
    if (value.type !== CLIPBOARD_TAG || !Array.isArray(value.objects))
      return null;
    const objects = value.objects as EditorObject[];
    // Check everything as a document with point rules set aside: a copied
    // point whose rule stays behind is pasted free, so its references may
    // lie outside the set.
    const checked = parseDoc({
      version: 1,
      objects: objects.map((o) =>
        o?.kind === "point" ? { ...o, constraint: undefined } : o,
      ),
    });
    if (!checked) return null;
    const roots = Array.isArray(value.roots)
      ? value.roots.filter((id): id is string => typeof id === "string")
      : [];
    return {
      objects: checked.objects.map((o, i) => {
        const original = objects[i];
        return o.kind === "point" &&
          original?.kind === "point" &&
          original.constraint
          ? { ...o, constraint: original.constraint }
          : o;
      }),
      roots,
    };
  } catch {
    return null;
  }
}

/* ── Images ────────────────────────────────────────────────────────────── */

let fontCss: Promise<string> | null = null;

/** The label font as an embedded @font-face, so a raster copy matches the screen. */
function embeddedFonts(): Promise<string> {
  fontCss ??= (async () => {
    const response = await fetch(
      `${import.meta.env.BASE_URL}fonts/BookkMyungjo-Lt.woff2`,
    );
    if (!response.ok) return "";
    const blob = await response.blob();
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return `@font-face{font-family:'Bookk Myungjo';src:url(${url.replace(/^data:[^;]*;/, "data:font/woff2;")}) format('woff2');font-weight:300 500;}`;
  })().catch(() => "");
  return fontCss;
}

/** Rasterises an SVG string at `scale` times its size on a white page. */
export async function svgToPng(svg: string, scale: number): Promise<Blob> {
  const width = Number(/\swidth="([\d.]+)"/.exec(svg)?.[1] ?? 960);
  const height = Number(/\sheight="([\d.]+)"/.exec(svg)?.[1] ?? 640);
  const css = await embeddedFonts();
  const source = css
    ? svg.replace(/<svg([^>]*)>/, (open) => `${open}<style>${css}</style>`)
    : svg;
  const url = URL.createObjectURL(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("png"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
