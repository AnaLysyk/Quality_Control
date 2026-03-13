"use client";

import type { AuthUser } from "@/contracts/auth";

export const AUTH_USER_SYNC_EVENT = "tc:auth-user-sync";

type AuthUserSyncDetail = {
  user: AuthUser | null;
};

export function publishAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthUserSyncDetail>(AUTH_USER_SYNC_EVENT, { detail: { user } }));
}

export function subscribeAuthUserSync(listener: (user: AuthUser | null) => void) {
  if (typeof window === "undefined") return () => undefined;

  function handleSync(event: Event) {
    const detail = (event as CustomEvent<AuthUserSyncDetail>).detail;
    listener(detail?.user ?? null);
  }

  window.addEventListener(AUTH_USER_SYNC_EVENT, handleSync as EventListener);
  return () => {
    window.removeEventListener(AUTH_USER_SYNC_EVENT, handleSync as EventListener);
  };
}
