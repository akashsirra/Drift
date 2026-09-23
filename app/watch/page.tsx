"use client";

import dynamic from "next/dynamic";

const DriftPlayer = dynamic(() => import("./player"), {
  ssr: false,
  loading: () => (
    <main className="watch">
      <div className="videoPlaceholder" aria-label="Loading player" />
    </main>
  ),
});

export default function WatchPage(){
  return <DriftPlayer />;
}
