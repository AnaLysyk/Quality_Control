"use client";

import dynamic from "next/dynamic";

const BrainGraphView = dynamic(() => import("./BrainGraphView"), { ssr: false });

export default function BrainPageClient() {
  return <BrainGraphView />;
}
