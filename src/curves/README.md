# curves(3D cubic 베지어 / 실루엣 / 원호) 설계 노트

이 디렉토리는 “출력은 무조건 SVG cubic(C)” 규칙을 만족시키기 위한 핵심 유틸을 담습니다.

관련 파일:
- `cubicBezier3.ts`: 3D cubic 베지어 평가/분할(de Casteljau)
- `builders.ts`: 선분/원/실루엣 등을 cubic 베지어로 구성하는 빌더들

## 1) 왜 모든 것을 cubic(C)로 통일하는가?

SVG path에서 `C`는 표현력이 가장 높고(곡선/직선 모두 가능),
HLR에서 “가시 구간만 분할”할 때도 **cubic split(de Casteljau)**가 안정적입니다.

- 직선: `p1, p2`를 선분 방향으로 배치하면 cubic으로 직선 표현 가능
- 원/원호: 1/4 원(90°)을 cubic 1개로 근사 가능 (일반적으로 4개로 full circle)

## 2) CubicBezier3: de Casteljau 평가/분할

`cubicBezier3.ts`는 아래 두 기능이 핵심입니다.

### 2.1) eval(t)

3D control points `p0,p1,p2,p3`에 대해,
de Casteljau(lerp 반복)로 `P(t)`를 계산합니다.

### 2.2) split(t)

동일한 de Casteljau 과정에서 중간 점들을 재사용해,
하나의 cubic을 `[0..t]`(left), `[t..1]`(right) 두 cubic으로 분할합니다.

HLR은 이 split을 전환점 t*에서 반복 호출해 “부분 점선”을 만듭니다.

## 3) 원/원호 → cubic 변환(기본 도구)

원 하나를 4개의 cubic으로 표현하는 전형적인 방법:
- 90° 원호의 cubic 근사에서
  - kappa = 4/3 * tan(π/8) ≈ 0.5522847498
를 사용합니다.

이 레포에서는 3D 원(중심+법선+반지름)을
2D 기저(u,v)로 펼친 뒤 3D로 다시 올려서 cubic들을 만듭니다.

## 4) 실루엣(Silhouette) 곡선

실루엣은 “가시/비가시 경계”에 해당하는 곡선으로,
HLR에서 가장 중요한 입력 곡선 중 하나입니다.

### 4.1) 구(Sphere) 실루엣

Perspective에서 구의 실루엣은 화면상 “원”으로 보이며,
중심/반지름은 카메라 위치에 따라 달라집니다(정확히는 원뿔 접선 조건).

코드에서는 “정확한 perspective 실루엣 원”을 구성해 cubic으로 변환합니다.

### 4.2) 원기둥(Cylinder) / 원뿔(Cone) 실루엣

원기둥/원뿔은 “모선(generator)”이 실루엣이 됩니다.

Perspective에서 단순히 viewDir만으로 계산하면 오차가 커질 수 있어,
카메라 위치와 축(또는 apex/axis) 기반의 기하로
실루엣이 되는 generator 방향을 구합니다.

> 결과적으로 실루엣 곡선 자체는 “선분 cubic”이지만,  
> HLR(가시성 분할)이 들어가면서 **부분 점선**이 정확히 표현됩니다.

## 5) 실무 튜닝 포인트

실루엣은 “기하적으로 정확”해도 HLR에서 흔들릴 수 있습니다.
대표 원인:
- 레이캐스트 eps가 너무 작아 self-hit가 빈번
- 샘플링이 너무 거칠어 전환점이 누락

해결은 보통:
- `src/hlr/README.md`의 eps 전략(snap/targetDist-eps) 조정
- `samples/refineIters` 증가


