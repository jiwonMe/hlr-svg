import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { DEFAULT_LOCALE } from "./docs/locale";

const LandingPage = lazy(() =>
  import("./LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const GeometryPlayground = lazy(() =>
  import("./GeometryPlayground").then((module) => ({
    default: module.GeometryPlayground,
  })),
);
const DocsLayout = lazy(() =>
  import("./docs/DocsLayout").then((module) => ({
    default: module.DocsLayout,
  })),
);
const MdxDocPage = lazy(() =>
  import("./docs/MdxDocPage").then((module) => ({
    default: module.MdxDocPage,
  })),
);
const DocsExamplesIndexPage = lazy(() =>
  import("./docs/examples/DocsExamplesIndexPage").then((module) => ({
    default: module.DocsExamplesIndexPage,
  })),
);
const DocsExamplePage = lazy(() =>
  import("./docs/examples/DocsExamplePage").then((module) => ({
    default: module.DocsExamplePage,
  })),
);

/**
 * 앱 라우트 정의
 * - / : 랜딩 페이지
 * - /docs : 기본 언어로 리다이렉트
 * - /docs/:locale : 기본 문서로 리다이렉트
 * - /docs/:locale/:slug : MDX 문서 페이지
 */
export function AppRoutes(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm font-docs" role="status">
          화면을 불러오는 중…
        </main>
      }
    >
      <Routes>
        {/* 랜딩 페이지 */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/playground" element={<GeometryPlayground />} />

        {/* 문서 섹션 */}
        <Route path="/docs" element={<DocsLayout />}>
          {/* /docs 접근 시 기본 언어의 quickstart로 리다이렉트 */}
          <Route
            index
            element={
              <Navigate to={`/docs/${DEFAULT_LOCALE}/quickstart`} replace />
            }
          />
          {/* locale별 라우트 */}
          <Route path=":locale">
            {/* examples 인덱스/상세 (index와 slug 매칭보다 먼저!) */}
            <Route path="examples" element={<DocsExamplesIndexPage />} />
            <Route path="examples/:exampleId" element={<DocsExamplePage />} />
            {/* 동적 slug 라우트 (index보다 먼저 매칭되도록) */}
            <Route path=":slug" element={<MdxDocPage />} />
            {/* /docs/:locale 접근 시 quickstart로 리다이렉트 (가장 마지막) */}
            <Route
              index
              element={<Navigate to="../quickstart" replace relative="route" />}
            />
          </Route>
        </Route>

        {/* 404 fallback → 랜딩으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
