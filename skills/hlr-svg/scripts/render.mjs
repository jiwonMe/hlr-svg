#!/usr/bin/env node
// Renders a JSON scene description to a hidden-line SVG.
//
//   node render.mjs scene.json -o figure.svg
//   cat scene.json | node render.mjs - > figure.svg
//
// The scene format is documented in ../references/scene-format.md.
// Only Node's built-in modules and the bundled library (./hlr.mjs) are used.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  BoxAabb,
  Camera,
  Cone,
  Csg,
  Cylinder,
  Disk,
  OrientedBox,
  PlaneRect,
  Scene,
  Sphere,
  SvgRenderer,
  TriangleMesh,
  Vec3,
  circleToCubics3,
  lineToCubic3,
  parseObj,
  parseStl,
} from "./hlr.mjs";

const DEG = Math.PI / 180;

const VIEWS = {
  isometric: [1, 1, 1],
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
};

const STYLE_KEYS = [
  "strokeVisible",
  "strokeHidden",
  "strokeWidthVisible",
  "strokeWidthHidden",
  "dashArrayHidden",
  "opacityHidden",
  "lineCap",
  "lineJoin",
];

const INCLUDE_KEYS = [
  "silhouettes",
  "rims",
  "borders",
  "boxEdges",
  "meshEdges",
  "csg",
  "intersections",
];

/** An error in the scene description. Its message names the offending field. */
export class SceneError extends Error {}

// ---------------------------------------------------------------- validation

function fail(path, message) {
  throw new SceneError(`${path}: ${message}`);
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function num(obj, key, path, fallback) {
  const v = obj[key];
  if (v === undefined) {
    if (fallback === undefined) fail(`${path}.${key}`, "is required");
    return fallback;
  }
  if (typeof v !== "number" || !Number.isFinite(v))
    fail(`${path}.${key}`, `must be a finite number, got ${JSON.stringify(v)}`);
  return v;
}

function positive(obj, key, path, fallback) {
  const v = num(obj, key, path, fallback);
  if (!(v > 0)) fail(`${path}.${key}`, `must be greater than 0, got ${v}`);
  return v;
}

function vec(obj, key, path, fallback) {
  const v = obj[key];
  if (v === undefined) {
    if (fallback === undefined) fail(`${path}.${key}`, "is required");
    return new Vec3(fallback[0], fallback[1], fallback[2]);
  }
  if (
    !Array.isArray(v) ||
    v.length !== 3 ||
    !v.every((x) => typeof x === "number" && Number.isFinite(x))
  )
    fail(`${path}.${key}`, `must be [x, y, z], got ${JSON.stringify(v)}`);
  return new Vec3(v[0], v[1], v[2]);
}

function direction(obj, key, path, fallback) {
  const v = vec(obj, key, path, fallback);
  if (Vec3.len(v) < 1e-12) fail(`${path}.${key}`, "must not be zero");
  return v;
}

function oneOf(obj, key, path, options, fallback) {
  const v = obj[key] ?? fallback;
  if (!options.includes(v))
    fail(
      `${path}.${key}`,
      `must be one of ${options.map((o) => JSON.stringify(o)).join(", ")}, got ${JSON.stringify(v)}`,
    );
  return v;
}

function pick(obj, keys, path) {
  if (obj === undefined) return undefined;
  if (!isObject(obj)) fail(path, "must be an object");
  for (const k of Object.keys(obj))
    if (!keys.includes(k))
      fail(`${path}.${k}`, `is not a known key (known: ${keys.join(", ")})`);
  return obj;
}

// ----------------------------------------------------------------- geometry

const TYPES = [
  "sphere",
  "cylinder",
  "cone",
  "box",
  "plane",
  "disk",
  "csg",
  "mesh",
];

/** Points that bound an object on screen, plus a padding radius each. */
function circlePoints(center, normal, radius, n = 16) {
  return circleToCubics3({
    center,
    normal,
    radius,
    maxSegmentAngleRad: (2 * Math.PI) / n,
  }).map((b) => b.p0);
}

function boxCorners(center, axes, half) {
  const out = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        out.push(
          Vec3.add(
            center,
            Vec3.add(
              Vec3.mulScalar(axes[0], sx * half[0]),
              Vec3.add(
                Vec3.mulScalar(axes[1], sy * half[1]),
                Vec3.mulScalar(axes[2], sz * half[2]),
              ),
            ),
          ),
        );
  return out;
}

/**
 * Builds one primitive. Returns { primitives, extent } where extent is a list
 * of { p, pad } used for automatic framing.
 */
function buildObject(o, path, ctx) {
  if (!isObject(o)) fail(path, "must be an object");
  const type = o.type;
  if (!TYPES.includes(type))
    fail(
      `${path}.type`,
      `must be one of ${TYPES.join(", ")}, got ${JSON.stringify(type)}`,
    );
  const id = o.id === undefined ? `${type}-${ctx.nextId++}` : String(o.id);
  if (ctx.ids.has(id)) fail(`${path}.id`, `duplicate id ${JSON.stringify(id)}`);
  ctx.ids.add(id);

  switch (type) {
    case "sphere": {
      const center = vec(o, "center", path, [0, 0, 0]);
      const radius = positive(o, "radius", path, 1);
      return {
        primitive: new Sphere(id, center, radius),
        extent: [{ p: center, pad: radius }],
      };
    }
    case "cylinder": {
      const base = vec(o, "base", path, [0, 0, 0]);
      const axis = Vec3.normalize(direction(o, "axis", path, [0, 1, 0]));
      const height = positive(o, "height", path, 1);
      const radius = positive(o, "radius", path, 0.5);
      const caps =
        o.caps === false
          ? "none"
          : o.caps === true
            ? "both"
            : oneOf(o, "caps", path, ["both", "none"], "both");
      const top = Vec3.add(base, Vec3.mulScalar(axis, height));
      return {
        primitive: new Cylinder(id, base, axis, height, radius, caps),
        extent: [
          ...circlePoints(base, axis, radius),
          ...circlePoints(top, axis, radius),
        ].map((p) => ({ p, pad: 0 })),
      };
    }
    case "cone": {
      const apex = vec(o, "apex", path, [0, 1, 0]);
      const axis = Vec3.normalize(direction(o, "axis", path, [0, -1, 0]));
      const height = positive(o, "height", path, 1);
      const radius = positive(o, "radius", path, 0.5);
      const cap =
        o.cap === false
          ? "none"
          : o.cap === true
            ? "base"
            : oneOf(o, "cap", path, ["base", "none"], "base");
      const baseCenter = Vec3.add(apex, Vec3.mulScalar(axis, height));
      return {
        primitive: new Cone(id, apex, axis, height, radius, cap),
        extent: [apex, ...circlePoints(baseCenter, axis, radius)].map((p) => ({
          p,
          pad: 0,
        })),
      };
    }
    case "box": {
      let center, half;
      if (o.min !== undefined || o.max !== undefined) {
        if (o.center !== undefined || o.size !== undefined)
          fail(path, "give either min/max or center/size, not both");
        const min = vec(o, "min", path);
        const max = vec(o, "max", path);
        if (!(max.x > min.x && max.y > min.y && max.z > min.z))
          fail(`${path}.max`, "must be greater than min on every axis");
        center = Vec3.mulScalar(Vec3.add(min, max), 0.5);
        half = Vec3.mulScalar(Vec3.sub(max, min), 0.5);
      } else {
        center = vec(o, "center", path, [0, 0, 0]);
        const size = vec(o, "size", path, [1, 1, 1]);
        if (!(size.x > 0 && size.y > 0 && size.z > 0))
          fail(`${path}.size`, "must be positive on every axis");
        half = Vec3.mulScalar(size, 0.5);
      }
      const rotated = o.axisX !== undefined || o.axisY !== undefined;
      if (!rotated) {
        return {
          primitive: new BoxAabb(
            id,
            Vec3.sub(center, half),
            Vec3.add(center, half),
          ),
          extent: boxCorners(
            center,
            [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)],
            [half.x, half.y, half.z],
          ).map((p) => ({ p, pad: 0 })),
        };
      }
      const axisX = direction(o, "axisX", path, [1, 0, 0]);
      const axisY = direction(o, "axisY", path, [0, 1, 0]);
      const x = Vec3.normalize(axisX);
      const yRaw = Vec3.sub(axisY, Vec3.mulScalar(x, Vec3.dot(axisY, x)));
      if (Vec3.len(yRaw) < 1e-9)
        fail(`${path}.axisY`, "must not be parallel to axisX");
      const y = Vec3.normalize(yRaw);
      const box = new OrientedBox(id, center, half, x, y);
      return {
        primitive: box,
        extent: boxCorners(
          center,
          [x, y, Vec3.cross(x, y)],
          [half.x, half.y, half.z],
        ).map((p) => ({ p, pad: 0 })),
      };
    }
    case "plane": {
      const center = vec(o, "center", path, [0, 0, 0]);
      const normal = direction(o, "normal", path, [0, 1, 0]);
      const n = Vec3.normalize(normal);
      const fallbackU = Math.abs(n.x) < 0.9 ? [1, 0, 0] : [0, 0, 1];
      const u = direction(o, "u", path, fallbackU);
      if (Vec3.len(Vec3.cross(u, n)) < 1e-9)
        fail(`${path}.u`, "must not be parallel to normal");
      const width = positive(o, "width", path, 2);
      const height = positive(o, "height", path, width);
      const plane = new PlaneRect(id, center, normal, u, width / 2, height / 2);
      return {
        primitive: plane,
        extent: [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map(([a, b]) => ({
          p: Vec3.add(
            center,
            Vec3.add(
              Vec3.mulScalar(plane.u, (a * width) / 2),
              Vec3.mulScalar(plane.v, (b * height) / 2),
            ),
          ),
          pad: 0,
        })),
      };
    }
    case "disk": {
      const center = vec(o, "center", path, [0, 0, 0]);
      const normal = direction(o, "normal", path, [0, 1, 0]);
      const radius = positive(o, "radius", path, 1);
      return {
        primitive: new Disk(id, center, normal, radius),
        extent: circlePoints(center, Vec3.normalize(normal), radius).map(
          (p) => ({ p, pad: 0 }),
        ),
      };
    }
    case "csg": {
      const op = oneOf(o, "op", path, ["union", "subtract", "intersect"]);
      const parts = [];
      for (const key of ["a", "b"]) {
        const child = o[key];
        if (!isObject(child)) fail(`${path}.${key}`, "must be a solid object");
        if (!["sphere", "cylinder", "cone", "box", "csg"].includes(child.type))
          fail(
            `${path}.${key}.type`,
            "a csg operand must be sphere, cylinder, cone, box or csg",
          );
        parts.push(buildObject(child, `${path}.${key}`, ctx));
      }
      // Subtraction never grows the solid: frame it by its first operand.
      const extent =
        op === "subtract"
          ? parts[0].extent
          : [...parts[0].extent, ...parts[1].extent];
      return {
        primitive: new Csg(id, op, parts[0].primitive, parts[1].primitive),
        extent,
      };
    }
    case "mesh":
      return buildMesh(o, path, id, ctx);
  }
  throw new Error("unreachable");
}

function buildMesh(o, path, id, ctx) {
  let vertices;
  let triangles;
  if (o.file !== undefined) {
    if (typeof o.file !== "string")
      fail(`${path}.file`, "must be a path string");
    const file = resolve(ctx.baseDir, o.file);
    const format =
      o.format ??
      (/\.stl$/i.test(file) ? "stl" : /\.obj$/i.test(file) ? "obj" : undefined);
    if (format !== "obj" && format !== "stl")
      fail(
        `${path}.format`,
        'must be "obj" or "stl" (could not tell from the file name)',
      );
    let bytes;
    try {
      bytes = readFileSync(file);
    } catch (err) {
      fail(`${path}.file`, `cannot read ${file}: ${err.message}`);
    }
    const model =
      format === "obj"
        ? parseObj(new Uint8Array(bytes))
        : parseStl(new Uint8Array(bytes));
    for (const w of model.warnings) ctx.warnings.push(`${path}: ${w}`);
    vertices = [];
    triangles = [];
    for (const m of model.meshes) {
      const offset = vertices.length;
      vertices.push(...m.vertices);
      for (const t of m.triangles)
        triangles.push([t[0] + offset, t[1] + offset, t[2] + offset]);
    }
  } else {
    if (!Array.isArray(o.vertices) || !Array.isArray(o.triangles))
      fail(path, 'needs either "file" or "vertices" and "triangles"');
    vertices = o.vertices.map((_, i) => vec(o.vertices, i, `${path}.vertices`));
    triangles = o.triangles.map((t, i) => {
      if (
        !Array.isArray(t) ||
        t.length !== 3 ||
        !t.every((k) => Number.isInteger(k) && k >= 0 && k < vertices.length)
      )
        fail(
          `${path}.triangles[${i}]`,
          `must be three vertex indices below ${vertices.length}`,
        );
      return t;
    });
  }
  if (triangles.length === 0) fail(path, "has no triangles");
  const scale = o.scale === undefined ? 1 : positive(o, "scale", path);
  const translate = vec(o, "translate", path, [0, 0, 0]);
  const moved = vertices.map((v) =>
    Vec3.add(Vec3.mulScalar(v, scale), translate),
  );
  const mesh = new TriangleMesh(id, moved, triangles);
  return { primitive: mesh, extent: moved.map((p) => ({ p, pad: 0 })) };
}

function buildCurves(spec, ctx) {
  const curves = [];
  const owned = [];
  const extent = [];
  const add = (list, on, path) => {
    if (on === undefined) {
      curves.push(...list);
      return;
    }
    if (!Array.isArray(on) || !on.every((x) => typeof x === "string"))
      fail(`${path}.on`, "must be a list of object ids");
    for (const id of on)
      if (!ctx.ids.has(id))
        fail(`${path}.on`, `unknown object id ${JSON.stringify(id)}`);
    for (const bez of list) owned.push({ bez, ignorePrimitiveIds: on });
  };
  (spec.lines ?? []).forEach((l, i) => {
    const path = `lines[${i}]`;
    if (!isObject(l)) fail(path, "must be an object");
    const pts =
      l.points !== undefined
        ? l.points.map((_, k) => vec(l.points, k, `${path}.points`))
        : [vec(l, "from", path), vec(l, "to", path)];
    if (pts.length < 2) fail(`${path}.points`, "needs at least two points");
    if (l.closed) pts.push(pts[0]);
    const list = [];
    for (let k = 0; k + 1 < pts.length; k++)
      list.push(lineToCubic3(pts[k], pts[k + 1]));
    add(list, l.on, path);
    extent.push(...pts.map((p) => ({ p, pad: 0 })));
  });
  (spec.circles ?? []).forEach((c, i) => {
    const path = `circles[${i}]`;
    if (!isObject(c)) fail(path, "must be an object");
    const center = vec(c, "center", path);
    const normal = Vec3.normalize(direction(c, "normal", path, [0, 1, 0]));
    const radius = positive(c, "radius", path);
    const start = num(c, "startDeg", path, 0) * DEG;
    const end = num(c, "endDeg", path, 360) * DEG;
    const list = circleToCubics3({
      center,
      normal,
      radius,
      startAngleRad: start,
      endAngleRad: end,
      maxSegmentAngleRad: Math.PI / 8,
    });
    add(list, c.on, path);
    extent.push(
      ...list.flatMap((b) => [b.p0, b.p3]).map((p) => ({ p, pad: 0 })),
    );
  });
  return { curves, owned, extent };
}

// ------------------------------------------------------------------- camera

function resolveCamera(spec, extent, width, height) {
  const c = pick(
    spec.camera ?? {},
    [
      "projection",
      "view",
      "azimuth",
      "elevation",
      "direction",
      "position",
      "target",
      "up",
      "fov",
      "zoom",
      "halfHeight",
      "distance",
      "margin",
    ],
    "camera",
  );
  const projection = oneOf(
    c,
    "projection",
    "camera",
    ["orthographic", "perspective"],
    "orthographic",
  );
  const up = Vec3.normalize(direction(c, "up", "camera", [0, 1, 0]));
  const aspect = width / height;

  let dir;
  if (c.position !== undefined) {
    if (c.target === undefined)
      fail("camera.target", "is required when camera.position is given");
    dir = Vec3.sub(vec(c, "position", "camera"), vec(c, "target", "camera"));
    if (Vec3.len(dir) < 1e-12)
      fail("camera.position", "must differ from camera.target");
  } else if (c.direction !== undefined) {
    dir = direction(c, "direction", "camera");
  } else if (c.azimuth !== undefined || c.elevation !== undefined) {
    const az = num(c, "azimuth", "camera", 45) * DEG;
    const el = num(c, "elevation", "camera", 30) * DEG;
    dir = new Vec3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    );
  } else {
    const view = oneOf(c, "view", "camera", Object.keys(VIEWS), "isometric");
    dir = new Vec3(...VIEWS[view]);
  }
  dir = Vec3.normalize(dir);
  // Looking straight along `up` leaves the roll undefined: pick another up.
  // A top view (y up) then shows -z at the top of the picture, like a plan.
  let upv = up;
  if (Vec3.len(Vec3.cross(dir, upv)) < 1e-6)
    upv =
      Math.abs(dir.y) > 0.5
        ? new Vec3(0, 0, -Math.sign(dir.y))
        : new Vec3(0, 1, 0);
  const right = Vec3.normalize(Vec3.cross(upv, dir));
  const screenUp = Vec3.cross(dir, right);

  // Frame the scene: extents of every bounding point on the view plane.
  const pts = extent.length > 0 ? extent : [{ p: new Vec3(0, 0, 0), pad: 1 }];
  let cx = 0,
    cy = 0,
    cz = 0;
  for (const { p } of pts) {
    cx += p.x;
    cy += p.y;
    cz += p.z;
  }
  const centroid = new Vec3(cx / pts.length, cy / pts.length, cz / pts.length);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    radius = 0;
  for (const { p, pad } of pts) {
    const d = Vec3.sub(p, centroid);
    const x = Vec3.dot(d, right);
    const y = Vec3.dot(d, screenUp);
    minX = Math.min(minX, x - pad);
    maxX = Math.max(maxX, x + pad);
    minY = Math.min(minY, y - pad);
    maxY = Math.max(maxY, y + pad);
    radius = Math.max(radius, Vec3.len(d) + pad);
  }
  radius = Math.max(radius, 1e-6);

  let target;
  if (c.target !== undefined) target = vec(c, "target", "camera");
  else
    target = Vec3.add(
      centroid,
      Vec3.add(
        Vec3.mulScalar(right, (minX + maxX) / 2),
        Vec3.mulScalar(screenUp, (minY + maxY) / 2),
      ),
    );

  // Half extents about the target, so a user target still keeps everything in frame.
  const t = Vec3.sub(target, centroid);
  const tx = Vec3.dot(t, right);
  const ty = Vec3.dot(t, screenUp);
  const halfX = Math.max(maxX - tx, tx - minX);
  const halfY = Math.max(maxY - ty, ty - minY);
  const margin = num(c, "margin", "camera", 1.12);
  const zoom = positive(c, "zoom", "camera", 1);
  const fitHalfHeight = (Math.max(halfY, halfX / aspect, 1e-6) * margin) / zoom;
  const reach = radius + Vec3.len(t);

  if (projection === "orthographic") {
    const halfHeight =
      c.halfHeight === undefined
        ? fitHalfHeight
        : positive(c, "halfHeight", "camera");
    const dist =
      c.position !== undefined
        ? Vec3.len(Vec3.sub(vec(c, "position", "camera"), target))
        : reach * 4 + 1;
    const position = Vec3.add(target, Vec3.mulScalar(dir, dist));
    return {
      camera: Camera.from({
        kind: "orthographic",
        position,
        target,
        up: upv,
        halfHeight,
        aspect,
        near: Math.max(dist - reach * 2, dist * 1e-3),
        far: dist + reach * 2,
      }),
      dir,
      summary: `orthographic, halfHeight ${halfHeight.toFixed(3)}`,
      reach,
    };
  }

  const fov = num(c, "fov", "camera", 35);
  if (!(fov > 1 && fov < 170))
    fail("camera.fov", `must be between 1 and 170 degrees, got ${fov}`);
  const tanHalf = Math.tan((fov * DEG) / 2);
  let dist;
  if (c.position !== undefined)
    dist = Vec3.len(Vec3.sub(vec(c, "position", "camera"), target));
  else if (c.distance !== undefined) dist = positive(c, "distance", "camera");
  else dist = fitHalfHeight / tanHalf + radius;
  const position = Vec3.add(target, Vec3.mulScalar(dir, dist));
  return {
    camera: Camera.from({
      kind: "perspective",
      position,
      target,
      up: upv,
      fovYRad: fov * DEG,
      aspect,
      near: Math.max(dist - reach * 2, dist * 1e-3, 1e-4),
      far: dist + reach * 2,
    }),
    dir,
    summary: `perspective, fov ${fov}°, distance ${dist.toFixed(3)}`,
    reach,
  };
}

// ------------------------------------------------------------------ overlays

function escapeXml(s) {
  return String(s).replace(
    /[<>&"']/g,
    (ch) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[ch],
  );
}

function fmt(n) {
  return String(Math.round(n * 100) / 100);
}

function overlays(spec, ctx, scene, camera, width, height, style, reach) {
  const points = spec.points ?? [];
  const labels = spec.labels ?? [];
  if (!Array.isArray(points)) fail("points", "must be a list");
  if (!Array.isArray(labels)) fail("labels", "must be a list");
  if (points.length === 0 && labels.length === 0) return "";

  const ls = pick(
    spec.labelStyle ?? {},
    ["fontFamily", "fontSize", "fontStyle", "color", "halo"],
    "labelStyle",
  );
  const fontFamily = ls.fontFamily ?? "'Times New Roman', Times, serif";
  const fontSize = positive(ls, "fontSize", "labelStyle", 16);
  const fontStyle = ls.fontStyle ?? "italic";
  const color = ls.color ?? style.strokeVisible ?? "black";
  const halo = ls.halo ?? "white";

  const raycast = scene.toRaycastScene(camera);
  const eps = reach * 1e-4;
  const out = [];
  const text = (x, y, value, anchor) =>
    `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" dominant-baseline="middle" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-style="${escapeXml(fontStyle)}" fill="${escapeXml(color)}"` +
    (halo === "none" || halo === false
      ? ""
      : ` stroke="${escapeXml(halo)}" stroke-width="3" paint-order="stroke"`) +
    `>${escapeXml(value)}</text>`;

  points.forEach((pt, i) => {
    const path = `points[${i}]`;
    if (!isObject(pt)) fail(path, "must be an object");
    const at = vec(pt, "at", path);
    const r = positive(pt, "radius", path, 2.5);
    const ignore = pt.on ?? [];
    if (!Array.isArray(ignore))
      fail(`${path}.on`, "must be a list of object ids");
    for (const id of ignore)
      if (!ctx.ids.has(id))
        fail(`${path}.on`, `unknown object id ${JSON.stringify(id)}`);
    const visible = raycast.visibleAtPoint(at, {
      eps,
      ignorePrimitiveIds: ignore,
    });
    const s = camera.projectToSvg(at, width, height);
    out.push(
      visible
        ? `<circle cx="${fmt(s.x)}" cy="${fmt(s.y)}" r="${r}" fill="${escapeXml(color)}" />`
        : `<circle cx="${fmt(s.x)}" cy="${fmt(s.y)}" r="${r}" fill="white" stroke="${escapeXml(color)}" stroke-width="1" opacity="${style.opacityHidden ?? 0.5}" />`,
    );
    if (pt.label !== undefined) {
      const [dx, dy] = offset(pt, path, [8, -10]);
      out.push(
        text(
          s.x + dx,
          s.y + dy,
          pt.label,
          dx < -1 ? "end" : dx > 1 ? "start" : "middle",
        ),
      );
    }
  });
  labels.forEach((l, i) => {
    const path = `labels[${i}]`;
    if (!isObject(l)) fail(path, "must be an object");
    if (l.text === undefined) fail(`${path}.text`, "is required");
    const s = camera.projectToSvg(vec(l, "at", path), width, height);
    const [dx, dy] = offset(l, path, [0, 0]);
    out.push(
      text(
        s.x + dx,
        s.y + dy,
        l.text,
        oneOf(l, "anchor", path, ["start", "middle", "end"], "middle"),
      ),
    );
  });
  return `<g class="hlr-annotations">${out.join("")}</g>`;
}

function offset(o, path, fallback) {
  if (o.offset === undefined) return fallback;
  if (
    !Array.isArray(o.offset) ||
    o.offset.length !== 2 ||
    !o.offset.every(Number.isFinite)
  )
    fail(`${path}.offset`, "must be [dx, dy] in pixels");
  return o.offset;
}

// -------------------------------------------------------------------- render

const TOP_KEYS = [
  "$schema",
  "title",
  "width",
  "height",
  "camera",
  "background",
  "style",
  "hiddenLines",
  "include",
  "quality",
  "objects",
  "lines",
  "circles",
  "points",
  "labels",
  "labelStyle",
];

const QUALITY = {
  draft: { samples: 96, refineIters: 16, angularSamples: 96 },
  normal: { samples: 192, refineIters: 22, angularSamples: 160 },
  high: { samples: 384, refineIters: 26, angularSamples: 256 },
};

/**
 * Renders a parsed scene description. `baseDir` resolves mesh file paths.
 * Returns { svg, stats, warnings }. Throws SceneError for an invalid scene.
 */
export function renderScene(
  spec,
  { baseDir = process.cwd(), width: w, height: h } = {},
) {
  if (!isObject(spec)) fail("scene", "must be a JSON object");
  pick(spec, TOP_KEYS, "scene");
  const width = w ?? positive(spec, "width", "scene", 800);
  const height = h ?? positive(spec, "height", "scene", 600);

  const ctx = { ids: new Set(), nextId: 1, warnings: [], baseDir };
  if (!Array.isArray(spec.objects))
    fail("objects", "must be a list of objects (it can be empty)");
  const built = spec.objects.map((o, i) =>
    buildObject(o, `objects[${i}]`, ctx),
  );
  const { curves, owned, extent: curveExtent } = buildCurves(spec, ctx);
  const pointExtent = [...(spec.points ?? []), ...(spec.labels ?? [])]
    .filter((p) => isObject(p) && Array.isArray(p.at) && p.at.length === 3)
    .map((p) => ({ p: new Vec3(p.at[0], p.at[1], p.at[2]), pad: 0 }));
  const extent = [
    ...built.flatMap((b) => b.extent),
    ...curveExtent,
    ...pointExtent,
  ];
  if (built.length === 0 && curves.length === 0 && owned.length === 0)
    fail(
      "objects",
      "the scene is empty: add at least one object, line or circle",
    );

  const { camera, summary, reach } = resolveCamera(spec, extent, width, height);

  const style = { ...(pick(spec.style, STYLE_KEYS, "style") ?? {}) };
  const include = pick(spec.include, INCLUDE_KEYS, "include");
  const quality = oneOf(
    spec,
    "quality",
    "scene",
    Object.keys(QUALITY),
    "normal",
  );
  const q = QUALITY[quality];
  const background = spec.background ?? true;
  if (typeof background !== "boolean" && typeof background !== "string")
    fail("background", "must be true, false or a CSS colour");

  const scene = new Scene(built.map((b) => b.primitive));
  const renderer = new SvgRenderer({
    width,
    height,
    background: background !== false,
    style,
    include,
    hlr: { samples: q.samples, refineIters: q.refineIters },
    intersections: { angularSamples: q.angularSamples },
  });
  let svg = renderer.render(scene, camera, { curves, ownedCurves: owned });

  // Edges seen end-on project to a single point: drop those paths.
  svg = svg.replace(/<path d="([^"]*)"[^>]*\/>/g, (whole, d) =>
    new Set(d.match(/-?[\d.]+ -?[\d.]+/g)).size > 1 ? whole : "",
  );
  if (spec.hiddenLines === false)
    svg = svg.replace(/<path [^>]*stroke-dasharray="[^"]*"[^>]*\/>/g, "");
  if (typeof background === "string")
    svg = svg.replace(
      '<rect width="100%" height="100%" fill="white" />',
      `<rect width="100%" height="100%" fill="${escapeXml(background)}" />`,
    );
  const extra = overlays(
    spec,
    ctx,
    scene,
    camera,
    width,
    height,
    { strokeVisible: "black", opacityHidden: 0.5, ...style },
    reach,
  );
  const head =
    spec.title === undefined ? "" : `<title>${escapeXml(spec.title)}</title>`;
  svg = svg
    .replace(/^(<svg [^>]*>)/, `$1${head}`)
    .replace(/<\/svg>$/, `${extra}</svg>`);

  const visiblePaths = (
    svg.match(/<path (?![^>]*stroke-dasharray)[^>]*\/>/g) ?? []
  ).length;
  const hiddenPaths = (svg.match(/<path [^>]*stroke-dasharray[^>]*\/>/g) ?? [])
    .length;
  return {
    svg,
    stats: {
      width,
      height,
      objects: built.length,
      visiblePaths,
      hiddenPaths,
      camera: summary,
    },
    warnings: ctx.warnings,
  };
}

// ----------------------------------------------------------------------- CLI

const HELP = `Usage: node render.mjs <scene.json | -> [options]

Renders a JSON scene of 3D solids to an SVG line drawing with hidden lines
dashed (or removed). Reads stdin when the scene is "-".

Options:
  -o, --out <file.svg>   Write the SVG to a file (default: stdout)
  --width <px>           Override the scene width
  --height <px>          Override the scene height
  -q, --quiet            Do not print the summary line
  -h, --help             Show this help

Scene format: references/scene-format.md next to this script's folder.
Example:
  echo '{"objects":[{"type":"sphere","radius":1},{"type":"plane","normal":[0,1,0],"width":3}]}' | node render.mjs - -o out.svg`;

function parseArgs(argv) {
  const args = { input: undefined, out: undefined, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new SceneError(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-o" || a === "--out") args.out = value();
    else if (a === "--width" || a === "--height") {
      const n = Number(value());
      if (!(n > 0)) throw new SceneError(`${a} must be a positive number`);
      args[a.slice(2)] = n;
    } else if (a === "-q" || a === "--quiet") args.quiet = true;
    else if (a === "-" || !a.startsWith("-")) {
      if (args.input !== undefined)
        throw new SceneError(`unexpected argument ${a}`);
      args.input = a;
    } else throw new SceneError(`unknown option ${a} (see --help)`);
  }
  return args;
}

export function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`error: ${err.message}`);
    return 2;
  }
  if (args.help || args.input === undefined) {
    (args.help ? console.log : console.error)(HELP);
    return args.help ? 0 : 2;
  }
  const fromStdin = args.input === "-";
  let text;
  try {
    text = readFileSync(fromStdin ? 0 : args.input, "utf8");
  } catch (err) {
    console.error(`error: cannot read ${args.input}: ${err.message}`);
    return 1;
  }
  let spec;
  try {
    spec = JSON.parse(text);
  } catch (err) {
    console.error(
      `error: ${fromStdin ? "stdin" : args.input} is not valid JSON: ${err.message}`,
    );
    return 1;
  }
  try {
    const baseDir = fromStdin ? process.cwd() : dirname(resolve(args.input));
    const { svg, stats, warnings } = renderScene(spec, {
      baseDir,
      width: args.width,
      height: args.height,
    });
    for (const w of warnings) console.error(`warning: ${w}`);
    if (args.out) writeFileSync(args.out, svg + "\n");
    else process.stdout.write(svg + "\n");
    if (!args.quiet)
      console.error(
        `${args.out ? `wrote ${args.out}` : "rendered"}: ${stats.width}x${stats.height}, ${stats.objects} objects, ` +
          `${stats.visiblePaths} visible / ${stats.hiddenPaths} hidden paths (${stats.camera})`,
      );
    return 0;
  } catch (err) {
    if (err instanceof SceneError) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = main(process.argv.slice(2));
}

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
