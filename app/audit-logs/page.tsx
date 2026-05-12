import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditLogsRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const source = params.source;
  const qs = source ? `?source=${source}` : "";
  redirect(`/admin/audit-logs${qs}`);
}
