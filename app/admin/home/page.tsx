import NewHomeContent from "./NewHomeContent";
import HomeRouteWarmup from "./HomeRouteWarmup";

export default function AdminHomePage() {
  return (
    <>
      {/* Mantém estilos de referência do orb */}
      <link rel="stylesheet" href="/brain-home-orb-reference.css" />
      <HomeRouteWarmup />
      <NewHomeContent />
    </>
  );
}
