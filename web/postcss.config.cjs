/**
 * Vite의 `root`가 `web/`이므로 PostCSS 설정도 `web/`에 두는 게 가장 확실합니다.
 *
 * Tailwind v4는 PostCSS 플러그인(`@tailwindcss/postcss`)이 실제로 실행되어야
 * `@import "tailwindcss"` 안의 `@tailwind utilities` 같은 지시문이 풀리고,
 * 사용된 유틸리티 클래스들이 빌드 CSS에 생성됩니다.
 */
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

