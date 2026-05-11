"use client";

/**
 * User Profile Form — Formulário de perfil de usuário
 * Renderiza campos baseado em USER_PROFILE_FIELDS e permissões
 */

import { useState } from "react";
import { useProfileContext, useProfileAction } from "@/lib/profile/useProfileContext";
import { USER_PROFILE_FIELDS, isFieldEditable, isFieldVisible } from "@/lib/profile/fieldPermissions";

export type UserProfileFormProps = {
  userId: string;
  initialData?: Record<string, any>;
  onSuccess?: () => void;
  onError?: (error: string) => void;
};

export function UserProfileForm({
  userId,
  initialData,
  onSuccess,
  onError,
}: UserProfileFormProps) {
  const context = useProfileContext();
  const canEdit = useProfileAction("edit");

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData || {});
  const [error, setError] = useState<string | null>(null);

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/profile/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      onSuccess?.();
      setFormData({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const visibleFields = USER_PROFILE_FIELDS.filter((field) =>
    isFieldVisible(field.field, context.mode, USER_PROFILE_FIELDS),
  );

  if (visibleFields.length === 0) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
        Sem campos visíveis para este modo.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {visibleFields.map((field) => {
        const editable = isFieldEditable(
          field.field,
          context.mode,
          USER_PROFILE_FIELDS,
          context.permissions,
        );

        return (
          <div key={field.field}>
            <label className="block text-sm font-semibold text-tc-text-primary mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            <input
              type={field.field === "email" ? "email" : "text"}
              name={field.field}
              value={formData[field.field] || ""}
              onChange={(e) => handleChange(field.field, e.target.value)}
              disabled={!editable}
              required={field.required && editable}
              placeholder={field.label}
              className="w-full px-3 py-2 rounded-lg border border-tc-border bg-tc-surface text-tc-text-primary disabled:bg-tc-surface-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-tc-accent"
            />
          </div>
        );
      })}

      {canEdit && context.mode !== "view" && (
        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-tc-accent px-4 py-2 text-white font-semibold hover:bg-tc-accent-hover disabled:opacity-50 transition"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setFormData(initialData || {})}
            className="rounded-lg bg-tc-surface px-4 py-2 text-tc-text-primary font-semibold hover:bg-tc-surface-hover transition"
          >
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
