import React, { createRef } from "react";

import { Camera, Scene, Vec3, type GpuPreviewFrame } from "hlr";
import {
  GpuPreviewCanvas,
  GpuPreviewRenderer,
  WebglCanvas,
  WebglRenderer,
  type WebglCanvasHandle,
} from "hlr/webgl";

const canvasRef = createRef<WebglCanvasHandle>();

const scene = new Scene();
const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(3, 2, 4),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  fovYRad: Math.PI / 4,
  aspect: 1,
  near: 0.1,
  far: 100,
});

void scene;
void camera;
void WebglRenderer;
void GpuPreviewRenderer;

const previewFrame: GpuPreviewFrame = {
  width: 1,
  height: 1,
  background: false,
  style: {
    strokeVisible: "#000",
    strokeHidden: "#000",
    strokeWidthVisible: 1,
    strokeWidthHidden: 1,
    dashArrayHidden: "2 2",
    opacityHidden: 0.5,
    lineCap: "round",
    lineJoin: "round",
  },
  viewProj: new Float32Array(16),
  surfaces: [],
  lines: {
    vertices: new Float32Array(),
    indices: new Uint32Array(),
    segmentCount: 0,
  },
};

void React.createElement(WebglCanvas, {
  ref: canvasRef,
  snapshot: {
    width: 1,
    height: 1,
    background: false,
    style: {
      strokeVisible: "#000",
      strokeHidden: "#000",
      strokeWidthVisible: 1,
      strokeWidthHidden: 1,
      dashArrayHidden: "2 2",
      opacityHidden: 0.5,
      lineCap: "round",
      lineJoin: "round",
    },
    paths: [],
  },
});
void React.createElement(GpuPreviewCanvas, {
  frame: previewFrame,
});
