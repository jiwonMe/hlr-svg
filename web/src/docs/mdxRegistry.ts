import type { ComponentType } from "react";
import type { Frontmatter } from "../mdx";

/** MDX 모듈 타입 */
interface MdxModule {
  default: ComponentType<Record<string, unknown>>;
  frontmatter: Frontmatter;
}

/** 문서 아이템 */
export interface DocItem {
  slug: string;
  frontmatter: Frontmatter;
  Component: ComponentType<Record<string, unknown>>;
}

/** 네비게이션 그룹 */
export interface NavGroup {
  name: string;
  items: DocItem[];
}

/**
 * MDX 파일들을 eager로 로드
 * Vite의 import.meta.glob을 사용하여 빌드 타임에 모든 MDX 파일을 번들링
 */
const mdxModules = import.meta.glob<MdxModule>("./content/**/*.mdx", {
  eager: true,
});

/**
 * 모든 문서를 파싱하여 DocItem 배열로 변환
 */
function parseAllDocs(): DocItem[] {
  const docs: DocItem[] = [];

  for (const [path, module] of Object.entries(mdxModules)) {
    // 파일 경로에서 slug 추출: ./content/quickstart.mdx → quickstart
    const match = path.match(/\.\/content\/(.+)\.mdx$/);
    if (!match) continue;

    const slug = match[1]!;
    docs.push({
      slug,
      frontmatter: module.frontmatter,
      Component: module.default,
    });
  }

  return docs;
}

/** 파싱된 모든 문서 */
const allDocs = parseAllDocs();

/**
 * slug로 문서 조회
 */
export function getDocBySlug(slug: string): DocItem | undefined {
  return allDocs.find((doc) => doc.slug === slug);
}

/**
 * 모든 문서 목록 반환 (order 기준 정렬)
 */
export function getAllDocs(): DocItem[] {
  return [...allDocs].sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

/**
 * 그룹별로 정리된 네비게이션 데이터 반환
 */
export function getNavGroups(): NavGroup[] {
  const groupMap = new Map<string, DocItem[]>();

  // 그룹별로 문서 분류
  for (const doc of allDocs) {
    const groupName = doc.frontmatter.group;
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName)!.push(doc);
  }

  // 각 그룹 내에서 order 기준 정렬
  const groups: NavGroup[] = [];
  for (const [name, items] of groupMap) {
    items.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
    groups.push({ name, items });
  }

  // 그룹도 첫 아이템의 order 기준 정렬
  groups.sort((a, b) => {
    const aOrder = a.items[0]?.frontmatter.order ?? 0;
    const bOrder = b.items[0]?.frontmatter.order ?? 0;
    return aOrder - bOrder;
  });

  return groups;
}
