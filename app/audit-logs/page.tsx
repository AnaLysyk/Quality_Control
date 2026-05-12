import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function AuditLogsRedirectPage({ searchParams }: Props) {
  const sourceValue = searchParams?.source;
  const source = Array.isArray(sourceValue) ? sourceValue[0] : sourceValue;
  const qs = source ? `?source=${encodeURIComponent(source)}` : "";
  redirect(`/admin/audit-logs${qs}`);
}
