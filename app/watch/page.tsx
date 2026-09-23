import dynamic from "next/dynamic";

const DriftPlayer=dynamic(()=>import("./player"),{
  ssr:false,
  loading:()=> <main className="watch"><div className="loading">Loading player…</div></main>
});

export default function WatchPage(){
  return <DriftPlayer/>;
}
