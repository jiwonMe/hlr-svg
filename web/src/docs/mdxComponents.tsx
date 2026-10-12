import React from "react";
import type {
  AnchorHTMLAttributes,
  ComponentType,
  HTMLAttributes,
} from "react";
import { Link } from "react-router-dom";

/**
 * MDX elements keep their semantic tags; `.prose` in docs.css styles them
 * like an exam booklet. Only links and tables need behaviour of their own.
 */
export const mdxComponents: Record<string, ComponentType<any>> = {
  a: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href && href.startsWith("/") && !href.startsWith("//"))
      return <Link to={href}>{children}</Link>;
    const external = href?.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
  table: ({ children, ...props }: HTMLAttributes<HTMLTableElement>) => (
    <div className="prose-table">
      <table {...props}>{children}</table>
    </div>
  ),
};
