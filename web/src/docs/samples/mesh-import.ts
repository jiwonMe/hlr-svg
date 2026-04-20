import {
  Camera,
  Scene,
  SvgRenderer,
  parseObj,
  parseStl,
  Vec3,
} from "hlr";

async function renderUploadedMesh(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const imported = file.name.toLowerCase().endsWith(".stl")
    ? parseStl(bytes)
    : parseObj(bytes);

  const scene = new Scene(imported.meshes);
  const camera = Camera.from({
    kind: "perspective",
    position: new Vec3(4, 3, 5),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (50 * Math.PI) / 180,
    aspect: 16 / 9,
    near: 0.1,
    far: 100,
  });

  const renderer = new SvgRenderer({
    width: 960,
    height: 540,
    include: {
      intersections: false,
      meshEdges: true,
    },
    mesh: {
      creaseAngleDeg: 30,
    },
  });

  return renderer.render(scene, camera);
}

void renderUploadedMesh;
