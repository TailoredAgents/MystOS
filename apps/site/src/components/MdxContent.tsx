'use client';

import * as React from "react";
import { useMDXComponent } from "next-contentlayer/hooks";
import type { MDXComponents } from "mdx/types";
import { mdxComponents } from "../lib/mdx-components";

interface MdxContentProps {
  code: string;
}

function patchBundledCode(source: string): string {
  return source.replace(
    /return\s+e===null\?\s*null\s*:\s*e\.getOwner\(\)/g,
    'return e===null ? null : typeof e.getOwner === "function" ? e.getOwner() : null'
  );
}

export function MdxContent({ code }: MdxContentProps) {
  const internals = (React as unknown as { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: { A?: { getOwner?: () => unknown } } }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  if (internals?.A && typeof internals.A.getOwner !== "function") {
    internals.A.getOwner = () => null;
  }

  const safeCode = React.useMemo(() => patchBundledCode(code), [code]);

  return React.createElement(
    useMDXComponent(safeCode) as unknown as React.ComponentType<{ components: MDXComponents }>,
    { components: mdxComponents }
  );
}

