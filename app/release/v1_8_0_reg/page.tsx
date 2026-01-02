export const dynamic = "force-dynamic";

import { ReleasePageContent } from "@/release/ReleaseTemplate";

export default async function Page() {
  return ReleasePageContent({ slug: "v1_8_0_reg" });
}
