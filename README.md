# hlr

TypeScript로 작성된 **3D → 2D SVG(Bezier) 렌더러**입니다.

- **입력**: `Scene`에 primitive를 `add()`로 추가 + `SvgRenderer.render(scene, camera)`
- **출력**: SVG 문자열 (`<path d="M ... C ...">`만 사용)
- **HLR/HCR**: 가시 구간은 **실선**, 비가시 구간은 **점선(`stroke-dasharray`)**
- **곡선 분할**: “전체를 통째로 점선”이 아니라, **가시성이 바뀌는 지점에서만 베지어를 분할**
- **교선**: 곡면×곡면, 곡면×평면, plane×cube, cube×cube 등 **교선을 생성하고 베지어로 출력**

## 빠른 시작

### 1) npm 설치

```bash
npm install hlr
```

### 2) 사용 예시(풀 스크립트)

```ts
import { Camera, Scene, SvgRenderer, Vec3, Sphere, Cylinder, Cone, BoxAabb } from "hlr";

const width = 800;
const height = 600;

const camera = Camera.from({
  kind: "perspective",
  position: new Vec3(3.2, 2.2, 4.5),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  fovYRad: (55 * Math.PI) / 180,
  aspect: width / height,
  near: 0.1,
  far: 100,
});

const scene = new Scene()
  .add(new Sphere("sphere", new Vec3(0, 0, 0), 1))
  .add(new Cylinder("cyl", new Vec3(-2.0, -1.0, -0.2), new Vec3(0, 1, 0), 2.2, 0.7, "both"))
  .add(new Cone("cone", new Vec3(1.8, -1.0, -0.3), new Vec3(0, 1, 0), 2.2, 0.9, "base"))
  .add(new BoxAabb("box", new Vec3(-0.8, -0.8, 1.4), new Vec3(0.6, 0.6, 2.8)));

const renderer = new SvgRenderer({
  width,
  height,
  background: true,
  style: {
    strokeWidthVisible: 1.8,
    strokeWidthHidden: 1.8,
    dashArrayHidden: "4 4",
    opacityHidden: 0.5,
    lineCap: "butt",
  },
});

const svg = renderer.render(scene, camera);
console.log(svg);
```

### 3) 커브를 추가로 얹기(선/원호/직접 만든 cubic)

```ts
import { Camera, Scene, SvgRenderer, Vec3, lineToCubic3 } from "hlr";

const renderer = new SvgRenderer({ width: 800, height: 600, background: true });

const svg = renderer.render(scene, camera, {
  curves: [lineToCubic3(new Vec3(-2, 0, 0), new Vec3(2, 0, 0))],
});
```

### 4) 레포에서 데모 실행(정적 SVG / Web)

> npm 패키지(`hlr`)에는 demo 코드가 포함되지 않습니다.  
> 데모는 이 저장소에서 실행하세요.

#### 4-1) CLI(정적 SVG 생성)

```bash
cd /Users/jiwon/Workspace/jiwonme/hlr-svg
npm install
npm run build

# 단일 케이스 출력
node dist/demo/main.js --case "Intersection: Cone × Cone (with HLR)" > conxcone.svg

# 전체 케이스를 HTML로 출력
node dist/demo/main.js --all > demo.html
```

#### 4-2) Web demo(React + Vite)

web demo는 런타임(드래그/애니메이션/POV 슬라이더/스타일 패널)을 포함합니다.

```bash
cd /Users/jiwon/Workspace/jiwonme/hlr-svg
npm install
npm run build
npm run web:dev
```

> web은 `dist/index.js`(라이브러리 엔트리)를 import해서 렌더링합니다.  
> TS 소스 변경 후에는 `npm run build`로 `dist/`를 갱신해야 web에서 반영됩니다.

## 디렉토리 안내(도메인 지식 문서)

- `src/hlr/README.md`: **가시성 판정 / 베지어 분할(HLR/HCR)** 설계와 epsilon 전략
- `src/curves/README.md`: **3D cubic 베지어**, 원/원호→cubic 변환, **구/원기둥/원뿔 실루엣**
- `src/scene/intersections/README.md`: **교선 생성(곡면×곡면/평면×곡면/plane×cube/cube×cube)** + 베지어 피팅


