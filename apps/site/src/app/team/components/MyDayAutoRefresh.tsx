'use client';

import React from "react";
import { useRouter } from "next/navigation";

type MyDayAutoRefreshProps = {
  children: React.ReactNode;
  intervalMs?: number;
};

export function MyDayAutoRefresh({ children, intervalMs = 60 * 60 * 1000 }: MyDayAutoRefreshProps) {
  const router = useRouter();

  React.useEffect(() => {
    if (!intervalMs || intervalMs <= 0) {
      return;
    }

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs, router]);

  return <>{children}</>;
}
