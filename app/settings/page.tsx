"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useAppSettings, type Theme, type Language } from "@/context/AppSettingsContext";
import { useI18n } from "@/hooks/useI18n";

export default function SettingsPage() {
  const { user } = useAuthUser();
  const { theme, language, setTheme, setLanguage, saveSettings, loading: settingsLoading } = useAppSettings();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initials = useMemo(() => {
    const parts = (name || "Usuario").trim().split(" ");
    if (!parts.length) return "US";
    if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  useEffect(() => {
    setName(user?.name || "Usuario");
    setEmail(user?.email || "email@noreply.com");
    setRole((user as any)?.title || "");
    setPhone((user as any)?.phone || "");
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const result = await saveSettings();
    if (result.ok) {
      setMessage(t("settings.saved"));
    } else {
      setError(t("settings.saveError"));
    }
    // TODO: chamar /api/me para persistir nome/role/phone.
  }

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] dark:bg-[#0b1a3c] dark:text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[#0f1828] text-white flex items-center justify-center text-lg font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{t("settings.title")}</h1>
            <p className="text-sm text-gray-600 dark:text-slate-300">{t("settings.subtitle")}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{t("settings.note")}</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#0f1828] rounded-2xl shadow-[0_10px_26px_rgba(0,0,0,0.06)] border border-gray-200 dark:border-white/10 p-6 space-y-6"
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0b1a3c] dark:text-white">{t("settings.profile")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 flex flex-col gap-1">
                {t("settings.fullName")}
                <input
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white dark:bg-[#0b1425] dark:text-slate-100"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("settings.fullName")}
                />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 flex flex-col gap-1">
                {t("settings.email")}
                <input
                  disabled
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 cursor-not-allowed"
                  value={email}
                  onChange={() => {}}
                />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 flex flex-col gap-1">
                {t("settings.role")}
                <input
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white dark:bg-[#0b1425] dark:text-slate-100"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t("settings.role")}
                />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 flex flex-col gap-1">
                {t("settings.phone")}
                <input
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white dark:bg-[#0b1425] dark:text-slate-100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0b1a3c] dark:text-white">{t("settings.preferences")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 flex flex-col gap-1">
                {t("settings.theme")}
                <select
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white dark:bg-[#0b1425] dark:text-slate-100"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  disabled={settingsLoading}
                >
                  <option value="system">{t("settings.themeSystem")}</option>
                  <option value="light">{t("settings.themeLight")}</option>
                  <option value="dark">{t("settings.themeDark")}</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 flex flex-col gap-1">
                {t("settings.language")}
                <select
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white dark:bg-[#0b1425] dark:text-slate-100"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {t("settings.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
