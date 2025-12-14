# intersections(교선) 설계 노트

이 디렉토리는 서로 다른 프리미티브가 겹칠 때 생기는 **교선(intersection curve)**을 만들고,
이를 **cubic 베지어**로 출력하기 위한 모듈들입니다.

교선은 HLR/HCR과 결합되어 “실선/점선”으로 렌더됩니다.

관련 파일:
- `intersectionCurves.ts`: 교선 생성 오케스트레이션(전체 primitive pair 스캔)
- `pairs.ts`: 곡면×곡면 교선(sphere/cylinder/cone 조합)
- `planeSurfaceCurves.ts`: 평면(PlaneRect/Disk) × 곡면 교선
- `capDisks.ts`: 캡(림)을 Disk로 파생하고 Disk×Disk 처리(공면 시 마커)
- `diskPlaneRect.ts`: Disk(림) × PlaneRect 교선
- `planeRectBoxAabb.ts`: PlaneRect × BoxAabb 교선
- `boxBoxAabb.ts`: BoxAabb × BoxAabb 교선(면×면 방식)
- `bezierFit.ts`: polyline → cubic 베지어 피팅(Schneider 알고리즘 기반)
- `math.ts`: 2차방정식, 축기저(basis), 분기(branch) 정렬, 점프 분할 등 유틸

## 1) “OwnedIntersectionCubic3”가 필요한 이유

교선은 보통 **교차하는 두 프리미티브 표면 위**에 존재합니다.
그래서 HLR 레이캐스트가 교선 점을 검사할 때,
교선의 ‘참여 프리미티브’에서 발생한 “근접 hit”가
가림으로 오해되어 실선이 점선으로 바뀌는 문제가 생길 수 있습니다.

이를 해결하려고 교선은 단순히 `CubicBezier3[]`가 아니라:

```ts
{ bez: CubicBezier3; ignorePrimitiveIds: readonly string[] }
```

형태로도 생성합니다(`intersectionCurvesToOwnedCubics`).

HLR 단계에서는 이 `ignorePrimitiveIds`를 `Scene.visibleAtPoint`로 전달하여,
**“교선 아주 근처 hit”만 완화**합니다.

> 전체 프리미티브를 통째로 무시하면 진짜 self-occlusion까지 풀려버리므로  
> “근접 hit” 조건과 함께 쓰는 게 중요합니다. (`src/hlr/README.md` 참고)

## 2) 곡면×곡면 교선: 각도 매개화 + 방정식 풀이

예: Cylinder×Cylinder, Cylinder×Cone, Cone×Cone 등은
한쪽 표면을 각도 θ로 매개화하고, 다른 쪽 제약을 풀어
특정 θ에 대한 해(높이/길이)를 구하는 방식으로 점을 샘플링합니다.

결과는 polyline(점열)로 생성되며:
- 교선이 두 갈래(branch)일 수 있어 분기를 따로 누적
- 불연속(점프)이 있으면 run을 나눔(`splitRunsByJump`)

## 3) 평면×곡면 교선

PlaneRect/Disk 같은 평면은:
- Sphere: 교선이 원(또는 점)
- Cylinder/Cone: θ를 샘플링하고 평면 방정식으로 높이를 결정

특히 Disk/PlaneRect처럼 “유한 영역”인 경우:
- 샘플링 후 inside(영역 포함)으로 잘라 run을 만들고
- 피팅으로 cubic화합니다.

## 4) Disk(림) 관련

원기둥/원뿔의 캡(림)은 교선 계산을 위해 Disk로 파생합니다.
이렇게 하면:
- Disk×Disk: 두 평면의 교선 직선을 각 원으로 클리핑 → 선분
- 공면(coplanar) Disk×Disk: 교점(0/1/2)을 찾아 **마커(십자 선분)**로 출력

## 5) PlaneRect×BoxAabb, BoxAabb×BoxAabb

### 5.1) PlaneRect×BoxAabb

박스의 12 edge를 plane과 교차시켜 교점들을 모읍니다.
그 후:
- 점을 정렬해 폴리곤(또는 선분)처럼 연결
- PlaneRect의 (u,v) 바운드로 클리핑
- 결과는 선분 cubic들로 출력

“박스 edge가 plane과 공면(coplanar)”인 경우도 있으므로,
공면 edge는 별도로 클리핑 후 출력합니다.

### 5.2) BoxAabb×BoxAabb

각 박스를 6개의 face PlaneRect로 바꾼 뒤,
face×face(PlaneRect×PlaneRect) 교선을 전부 계산합니다.

장점:
- 구현이 단순하고 재사용이 큼(PlaneRect×PlaneRect를 재활용)
단점:
- 중복 세그먼트가 생길 수 있어, 추후 dedupe가 필요할 수 있음

## 6) polyline → cubic 베지어 피팅

교선은 점열로 얻는 경우가 많기 때문에,
“점선 표현을 위해” 최종 출력은 line segment가 아니라
**cubic 베지어 곡선**이어야 합니다.

`bezierFit.ts`는 Schneider의 fitting 알고리즘을 기반으로:
- chord-length parameterization
- least squares로 핸들 길이(alpha) 추정
- Newton reparameterize로 오차 개선
- 오차가 크면 분할 재귀

현실적인 문제(overshoot/튀는 곡선)를 줄이기 위해:
- 핸들 길이를 세그먼트 길이 기반으로 clamp
- endpoint tangent를 여러 점 평균으로 안정화

## 7) 튜닝 가이드

교선이 흔들리거나 visibility가 불안정하면 보통 두 원인입니다.

- **교선 샘플링 품질 문제**: N(각도 샘플), denom 임계값, inside 판정 등
- **피팅 오차 문제**: `maxError`가 커서 표면 안/밖으로 새는 경우

해결은 보통:
- 샘플 증가 + jump split 강화
- `maxError`를 줄여 표면을 더 잘 따라가게 하기
- HLR eps/snap 튜닝(근접 hit 오해 방지)


