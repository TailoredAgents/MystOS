"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  label,
  pendingLabel,
  className,
  disabled
}: {
  children?: React.ReactNode;
  label?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  return (
    <button type="submit" className={className} disabled={isDisabled}>
      {pending ? pendingLabel ?? "Saving..." : children ?? label ?? "Save"}
    </button>
  );
}
