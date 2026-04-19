import type { ComponentType, ReactNode } from "react";

export type MDXComponents = Record<string, ComponentType<Record<string, unknown>>>;

export interface MDXProviderProps {
  children?: ReactNode;
  components?: MDXComponents;
  disableParentContext?: boolean;
}

export const MDXProvider = null as unknown as ComponentType<MDXProviderProps>;
