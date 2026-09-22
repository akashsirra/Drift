"use client";

import {Suspense,useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import Hls from "hls.js";

function P(){
 const p=useSearchParams(),u=p.get("url")||"",t=p.get("title")||"Drift Player";
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const [error,setError]=useState("");
 const isHls=/\.m3u8(\?|$)/i.test(u),isMedia=/\.(mp4|webm|ogg)(\?|$)/i.test(u);
 useEffect(()=>{
  const v=videoRef.current;if(!v||!u)return;
  setError("");
  if(isHls){
   if(Hls.isSupported()){
    const h=new Hls({enableWorker:false});
    h.loadSource("/api/media/proxy?url="+encodeURIComponent(u));h.attachMedia(v);
    h.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)setError("HLS playback failed. The source may require authorization or headers that a browser cannot supply.")});
    return()=>h.destroy();
   }
   if(v.canPlayType("application/vnd.apple.mpegurl")){v.src=u;return}
   setError("This browser does not support HLS playback.");
   return;
  }
  if(isMedia)v.src=u;
  else setError("This stream is not a browser-native media URL.");
 },[u,isHls,isMedia]);
 return <main className="watch"><a className="back" href="/">← Drift</a><h1>{t}</h1>{isHls||isMedia?<><video ref={videoRef} className="video" controls autoPlay playsInline preload="metadata"/>{error&&<div className="playerNotice"><h2>Playback error</h2><p>{error}</p><code>{u}</code></div>}</>:<div className="playerNotice"><h2>Stream resolved</h2><p>This stream uses a transport Drift's browser player does not support yet.</p><code>{u}</code></div>}</main>
}
export default function Watch(){return <Suspense fallback={<main className="watch">Loading…</main>}><P/></Suspense>}
