"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function PaymentRefreshWatcher({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastSeenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const checkHeartbeat = async () => {
      try {
        const response = await fetch("/api/payments/heartbeat", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { lastPaymentAt?: string | null };
        if (!payload || cancelled) {
          return;
        }
        const lastSeen = payload.lastPaymentAt ?? null;
        if (!initializedRef.current) {
          lastSeenRef.current = lastSeen;
          initializedRef.current = true;
          return;
        }
        if (lastSeen && lastSeen !== lastSeenRef.current) {
          lastSeenRef.current = lastSeen;
          router.refresh();
        }
      } catch {
        // Ignore network errors.
      }
    };

    if (!intervalMs || intervalMs <= 0) {
      return;
    }

    checkHeartbeat();
    const id = window.setInterval(checkHeartbeat, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs, router]);

  return null;
}
