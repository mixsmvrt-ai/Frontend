"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

export function promptSignIn(nextPath?: string) {
  const target = nextPath ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/login");
  window.location.assign(`/login?next=${encodeURIComponent(target)}`);
}

export function useViewerAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      setAuthResolved(true);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsAuthenticated(Boolean(data.user));
      setAuthResolved(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { isAuthenticated, authResolved };
}