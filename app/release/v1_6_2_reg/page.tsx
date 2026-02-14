export const dynamic = "force-dynamic";

import { ReleasePageContent } from "@/release/ReleaseTemplate";

export default async function Page() {
  return ReleasePageContent({ slug: "v1_6_2_ace" });
}
