"use client";
import {useEffect,useState} from "react";
type I={id:string;type:string;name:string;poster?:string;releaseInfo?:string};
type P={id:string;type:string;title:string;poster?:string;url:string;ph?:string;subs?:unknown[];position:number;duration:number;updatedAt:number;episodeId?:string;season?:string;episode?:string};
export default function Library(){
 const [a,setA]=useState<I[]>([]),[progress,setProgress]=useState<P[]>([]);
 useEffect(()=>{try{setA(JSON.parse(localStorage.getItem("drift-library")||"[]"));const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");setProgress(Object.values(all).filter((x:any)=>x.position>5&&x.duration>0).sort((x:any,y:any)=>y.updatedAt-x.updatedAt) as P[])}catch{}},[]);
 function remove(id:string){const next=a.filter(x=>x.id!==id);setA(next);localStorage.setItem("drift-library",JSON.stringify(next))}
 function href(x:P){const q=new URLSearchParams({url:x.url,title:x.title,id:x.id||"",type:x.type||"movie",poster:x.poster||"",ph:x.ph||"",subs:btoa(JSON.stringify(x.subs||[])),episodeId:x.episodeId||"",season:x.season||"",episode:x.episode||""});return "/watch?"+q.toString()}
 return <main><header><a className="brand" href="/">DRIFT</a><a className="nav" href="/addons">Addons</a></header>
 <section className="hero compactHero"><span className="eyebrow">YOUR LIBRARY</span><h1>Keep it close.</h1><p>Saved titles and playback progress stay on this device.</p></section>
 {progress.length>0&&<section className="catalog"><div className="sectionHead"><h2>Continue Watching</h2><span>{progress.length} in progress</span></div><div className="grid">{progress.map(x=><a className="card" key={x.id||x.url} href={href(x)}>{x.poster?<img src={x.poster}/>:<div className="posterFallback">DRIFT</div>}<strong>{x.title}</strong><small>{x.season&&x.episode?"S"+x.season+" E"+x.episode+" · ":""}{Math.floor(x.position/60)}:{String(Math.floor(x.position%60)).padStart(2,"0")} / {Math.floor(x.duration/60)}:{String(Math.floor(x.duration%60)).padStart(2,"0")}</small></a>)}</div></section>}
 {a.length?<div className="grid libraryGrid">{a.map(x=><article className="card" key={x.id}>{x.poster?<img src={x.poster}/>:<div className="posterFallback">DRIFT</div>}<strong>{x.name}</strong><small>{x.releaseInfo||x.type}</small><button className="libraryRemove" onClick={()=>remove(x.id)}>Remove</button></article>)}</div>:<section className="empty"><h2>Your library is empty</h2><a href="/">Browse addons →</a></section>}
 </main>
}