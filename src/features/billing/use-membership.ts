"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, type MembershipSnapshot } from "@/services/api";

export function useMembership({ enabled = true, redirectOnMissingUser = true }: { enabled?: boolean; redirectOnMissingUser?: boolean } = {}) {
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) {
      setMembership(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<{ data: MembershipSnapshot }>("/membership", undefined, { redirectOnMissingUser });
      setMembership(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load membership.");
    } finally {
      setLoading(false);
    }
  }, [enabled, redirectOnMissingUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { membership, loading, error, refresh };
}