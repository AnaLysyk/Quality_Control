import { redirect } from "next/navigation";

export const metadata = {
  title: "Brain",
  description: "Fluxos internos do Brain",
};

export default function BrainSolicitacoesPage() {
  redirect("/brain");
}
