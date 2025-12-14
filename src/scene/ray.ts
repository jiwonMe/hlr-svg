import { Vec3 } from "../math/vec3.js";

export type Ray = {
  origin: Vec3;
  dir: Vec3; // normalized recommended
};

export type Hit = {
  t: number; // distance along ray: origin + dir * t
  point: Vec3;
  normal: Vec3;
  primitiveId: string;
};


