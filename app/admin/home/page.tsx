import NewHomeContent from "./NewHomeContent";
import HomeRouteWarmup from "./HomeRouteWarmup";

export default function AdminHomePage() {
  return (
    <>
      <link rel="stylesheet" href="/brain-home-orb-reference.css" />
      <link rel="stylesheet" href="/admin-home-brain-reference.css" />
      <HomeRouteWarmup />
      <NewHomeContent />
    </>
  );
}
