import RelationshipManagementClient from "@/usuarios/vinculos/RelationshipManagementClient";

export const dynamic = "force-dynamic";

export default function RelationshipManagementAdminPage() {
  return (
    <>
      <link rel="stylesheet" href="/relationship-management.css" />
      <link rel="stylesheet" href="/relationship-management-context.css" />
      <RelationshipManagementClient />
    </>
  );
}
