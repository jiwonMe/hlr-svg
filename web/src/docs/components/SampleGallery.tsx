import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { cn } from "../../lib/utils";
import { renderCaseToSvgString } from "../../../../dist/demo/renderCase.js";
import { buildSimplePrimitivesCase } from "../../../../dist/demo/samples/simplePrimitives.js";
import { buildRandomPrimitivesCase } from "../../../../dist/demo/samples/randomPrimitives.js";
import { buildConicSectionCase } from "../../../../dist/demo/samples/conicSection.js";

import simpleCode from "../samples/simple-primitives.ts?raw";
import randomCode from "../samples/random-primitives.ts?raw";
import conicCode from "../samples/conic-section.ts?raw";

type Locale = "ko-kr" | "en-us";

const TEXT = {
  "ko-kr": {
    title: "Examples",
    subtitle: "아래 3개 예제는 문서용으로 “결과 + 전체 코드 + GitHub 링크”를 한 번에 제공합니다.",
    code: "Code",
    openGithub: "GitHub에서 보기",
    samples: {
      simple: {
        title: "단순 primitives",
        desc: "Sphere / Cylinder / Cone / BoxAabb 를 한 장면에 배치해 SVG로 렌더링합니다.",
      },
      random: {
        title: "랜덤 도형 생성 (seed 기반)",
        desc: "seed를 고정해 문서/CI에서 항상 같은 랜덤 씬을 재현합니다.",
      },
      conic: {
        title: "Conic section (Plane × Cone)",
        desc: "원뿔을 비스듬한 평면으로 자르면 교차 곡선이 원뿔 곡선(타원/포물선/쌍곡선)이 됩니다.",
      },
    },
  },
  "en-us": {
    title: "Examples",
    subtitle: "Each sample below ships as “result + full code + GitHub link”.",
    code: "Code",
    openGithub: "View on GitHub",
    samples: {
      simple: {
        title: "Simple primitives",
        desc: "Render Sphere / Cylinder / Cone / BoxAabb in a single scene.",
      },
      random: {
        title: "Random primitives (seeded)",
        desc: "Seeded randomness makes docs/CI output reproducible.",
      },
      conic: {
        title: "Conic section (Plane × Cone)",
        desc: "A plane slicing a cone produces a conic section (ellipse/parabola/hyperbola).",
      },
    },
  },
} as const;

const GITHUB_BASE = "https://github.com/jiwonMe/hlr-svg/blob/main";

type SampleKey = "simple" | "random" | "conic";

type SampleSpec = {
  key: SampleKey;
  githubPath: string;
  code: string;
  svg: string;
  title: string;
  desc: string;
};

/**
 * Sample Gallery (docs)
 * - 프리뷰(SVG) + 전체 코드 + GitHub 링크를 같이 보여주는 “문서용 예제” 섹션
 */
export function SampleGallery(): React.ReactElement {
  const { locale } = useParams<{ locale?: string }>();
  const lang: Locale = locale === "ko-kr" || locale === "en-us" ? locale : "en-us";
  const t = TEXT[lang];

  const samples = useMemo<SampleSpec[]>(() => {
    const simple = buildSimplePrimitivesCase();
    const random = buildRandomPrimitivesCase(1337);
    const conic = buildConicSectionCase();

    const svgStyle = {
      strokeWidthVisible: 2,
      strokeWidthHidden: 2,
      dashArrayHidden: "6 6",
      strokeColorVisible: "#000000",
      strokeColorHidden: "#000000",
      opacityHidden: 0.4,
    } as const;

    return [
      {
        key: "simple",
        title: t.samples.simple.title,
        desc: t.samples.simple.desc,
        githubPath: "web/src/docs/samples/simple-primitives.ts",
        code: simpleCode,
        svg: renderCaseToSvgString(simple, { background: false, svgStyle }),
      },
      {
        key: "random",
        title: t.samples.random.title,
        desc: t.samples.random.desc,
        githubPath: "web/src/docs/samples/random-primitives.ts",
        code: randomCode,
        svg: renderCaseToSvgString(random, { background: false, svgStyle }),
      },
      {
        key: "conic",
        title: t.samples.conic.title,
        desc: t.samples.conic.desc,
        githubPath: "web/src/docs/samples/conic-section.ts",
        code: conicCode,
        svg: renderCaseToSvgString(conic, { background: false, svgStyle }),
      },
    ];
  }, [t]);

  return (
    <section>
      <header className={cn(
        /* spacing */
        "mb-6"
      )}>
        <h2 className={cn(
          /* typography */
          "text-xl",
          "font-semibold",
          "tracking-tight",
          /* color */
          "text-[hsl(220,9%,18%)]",
          /* spacing */
          "mb-2"
        )}>
          {t.title}
        </h2>
        <p className={cn(
          /* typography */
          "text-[15px]",
          "leading-7",
          /* color */
          "text-[hsl(220,9%,35%)]"
        )}>
          {t.subtitle}
        </p>
      </header>

      <style>{`
        [data-docs-sample-svg] svg {
          width: 100%;
          height: auto;
          display: block;
        }
      `}</style>

      <div className={cn(
        /* layout */
        "flex",
        "flex-col",
        /* spacing */
        "gap-8"
      )}>
        {samples.map((s) => (
          <SampleCard
            key={s.key}
            title={s.title}
            desc={s.desc}
            codeLabel={t.code}
            githubLabel={t.openGithub}
            githubUrl={`${GITHUB_BASE}/${s.githubPath}`}
            svg={s.svg}
            code={s.code}
          />
        ))}
      </div>
    </section>
  );
}

function SampleCard(props: {
  title: string;
  desc: string;
  codeLabel: string;
  githubLabel: string;
  githubUrl: string;
  svg: string;
  code: string;
}): React.ReactElement {
  return (
    <article className={cn(
      /* surface */
      "rounded-lg",
      "border",
      "border-[hsl(220,13%,91%)]",
      "bg-white",
      "overflow-hidden"
    )}>
      <div className={cn(
        /* layout */
        "flex",
        "flex-col",
        /* spacing */
        "gap-4",
        "p-5",
        /* background */
        "bg-[hsl(240,4.8%,95.9%)]"
      )}>
        <div className={cn(
          /* layout */
          "flex",
          "items-start",
          "justify-between",
          /* spacing */
          "gap-4"
        )}>
          <div className={cn(
            /* layout */
            "min-w-0"
          )}>
            <h3 className={cn(
              /* typography */
              "text-base",
              "font-semibold",
              "tracking-tight",
              /* color */
              "text-[hsl(220,9%,18%)]",
              /* spacing */
              "mb-1"
            )}>
              {props.title}
            </h3>
            <p className={cn(
              /* typography */
              "text-sm",
              "leading-6",
              /* color */
              "text-[hsl(220,9%,46%)]"
            )}>
              {props.desc}
            </p>
          </div>

          <a
            href={props.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              /* typography */
              "text-xs",
              "font-medium",
              /* color */
              "text-[hsl(152,69%,35%)]",
              /* hover */
              "hover:text-[hsl(152,69%,25%)]",
              "hover:underline",
              "underline-offset-4",
              /* whitespace */
              "shrink-0"
            )}
          >
            {props.githubLabel}
          </a>
        </div>
      </div>

      <div className={cn(
        /* layout */
        "grid",
        "grid-cols-1",
        "lg:grid-cols-2",
        /* divider */
        "lg:divide-x",
        "lg:divide-[hsl(220,13%,91%)]"
      )}>
        {/* Preview */}
        <div className={cn(
          /* spacing */
          "p-4",
          /* layout */
          "flex",
          "items-center",
          "justify-center",
          /* sizing */
          "min-h-[320px]"
        )}>
          <div
            data-docs-sample-svg
            className={cn(
              /* sizing */
              "w-full"
            )}
            dangerouslySetInnerHTML={{ __html: props.svg }}
          />
        </div>

        {/* Code */}
        <div className={cn(
          /* layout */
          "flex",
          "flex-col"
        )}>
          <div className={cn(
            /* header */
            "px-4",
            "py-3",
            /* border */
            "border-t",
            "border-[hsl(220,13%,91%)]",
            "lg:border-t-0",
            /* background */
            "bg-white"
          )}>
            <p className={cn(
              /* typography */
              "text-xs",
              "font-medium",
              "uppercase",
              "tracking-wider",
              /* color */
              "text-[hsl(220,9%,46%)]"
            )}>
              {props.codeLabel}
            </p>
          </div>

          <pre className={cn(
            /* background */
            "bg-[#0d1117]",
            /* typography */
            "text-[13px]",
            "leading-6",
            "text-[#c9d1d9]",
            /* spacing */
            "p-4",
            /* overflow */
            "overflow-x-auto",
            /* sizing */
            "max-h-[520px]"
          )}>
            <code>{props.code}</code>
          </pre>
        </div>
      </div>
    </article>
  );
}
