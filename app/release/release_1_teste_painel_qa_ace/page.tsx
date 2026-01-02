export const dynamic = "force-dynamic";

import { ReleasePageContent } from "@/release/ReleaseTemplate";

export default async function Page() {
  return ReleasePageContent({ slug: "release_1_teste_painel_qa_ace" });
}
