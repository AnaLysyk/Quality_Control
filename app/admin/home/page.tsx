import HomeContent from "../../home/HomeContent";
import HomeRouteWarmup from "./HomeRouteWarmup";

export default function AdminHomePage() {
  return (
    <>
      <link rel="stylesheet" href="/brain-home-orb-reference.css" />
      <HomeRouteWarmup />
      <HomeContent />
    </>
  );
}
