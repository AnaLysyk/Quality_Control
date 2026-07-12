import RelationshipManagementClientV3 from "@/usuarios/vinculos/RelationshipManagementClientV3";

export const dynamic = "force-dynamic";

export default function RelationshipManagementAdminPage() {
  return (
    <>
      <link rel="stylesheet" href="/relationship-management.css" />
      <link rel="stylesheet" href="/relationship-management-context.css" />
      <link rel="stylesheet" href="/relationship-management-leadership.css" />
      <link rel="stylesheet" href="/relationship-management-business.css" />
      <RelationshipManagementClientV3 />
    </>
  );
}
