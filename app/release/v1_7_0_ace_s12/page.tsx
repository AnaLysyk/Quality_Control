export const dynamic = "force-dynamic";

import { ReleasePageContent } from "@/release/ReleaseTemplate";

export default async function Page() {
  return ReleasePageContent({ slug: "v1_7_0_ace_s3" });
}
