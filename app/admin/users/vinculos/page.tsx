import RelationshipManagementClient from "@/usuarios/vinculos/RelationshipManagementClient";

export const dynamic = "force-dynamic";

export default function RelationshipManagementAdminPage() {
  return (
    <>
      <link rel="stylesheet" href="/brain-home-orb-reference.css" />
      <RelationshipManagementClient />
    </>
  );
}
