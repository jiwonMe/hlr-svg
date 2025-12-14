# hlr-svg

TypeScript로 작성된 **3D → 2D SVG(Bezier) 렌더러**입니다.

- **입력**: `Scene(primitives, camera)`
- **출력**: SVG 문자열 (`<path d="M ... C ...">`만 사용)
- **HLR/HCR**: 가시 구간은 **실선**, 비가시 구간은 **점선(`stroke-dasharray`)**
- **곡선 분할**: “전체를 통째로 점선”이 아니라, **가시성이 바뀌는 지점에서만 베지어를 분할**
- **교선**: 곡면×곡면, 곡면×평면, plane×cube, cube×cube 등 **교선을 생성하고 베지어로 출력**

## 빠른 시작

### 1) CLI(정적 SVG 생성)

```bash
cd /Users/jiwon/Workspace/jiwonme/hlr-svg
npm install
npm run build

# 단일 케이스 출력
node dist/demo/main.js --case "Intersection: Cone × Cone (with HLR)" > conxcone.svg

# 전체 케이스를 HTML로 출력
node dist/demo/main.js --all > demo.html
```

### 2) Web demo(React + Vite)

web demo는 런타임(드래그/애니메이션/POV 슬라이더/스타일 패널)을 포함합니다.

```bash
cd /Users/jiwon/Workspace/jiwonme/hlr-svg
npm install
npm run build
npm run web:dev
```

> web은 `dist/`를 import해서 렌더링합니다.  
> TS 소스 변경 후에는 `npm run build`로 `dist/`를 갱신해야 web에서 반영됩니다.

## 디렉토리 안내(도메인 지식 문서)

- `src/hlr/README.md`: **가시성 판정 / 베지어 분할(HLR/HCR)** 설계와 epsilon 전략
- `src/curves/README.md`: **3D cubic 베지어**, 원/원호→cubic 변환, **구/원기둥/원뿔 실루엣**
- `src/scene/intersections/README.md`: **교선 생성(곡면×곡면/평면×곡면/plane×cube/cube×cube)** + 베지어 피팅


