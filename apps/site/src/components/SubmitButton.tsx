"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  label,
  pendingLabel,
  className
}: {
  children?: React.ReactNode;
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel ?? "Saving..." : children ?? label ?? "Save"}
    </button>
  );
}

