"use client";
import {useEffect,useState} from "react";

type Job={id:string;title:string;url:string;type:"direct"|"hls";status:"queued"|"downloading"|"complete"|"failed";progress:number;createdAt:number;error?:string};
const KEY="drift-downloads";

export default function Downloads(){
 const [jobs,setJobs]=useState<Job[]>([]);
 useEffect(()=>{try{setJobs(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{}},[]);
 function refresh(){try{setJobs(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{}}
 function clear(){localStorage.removeItem(KEY);setJobs([])}
 const active=jobs.filter(x=>x.status==="downloading"||x.status==="queued");
 return <main>
  <header><a className="brand" href="/">DRIFT</a><a className="nav" href="/library">Library</a><a className="nav" href="/addons">Addons</a></header>
  <section className="hero"><span className="eyebrow">DOWNLOADS</span><h1>Your downloads.</h1><p>Track direct media and FFmpeg-converted HLS downloads started from the player.</p></section>
  <section className="panel">
   <div className="sectionHead"><h2>Download Manager</h2><div><button onClick={refresh}>Refresh</button><button onClick={clear}>Clear history</button></div></div>
   {active.length>0&&<p className="success">{active.length} download{active.length===1?"":"s"} active. Keep this tab open while a browser download is being prepared.</p>}
   {!jobs.length?<div className="empty"><h2>No downloads yet</h2><a href="/">Browse your addons →</a></div>:
   <div className="downloadList">{jobs.map(j=><article className="downloadItem" key={j.id}>
    <div className="downloadTop"><strong>{j.title}</strong><span>{j.type==="hls"?"HLS":"Direct file"}</span></div>
    <div className="downloadBar"><i style={{width:Math.max(0,Math.min(100,j.progress))+"%"}}/></div>
    <div className="downloadMeta"><span>{j.status==="downloading"?Math.round(j.progress)+"%":j.status==="complete"?"Complete":j.status==="failed"?"Failed":"Queued"}</span><small>{new Date(j.createdAt).toLocaleString()}</small></div>
    {j.error&&<p className="error">{j.error}</p>}
   </article>)}</div>}
  </section>
 </main>
}
