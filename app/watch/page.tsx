import {Suspense} from "react";
import DriftPlayer from "./player";

function WatchFallback(){
  return <main className="watch"><div className="videoPlaceholder" aria-label="Loading player" /></main>;
}

export default function WatchPage(){
  return (
    <Suspense fallback={<WatchFallback/>}>
      <DriftPlayer/>
    </Suspense>
  );
}
