import RelationshipManagementClientV2 from "@/usuarios/vinculos/RelationshipManagementClientV2";

export const dynamic = "force-dynamic";

export default function RelationshipManagementAdminPage() {
  return (
    <>
      <link rel="stylesheet" href="/relationship-management.css" />
      <link rel="stylesheet" href="/relationship-management-context.css" />
      <link rel="stylesheet" href="/relationship-management-leadership.css" />
      <RelationshipManagementClientV2 />
    </>
  );
}
