import { BrainMemoriesManager } from "@/brain/_components/BrainMemoriesManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Memorias do Brain",
};

export default function BrainMemoriesPage() {
  return <BrainMemoriesManager />;
}
