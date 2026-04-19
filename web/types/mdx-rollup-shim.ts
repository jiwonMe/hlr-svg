import type { PluginOption } from "vite";

export type MdxOptions = Record<string, unknown>;

export default function mdx(_options?: MdxOptions): PluginOption {
  return null;
}
