import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import type { ImageProps } from "next/image";
import Image from "next/image";
import { cn } from "@myst-os/ui";

const safeClassName = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

type HeadingProps = HTMLAttributes<HTMLHeadingElement>;
type ParagraphProps = HTMLAttributes<HTMLParagraphElement>;
type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;
type ListProps = HTMLAttributes<HTMLUListElement>;
type OrderedListProps = HTMLAttributes<HTMLOListElement>;
type ListItemProps = HTMLAttributes<HTMLLIElement>;

export const mdxComponents: MDXComponents = {
  h1: ({ className, ...props }: HeadingProps) => (
    <h1
      className={cn("font-display text-display leading-tight text-primary-800", safeClassName(className))}
      {...props}
    />
  ),
  h2: ({ className, ...props }: HeadingProps) => (
    <h2
      className={cn("mt-10 font-display text-headline leading-tight text-primary-800", safeClassName(className))}
      {...props}
    />
  ),
  h3: ({ className, ...props }: HeadingProps) => (
    <h3 className={cn("mt-8 text-xl font-semibold text-primary-700", safeClassName(className))} {...props} />
  ),
  p: ({ className, ...props }: ParagraphProps) => (
    <p className={cn("mt-4 text-body text-neutral-600", safeClassName(className))} {...props} />
  ),
  ul: ({ className, ...props }: ListProps) => (
    <ul className={cn("mt-4 list-disc space-y-2 pl-6 text-neutral-600", safeClassName(className))} {...props} />
  ),
  ol: ({ className, ...props }: OrderedListProps) => (
    <ol className={cn("mt-4 list-decimal space-y-2 pl-6 text-neutral-600", safeClassName(className))} {...props} />
  ),
  li: ({ className, ...props }: ListItemProps) => (
    <li className={cn("text-body text-neutral-600", safeClassName(className))} {...props} />
  ),
  hr: () => <hr className="my-8 border-neutral-200/70" />,
  a: ({ className, ...props }: AnchorProps) => (
    <a
      className={cn("text-accent-600 underline decoration-accent-500/40 underline-offset-4", safeClassName(className))}
      {...props}
    />
  ),
  Image: ({ className, alt, ...props }: ImageProps) => (
    <Image className={cn("rounded-xl shadow-soft", safeClassName(className))} alt={alt ?? ""} {...props} />
  )
};

