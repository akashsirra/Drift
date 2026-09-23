"use client";

import {Suspense,useEffect,useMemo,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import Hls from "hls.js";

type Subtitle={url:string;lang?:string;label?:string;id?:string};

function P(){
 const p=useSearchParams(),u=p.get("url")||"",t=p.get("title")||"Drift Player",ph=p.get("ph")||"",id=p.get("id")||"",type=p.get("type")||"movie",poster=p.get("poster")||"";
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const [error,setError]=useState(""),[duration,setDuration]=useState(0),[resume,setResume]=useState(0);
 const subs=useMemo<Subtitle[]>(()=>{try{return JSON.parse(atob(p.get("subs")||""))||[]}catch{return[]}},[p]);
 const isHls=/\.m3u8(\?|$)/i.test(u),isMedia=/\.(mp4|webm|ogg)(\?|$)/i.test(u);
 const progressKey=id?(type+":"+id):("url:"+u);

 useEffect(()=>{const raw=localStorage.getItem("drift-progress");try{const all=raw?JSON.parse(raw):{};const item=all[progressKey];if(item?.position>5&&item?.position<Math.max(item.duration-30,0))setResume(item.position)}catch{}},[progressKey]);

 useEffect(()=>{
  const v=videoRef.current;if(!v||!u)return;
  setError("");
  const save=()=>{try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");all[progressKey]={id,type,title:t,poster,url:u,ph,subs,position:v.currentTime||0,duration:v.duration||duration,updatedAt:Date.now()};localStorage.setItem("drift-progress",JSON.stringify(all))}catch{}};
  const onTime=()=>{if(Math.floor(v.currentTime)%5===0)save()};
  v.addEventListener("timeupdate",onTime);v.addEventListener("pause",save);v.addEventListener("ended",()=>{try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");delete all[progressKey];localStorage.setItem("drift-progress",JSON.stringify(all))}catch{}});
  if(isHls){
   if(Hls.isSupported()){const h=new Hls({enableWorker:false});h.loadSource("/api/media/proxy?url="+encodeURIComponent(u)+(ph?"&ph="+encodeURIComponent(ph):""));h.attachMedia(v);h.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)setError("HLS playback failed. The source may require authorization or headers that a browser cannot supply.")});return()=>{h.destroy();v.removeEventListener("timeupdate",onTime);v.removeEventListener("pause",save)}}
   if(v.canPlayType("application/vnd.apple.mpegurl")){v.src=u}else setError("This browser does not support HLS playback.");
  }else if(isMedia)v.src=u;else setError("This stream is not a browser-native media URL.");
  return()=>{v.removeEventListener("timeupdate",onTime);v.removeEventListener("pause",save)};
 },[u,isHls,isMedia,ph,progressKey,duration,t,type,poster,subs]);

 useEffect(()=>{const v=videoRef.current;if(v&&resume>0){const set=()=>{try{v.currentTime=resume}catch{}};if(v.readyState>=1)set();else v.addEventListener("loadedmetadata",set,{once:true});return()=>v.removeEventListener("loadedmetadata",set)}},[resume]);

 return <main className="watch"><a className="back" href="/">← Drift</a><h1>{t}</h1>
 {isHls||isMedia?<><video ref={videoRef} className="video" controls autoPlay playsInline preload="metadata" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)}/>
 {subs.length>0&&<div className="subtitleList"><strong>Subtitles</strong>{subs.map((s,i)=><a key={s.id||i} href={"/api/media/proxy?url="+encodeURIComponent(s.url)+(ph?"&ph="+encodeURIComponent(ph):"")} target="_blank" rel="noreferrer">{s.label||s.lang||"Subtitle "+(i+1)}</a>)}</div>}
 {resume>0&&<p className="resumeNote">Resuming from {Math.floor(resume/60)}:{String(Math.floor(resume%60)).padStart(2,"0")}</p>}
 {error&&<div className="playerNotice"><h2>Playback error</h2><p>{error}</p><code>{u}</code></div>}</>:<div className="playerNotice"><h2>Stream resolved</h2><p>This stream uses a transport Drift's browser player does not support yet.</p><code>{u}</code></div>}
 </main>
}
export default function Watch(){return <Suspense fallback={<main className="watch">Loading…</main>}><P/></Suspense>}
