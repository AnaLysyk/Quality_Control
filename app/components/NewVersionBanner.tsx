"use client";

import { useEffect, useState } from "react";
import { FiInfo, FiX } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";

const DISMISSED_KEY = "new-version-banner-dismissed";
const BUILD_ID_KEY = "app-build-id";

/**
 * Banner shown after a new deploy when the user's session may have been invalidated.
 * Detects version change via the Next.js build ID endpoint and shows a message
 * encouraging the user to log in again.
 */
export default function NewVersionBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only check for logged-out users or when there's a build change
    async function checkVersion() {
      try {
        const dismissed = sessionStorage.getItem(DISMISSED_KEY);
        if (dismissed === "true") return;

        const previousBuildId = localStorage.getItem(BUILD_ID_KEY);

        // Fetch the Next.js build manifest to detect new deploys
        const res = await fetch("/_next/static/__buildId", { cache: "no-store" }).catch(() => null);
        // Fallback: use current timestamp-based detection
        if (!res || !res.ok) {
          // If no build ID endpoint, detect via auth state:
          // show banner if user just lost their session (no user after page load)
          if (!user && previousBuildId) {
            setVisible(true);
          }
          return;
        }

        const currentBuildId = (await res.text()).trim();
        if (!previousBuildId) {
          // First visit — store and don't show
          localStorage.setItem(BUILD_ID_KEY, currentBuildId);
          return;
        }

        if (previousBuildId !== currentBuildId) {
          localStorage.setItem(BUILD_ID_KEY, currentBuildId);
          setVisible(true);
        }
      } catch {
        // Silent fail — don't break the app for a banner
      }
    }

    checkVersion();
  }, [user]);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {}
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="relative flex items-center gap-3 bg-blue-600 px-4 py-2.5 text-sm text-white shadow-md"
    >
      <FiInfo className="shrink-0" size={18} />
      <p className="flex-1 text-center font-medium">
        Uma nova versão do sistema foi publicada. Pode ser necessário fazer login novamente.
        Isso é normal e será resolvido em instantes.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="shrink-0 rounded p-1 hover:bg-blue-700 transition-colors"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}
