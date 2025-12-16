import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./LandingPage";
import { DocsLayout } from "./docs/DocsLayout";
import { MdxDocPage } from "./docs/MdxDocPage";

/**
 * 앱 라우트 정의
 * - / : 랜딩 페이지
 * - /docs : /docs/quickstart로 리다이렉트
 * - /docs/:slug : MDX 문서 페이지
 */
export function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      {/* 랜딩 페이지 */}
      <Route path="/" element={<LandingPage />} />

      {/* 문서 섹션 */}
      <Route path="/docs" element={<DocsLayout />}>
        {/* /docs 접근 시 quickstart로 리다이렉트 */}
        <Route index element={<Navigate to="/docs/quickstart" replace />} />
        {/* 동적 slug 라우트 */}
        <Route path=":slug" element={<MdxDocPage />} />
      </Route>

      {/* 404 fallback → 랜딩으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
