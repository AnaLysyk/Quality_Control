"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useAppSettings, type Theme, type Language } from "@/context/AppSettingsContext";
import { useI18n } from "@/hooks/useI18n";

type ProfileForm = {
  name: string;
  email: string;
  role: string;
  phone: string;
};

function getInitialProfile(user: unknown): ProfileForm {
  const record = (user ?? null) as Record<string, unknown> | null;
  const name = typeof record?.name === "string" && record.name.trim() ? record.name : "Usuario";
  const email = typeof record?.email === "string" && record.email.trim() ? record.email : "email@noreply.com";
  const role = typeof record?.role === "string" ? record.role : "";
  const phone = typeof record?.phone === "string" ? record.phone : "";

  return { name, email, role, phone };
}

function SettingsPageInner({
  user,
  refreshUser,
  theme,
  language,
  setTheme,
  setLanguage,
  saveSettings,
  settingsLoading,
}: {
  user: unknown;
  refreshUser: () => Promise<void>;
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  saveSettings: (next?: Partial<{ theme: Theme; language: Language }>) => Promise<{ ok: boolean }>;
  settingsLoading: boolean;
}) {
  const { t } = useI18n();

  const initial = useMemo(() => getInitialProfile(user), [user]);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initials = useMemo(() => {
    const parts = (name || "Usuario").trim().split(" ");
    if (!parts.length) return "US";
    if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  useEffect(() => {
    setName(initial.name);
    setPhone(initial.phone);
  }, [initial.name, initial.phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      // Persist profile fields tied to the logged-in user.
      const profileRes = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, phone }),
      });

      const profileJson = await profileRes.json().catch(() => null);
      if (!profileRes.ok) {
        setError(t("settings.saveError"));
        return;
      }
      const profileRecord = (profileJson ?? null) as Record<string, unknown> | null;
      const profileUser = (profileRecord?.user ?? null) as Record<string, unknown> | null;
      const updatedName = typeof profileUser?.name === "string" ? profileUser.name : null;
      const updatedPhone = typeof profileUser?.phone === "string" ? profileUser.phone : null;
      if (updatedName) setName(updatedName);
      if (updatedPhone !== null) setPhone(updatedPhone);

      const result = await saveSettings({ theme, language });
      if (!result.ok) {
        setError(t("settings.saveError"));
        return;
      }

      await refreshUser();
      setMessage(t("settings.saved"));
    } catch {
      setError(t("settings.saveError"));
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--page-text)">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-(--tc-surface-dark) text-(--tc-text-inverse) flex items-center justify-center text-lg font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{t("settings.title")}</h1>
            <p className="text-sm text-(--tc-text-secondary)">{t("settings.subtitle")}</p>
            <p className="text-xs text-(--tc-text-muted)">{t("settings.note")}</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-(--tc-surface) shadow-[0_10px_26px_rgba(0,0,0,0.06)] border border-(--tc-border) p-6 space-y-6"
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-(--tc-text)">{t("settings.profile")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-medium text-(--tc-text) flex flex-col gap-1">
                {t("settings.fullName")}
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/25 transition"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("settings.fullName")}
                />
              </label>
              <label className="text-sm font-medium text-(--tc-text) flex flex-col gap-1">
                {t("settings.email")}
                <input
                  disabled
                  className="form-control-user w-full rounded-lg border border-(--tc-border) px-3 py-2 text-sm bg-(--tc-surface-2) text-(--tc-text-muted) cursor-not-allowed"
                  value={initial.email}
                  onChange={() => {}}
                />
              </label>
              <label className="text-sm font-medium text-(--tc-text) flex flex-col gap-1">
                {t("settings.role")}
                <input
                  disabled
                  className="form-control-user w-full rounded-lg border border-(--tc-border) px-3 py-2 text-sm bg-(--tc-surface-2) text-(--tc-text-muted) cursor-not-allowed"
                  value={initial.role}
                  onChange={() => {}}
                  placeholder={t("settings.role")}
                />
              </label>
              <label className="text-sm font-medium text-(--tc-text) flex flex-col gap-1">
                {t("settings.phone")}
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/25 transition"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-(--tc-text)">{t("settings.preferences")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-medium text-(--tc-text) flex flex-col gap-1">
                {t("settings.theme")}
                <select
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/25 transition"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  disabled={settingsLoading}
                >
                  <option value="system">{t("settings.themeSystem")}</option>
                  <option value="light">{t("settings.themeLight")}</option>
                  <option value="dark">{t("settings.themeDark")}</option>
                </select>
              </label>
              <label className="text-sm font-medium text-(--tc-text) flex flex-col gap-1">
                {t("settings.language")}
                <select
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg) px-3 py-2 text-sm text-(--tc-text) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/25 transition"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  disabled={settingsLoading}
                >
                  <option value="pt-BR">{t("settings.languagePt")}</option>
                  <option value="en-US">{t("settings.languageEn")}</option>
                </select>
              </label>
            </div>
          </div>

          {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(239,0,1,0.22)] transition hover:bg-(--tc-accent-hover) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/40"
            >
              {t("settings.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuthUser();
  const { theme, language, setTheme, setLanguage, saveSettings, loading: settingsLoading } = useAppSettings();

  const userRecord = (user ?? null) as Record<string, unknown> | null;
  const idValue = userRecord?.id;
  const userIdValue = userRecord?.userId;
  const key = typeof idValue === "string" ? idValue : typeof userIdValue === "string" ? userIdValue : "anon";

  return (
    <SettingsPageInner
      key={key}
      user={user}
      refreshUser={async () => {
        await refreshUser();
      }}
      theme={theme}
      language={language}
      setTheme={setTheme}
      setLanguage={setLanguage}
      saveSettings={saveSettings}
      settingsLoading={settingsLoading}
    />
  );
}
