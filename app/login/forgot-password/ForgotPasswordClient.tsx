"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import loginStyles from "../LoginClient.module.css";
import styles from "./ForgotPasswordClient.module.css";
import { useI18n } from "@/hooks/useI18n";

const PROFILE_OPTIONS = [
  { value: "empresa" },
  { value: "testing_company_user" },
  { value: "company_user" },
  { value: "leader_tc" },
  { value: "technical_support" },
] as const;

export default function ForgotPasswordClient() {
  const { t } = useI18n();
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [profileType, setProfileType] = useState<(typeof PROFILE_OPTIONS)[number]["value"]>("testing_company_user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedLogin = login.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedLogin || !normalizedEmail) {
      setError(t("forgotPassword.requiredFields"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError(t("forgotPassword.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-request", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: normalizedLogin,
          email: normalizedEmail,
          profile_type: profileType,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || t("forgotPassword.requestFailed"));
      }

      setSuccess(typeof data?.message === "string" ? data.message : t("forgotPassword.successMessage"));
      setLogin("");
      setEmail("");
      setProfileType("testing_company_user");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("forgotPassword.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={
        `${loginStyles.loginContainer} ${loginStyles.loginFixedTheme} min-h-svh flex items-start sm:items-center justify-start sm:justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] relative isolate z-2147483647 overflow-x-hidden overflow-y-auto px-4 py-10 pointer-events-auto sm:px-6 md:px-10`
      }
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        <div className="absolute top-10 left-44 w-16 h-16 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#011848] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[#011848] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-8 sm:max-w-xl md:max-w-2xl">
        <div className={`text-center ${styles.introBase} ${styles.introDelay1}`}>
          <h2 className="mb-2 text-3xl font-bold leading-tight text-[#011848] drop-shadow-sm sm:text-4xl">
            {t("forgotPassword.title")}
          </h2>
          <p className="font-medium text-[#0b1a3c]">
            {t("forgotPassword.subtitle")}. {t("forgotPassword.routingInfo")}
          </p>
        </div>

        <form
          className={`mx-auto w-full max-w-sm min-w-0 rounded-2xl border border-[#011848]/10 bg-white/90 p-5 shadow-2xl backdrop-blur-sm sm:max-w-md sm:p-7 ${
            styles.introBase
          } ${styles.introDelay2}`}
          onSubmit={onSubmit}
          noValidate
        >
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-700">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="login" className="mb-2 block text-sm font-semibold text-[#011848]">
                {t("forgotPassword.username")}
              </label>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                required
                className="form-control-user w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-[#011848] caret-[#ef0001] placeholder:text-[#9aa3b2] focus:border-[#ef0001]/60 focus:ring-2 focus:ring-[#ef0001]/40"
                placeholder={t("forgotPassword.usernamePlaceholder")}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#011848]">
                {t("forgotPassword.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-control-user w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-[#011848] caret-[#ef0001] placeholder:text-[#9aa3b2] focus:border-[#ef0001]/60 focus:ring-2 focus:ring-[#ef0001]/40"
                placeholder={t("forgotPassword.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="profileType" className="mb-2 block text-sm font-semibold text-[#011848]">
                {t("forgotPassword.profileType")}
              </label>
              <select
                id="profileType"
                name="profileType"
                value={profileType}
                onChange={(e) => setProfileType(e.target.value as (typeof PROFILE_OPTIONS)[number]["value"])}
                className="form-control-user w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-[#011848] focus:border-[#ef0001]/60 focus:ring-2 focus:ring-[#ef0001]/40"
              >
                {PROFILE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value === "empresa"
                      ? t("roles.company")
                      : option.value === "testing_company_user"
                        ? t("roles.userTc")
                        : option.value === "company_user"
                          ? t("roles.companyUser")
                          : option.value === "leader_tc"
                            ? t("roles.leaderTc")
                            : t("roles.technicalSupport")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-4 py-3 font-semibold text-white transition-all duration-200 hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:ring-2 focus:ring-[#ef0001]/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t("forgotPassword.sending") : t("forgotPassword.submit")}
          </button>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-[#011848] hover:text-[#ef0001]">
              {t("forgotPassword.backToLogin")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
