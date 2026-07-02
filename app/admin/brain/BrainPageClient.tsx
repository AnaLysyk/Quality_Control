"use client";

import dynamic from "next/dynamic";

const BrainGraphView = dynamic(() => import("./BrainReactFlowView"), { ssr: false });

export default function BrainPageClient() {
  return <BrainGraphView />;
}

