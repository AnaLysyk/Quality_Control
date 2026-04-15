"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import loginStyles from "../LoginClient.module.css";
import { useI18n } from "@/hooks/useI18n";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export default function ResetPasswordClient() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError(t("resetPassword.invalidTokenMissing"));
    }
  }, [token, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError(t("resetPassword.invalidToken"));
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t("resetPassword.minChars"));
      return;
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      setError(t("resetPassword.maxChars"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("resetPassword.passwordMismatch"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-via-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("resetPassword.resetFailed"));
      }

      setSuccess(t("resetPassword.success"));

      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resetPassword.unknownError"));
    } finally {
      setLoading(false);
    }
  };

  const containerClass =
    `${loginStyles.loginContainer} ${loginStyles.loginFixedTheme} ` +
    "relative flex min-h-svh items-center justify-center overflow-x-hidden overflow-y-auto " +
    "bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] px-4 py-6 sm:px-6 sm:py-8";

  if (!token) {
    return (
      <div className={containerClass}>
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-2xl border border-[#011848]/10 bg-white/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <h2 className="mb-2 text-2xl font-bold text-[#011848]">{t("resetPassword.invalidLinkTitle")}</h2>
            <p className="mb-6 text-sm text-[#4b5563]">
              {t("resetPassword.invalidLink")}
            </p>
            <Link
              href="/login/forgot-password"
              className="block w-full rounded-lg bg-linear-to-r from-[#011848] to-[#ef0001] py-3 px-4 text-center font-medium text-white hover:from-[#011848]/90 hover:to-[#ef0001]/90 transition-all duration-200"
            >
              {t("resetPassword.requestNewLink")}
            </Link>
            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm font-medium text-[#011848] hover:text-[#ef0001]">
                {t("resetPassword.backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 h-32 w-32 rounded-full bg-[#011848] opacity-20 blur-2xl animate-ping" />
        <div className="absolute bottom-6 right-6 h-28 w-28 rounded-full bg-[#ef0001] opacity-20 blur-2xl animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-5 sm:max-w-md sm:space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#011848] drop-shadow-sm">{t("resetPassword.title")}</h2>
          <p className="mt-1 font-medium text-[#011848]">{t("resetPassword.subtitle")}</p>
        </div>

        <form
          className="w-full rounded-2xl border border-[#011848]/10 bg-white/90 p-5 shadow-2xl backdrop-blur-sm sm:p-7"
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm font-semibold text-[#011848]">
                {t("resetPassword.newPassword")}
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                className="form-control-user w-full rounded-lg border border-[#011848]/20 bg-white px-4 py-3 text-[#011848] caret-[#ef0001] placeholder:text-[#9aa3b2] focus:border-transparent focus:ring-2 focus:ring-[#ef0001] transition-all duration-200"
                placeholder={t("resetPassword.newPasswordPlaceholder")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-semibold text-[#011848]">
                {t("resetPassword.confirmPassword")}
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="form-control-user w-full rounded-lg border border-[#011848]/20 bg-white px-4 py-3 text-[#011848] caret-[#ef0001] placeholder:text-[#9aa3b2] focus:border-transparent focus:ring-2 focus:ring-[#ef0001] transition-all duration-200"
                placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-linear-to-r from-[#011848] to-[#ef0001] px-4 py-3 font-medium text-white transition-all duration-200 hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:ring-2 focus:ring-[#ef0001] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t("resetPassword.resetting") : t("resetPassword.submit")}
          </button>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-[#011848] hover:text-[#ef0001]">
              {t("resetPassword.backToLogin")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
