# HLR/HCR(가시/비가시 분할) 설계 노트

이 디렉토리는 3D 곡선을 2D로 “그리는 것”이 아니라, **어느 구간이 보이는지(HLR/HCR)**를 판단하고
**가시성이 바뀌는 지점에서만 베지어를 분할**하는 로직을 담습니다.

관련 파일:
- `visibilityCuts.ts`: cubic 위에서 “가시성 전환 t”를 찾음
- `splitByVisibility.ts`: 전환 t로 cubic을 잘라 `{ bez, visible }` 조각으로 반환

## 1) 핵심 아이디어: 점 단위 visibility + 곡선 분할

우리는 “곡선 전체가 보인다/안 보인다”가 아니라,
**곡선 위 특정 점 P(t)가 카메라에서 보이는지**를 반복해서 판단합니다.

1. cubic의 여러 t를 샘플링
2. `visible(t_i)`와 `visible(t_{i+1})`가 바뀌면 그 구간에 전환점이 있다고 가정
3. 그 구간을 bisection으로 refine해서 `t*`를 찾음
4. `t*`에서 cubic을 split (de Casteljau)

이 방식의 장점:
- 실루엣/원호/교선 같은 “긴 곡선”도 **부분 점선**을 정확히 표현 가능
- 곡선 품질(베지어) 자체는 유지하면서, **가시 구간만 분절**

## 2) visibleAtPoint: 레이캐스트 기반 가시성 판정

`Scene.visibleAtPoint(P)`는 기본적으로 아래를 합니다.

- Perspective: 카메라 위치 O에서 P로 향하는 ray를 쏘고
  - P보다 “살짝 앞”까지(`tMax = |OP| - eps`) hit가 있으면 P는 가려짐
- Orthographic(현재 web에서는 사용 안 함): viewDir 방향으로 평행 ray

### 2.1) 왜 `tMax = targetDist - eps` 인가?

P가 정확히 어떤 표면 위의 점일 때, 레이캐스트는 종종 “자기 자신”을 다시 hit 합니다.
그런 self-hit는 가림(occlusion)이 아니라 **수치오차**이므로,
목표점까지 포함하지 않고 “조금 앞까지만” 검사합니다.

### 2.2) 교선 근처 self-hit만 완화하는 이유

교선(두 표면의 교집합 곡선) 위의 점은 두 프리미티브 표면에 동시에 속합니다.
이때 가시성 레이에서 hit가 “교선 아주 근처”에서 발생하면,
그건 대부분 교선/접선/float 오차로 인한 노이즈입니다.

반대로 “멀리 떨어진 자기표면”이 ray를 막는 경우는 실제 self-occlusion이므로
무시하면 안 됩니다.

그래서 현재는:
- hit.point가 worldPoint에 충분히 가까울 때만(snap)
- 그리고 hit가 교선에 참여한 primitive에서 나온 경우에만
  - “노이즈 hit”로 보고 visible 처리

> 이 설계는 “교선에서 실선이 점선으로 뒤집히는” 케이스를 줄이면서도  
> 진짜 self-occlusion(자기표면이 가리는 현상)은 유지하려는 타협입니다.

## 3) 샘플링/epsilon 파라미터 가이드

`visibilityCuts.ts` / `splitByVisibility.ts` 파라미터:
- `samples`: 샘플 개수. 늘리면 전환점 탐지가 안정해지지만 느려짐
- `refineIters`: bisection 반복. 너무 크면 비용↑, 너무 작으면 cut이 흔들림
- `epsVisible`: visibleAtPoint 내부 eps 스케일(장면 스케일에 영향)
- `cutEps`: 전환점 중복 제거/경계 필터
- `minSegLenSq`: 너무 짧은 조각 제거(노이즈 방지)

권장 방향:
- 곡선이 “짧고 복잡”할수록 `samples`를 늘리고 `minSegLenSq`를 키우는 편이 안전
- 교선처럼 “피팅 오차”가 있을 수 있는 경우 `epsVisible`과 snap 기준을 조절하며 튜닝

## 4) 확장 팁

이 방식은 primitive를 추가해도 HLR 쪽은 거의 바뀌지 않습니다.
새로운 곡선(실루엣/교선/엣지)을 만들면,
그 곡선을 cubic으로 표현한 뒤 `splitCubicByVisibility*`에 넣기만 하면 됩니다.


