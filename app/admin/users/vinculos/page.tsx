import RelationshipManagementWorkspace from "@/usuarios/vinculos/RelationshipManagementWorkspace";

export const dynamic = "force-dynamic";

export default function RelationshipManagementAdminPage() {
  return (
    <>
      <link rel="stylesheet" href="/relationship-management.css" />
      <link rel="stylesheet" href="/relationship-management-context.css" />
      <link rel="stylesheet" href="/relationship-management-leadership.css" />
      <link rel="stylesheet" href="/relationship-management-business.css" />
      <link rel="stylesheet" href="/relationship-management-v4.css" />
      <link rel="stylesheet" href="/relationship-management-fullscreen.css" />
      <RelationshipManagementWorkspace />
    </>
  );
}
