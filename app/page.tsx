"use client";

import {useEffect,useState} from "react";

type Extra={name:string;isRequired?:boolean;options?:string[]};
type Addon={id:string;name:string;description?:string;logo?:string;url:string;resources?:unknown[];catalogs?:{id:string;type:string;name:string;extra?:Extra[]}[];types?:string[];idPrefixes?:string[];behaviorHints?:{configurable?:boolean};config?:unknown[]};
type Meta={id:string;type:string;name:string;poster?:string;background?:string;description?:string;releaseInfo?:string;genres?:string[];videos?:{id:string;title:string;released?:string;thumbnail?:string;season?:number;episode?:number}[]};
type Stream={name?:string;title?:string;url?:string;ytId?:string;infoHash?:string;externalUrl?:string;behaviorHints?:Record<string,unknown>;subtitles?:{url:string;lang?:string;label?:string;id?:string}[];__addon?:string;__videoId?:string;__season?:number;__episode?:number};

const KEY="drift-addons",LIB="drift-library";

function normalizeAddonUrl(value:string){const v=value.trim();if(v.startsWith("stremio://"))return "https://"+v.slice("stremio://".length);return v}
function streamExpiryMs(raw:string){
 try{
  const u=new URL(raw);
  for(const key of ["e","exp","expires","expiry","kx","t"]){
   const value=u.searchParams.get(key);
   if(!value)continue;
   const n=Number(value);
   if(!Number.isFinite(n))continue;
   const ms=n<100000000000?n*1000:n;
   if(ms>0)return ms;
  }
 }catch{}
 return 0;
}
function streamIsFresh(raw?:string){
 if(!raw)return false;
 const exp=streamExpiryMs(raw);
 return !exp||exp>Date.now()+15000;
}
async function fetchAddonStreams(addon:string,type:string,id:string){
 const q="_fresh="+Date.now()+"_"+Math.random().toString(36).slice(2);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 let r:Response;
 try{r=await fetch("/api/addon/resource?addon="+encodeURIComponent(addon)+"&resource=stream&type="+encodeURIComponent(type)+"&id="+encodeURIComponent(id)+"&"+q,{cache:"no-store",signal:controller.signal})}catch{return []}finally{clearTimeout(timer)}
 if(!r.ok)return [];
 const j=await r.json();
 if(Array.isArray(j))return j;
 if(Array.isArray(j?.streams))return j.streams;
 if(Array.isArray(j?.result?.streams))return j.result.streams;
 return [];
}
function watchHref(s:Stream,title:string,meta?:Meta,addons:Addon[]=[]){const hints:any=s.behaviorHints||{};const subs=(hints.subtitles||hints.subtitle||s.subtitles||[]);const videoId=s.__videoId||(hints as any).videoId||((s as any).season!=null&&(s as any).episode!=null?meta?.id+":"+((s as any).season)+":"+((s as any).episode):"");const sSeason=s.__season??(s as any).season;const sEpisode=s.__episode??(s as any).episode;const idx=meta?.videos?.findIndex(v=>v.id===videoId||(sSeason!=null&&sEpisode!=null&&v.season===sSeason&&v.episode===sEpisode))??-1;const next=meta?.videos&&idx>=0?meta.videos[idx+1]:undefined;const streamAddonUrls=addons.filter(a=>Array.isArray(a.resources)&&a.resources.some((r:any)=>r==="stream"||(r?.name==="stream"))).map(a=>a.url);const params=new URLSearchParams({url:s.url||"",title,ph:btoa(JSON.stringify(hints.proxyHeaders?.request||{})),id:meta?.id||"",type:meta?.type||"",poster:meta?.poster||"",subs:btoa(JSON.stringify(subs)),episodeId:videoId,season:String(sSeason??""),episode:String(sEpisode??""),nextId:next?.id||"",nextTitle:next?.title||"",nextSeason:String(next?.season??""),nextEpisode:String(next?.episode??""),addons:btoa(JSON.stringify(streamAddonUrls))});return "/watch?"+params.toString()}

export default function Home(){
 const [addons,setAddons]=useState<Addon[]>([]),[url,setUrl]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[selected,setSelected]=useState<Meta|null>(null),[selectedAddon,setSelectedAddon]=useState<Addon|null>(null),[streams,setStreams]=useState<Stream[]>([]),[selectedSeason,setSelectedSeason]=useState(1),[query,setQuery]=useState(""),[testId,setTestId]=useState(""),[testType,setTestType]=useState<"movie"|"series">("movie"),[testing,setTesting]=useState(false),[resolving,setResolving]=useState(false);
 useEffect(()=>{try{setAddons(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{}},[]);
 function save(a:Addon[]){setAddons(a);localStorage.setItem(KEY,JSON.stringify(a))}
 async function install(){setError("");setNotice("");setLoading(true);try{const normalized=normalizeAddonUrl(url);const r=await fetch("/api/addon/manifest?url="+encodeURIComponent(normalized));const j=await r.json();if(!r.ok)throw Error(j.error||"Could not load addon");if(!j.id||!j.name)throw Error("The URL did not return a valid addon manifest.");const a={...j,url:normalized};save([...addons.filter(x=>x.url!==normalized),a]);setUrl("");setNotice("Installed “"+j.name+"”. "+((j.catalogs||[]).length===0?"This is a stream-only addon; use Stream Resolver below or open a title from another catalog.":""))}catch(e){setError(e instanceof Error?e.message:"Failed to install addon")}finally{setLoading(false)}}
 async function openMeta(a:Addon,m:Meta){
  setSelected(m);setSelectedAddon(a);setSelectedSeason(1);setStreams([]);setError("");setNotice("Resolving streams…");setResolving(true);
  try{
    const metaResult=await fetch("/api/addon/resource?addon="+encodeURIComponent(a.url)+"&resource=meta&type="+m.type+"&id="+encodeURIComponent(m.id));
    let full:Meta=m;
    if(metaResult.ok){const j=await metaResult.json();full=j.meta?.[0]||m}
    if(full.type==="series"){
      try{
        const er=await fetch("/api/series/episodes?imdb="+encodeURIComponent(full.id));
        if(er.ok){
          const ej=await er.json();
          const fallback=(ej.seasons||[]).flatMap((x:any)=>x.episodes||[]);
          const map=new Map<string,any>();
          for(const v of (full.videos||[]))map.set(v.id,v);
          for(const v of fallback)if(!map.has(v.id))map.set(v.id,v);
          full={...full,videos:[...map.values()].sort((x:any,y:any)=>(x.season||0)-(y.season||0)||(x.episode||0)-(y.episode||0))};
          const first=full.videos?.find(v=>(v.season||0)>0)?.season;
          if(first)setSelectedSeason(first);
        }
      }catch{}
    }
    setSelected(full);
    const streamAddons=addons.filter(x=>Array.isArray(x.resources)&&x.resources.some((r:any)=>r==="stream"||(r?.name==="stream")));
    if(!streamAddons.length){setNotice("No stream addon is installed. Install a stream-capable addon to get Play options.");return}
    setNotice("Finding the first playable stream…");
    const pending=streamAddons.map(async x=>{
      try{
        const raw=await fetchAddonStreams(x.url,full.type,full.id);
        return {addon:x.name,streams:raw.map((s:Stream)=>({...s,__addon:x.name}))};
      }catch{return {addon:x.name,streams:[] as Stream[]}}
    });
    const firstPlayable=new Promise<{addon:string;streams:Stream[]}>(resolve=>{
      let remaining=pending.length;
      let done=false;
      for(const p of pending){
        p.then(result=>{
          if(done)return;
          if(result.streams.some(s=>Boolean(s.url))){
            done=true;
            resolve(result);
            return;
          }
          remaining--;
          if(remaining===0){
            done=true;
            resolve({addon:"",streams:[]});
          }
        }).catch(()=>{
          remaining--;
          if(!done&&remaining===0){
            done=true;
            resolve({addon:"",streams:[]});
          }
        });
      }
    });
    const timeout=new Promise<{addon:string;streams:Stream[]}>(resolve=>setTimeout(()=>resolve({addon:"",streams:[]}),16000));
    const winner=await Promise.race([firstPlayable,timeout]);
    const merged=winner.streams;
    setStreams(merged);
    const playable=merged.filter((s:Stream)=>Boolean(s.url)).length;
    const external=merged.filter((s:Stream)=>!s.url&&Boolean(s.externalUrl)).length;
    setNotice(merged.length?("Ready: "+playable+" playable stream"+(playable===1?"":"s")+(external?" · "+external+" external":"")+" from "+winner.addon+"."):"No stream entries were returned within 16 seconds.");
  }catch(e){setError(e instanceof Error?e.message:"Failed to resolve title")}finally{setResolving(false)}
 } async function resolveStreamsFor(m:Meta,requestId?:string,titleOverride?:string){setStreams([]);setResolving(true);setError("");setNotice("");const providers=addons.filter(x=>Array.isArray(x.resources)&&x.resources.some((r:any)=>r==="stream"||(r?.name==="stream")));if(!providers.length){setNotice("No stream addon is installed.");return}const requestedId=requestId||m.id;const video=m.videos?.find(v=>v.id===requestedId);const results=await Promise.all(providers.map(async x=>{try{const raw=await fetchAddonStreams(x.url,m.type,requestedId);return raw.map((s:Stream)=>({...s,__addon:x.name,__videoId:requestedId,__season:video?.season,__episode:video?.episode}))}catch{return[]}}));const merged=results.flat();setStreams(merged);setNotice(merged.length?"Streams found from installed stream addon(s).":"No streams were returned for this episode.");if(titleOverride)setSelected({...m,name:titleOverride});setResolving(false)}
 async function openEpisode(m:Meta,v:{id:string;title:string;season?:number;episode?:number}){await resolveStreamsFor(m,v.id,m.name+" — "+v.title)}
 async function resolveId(){if(!testId.trim()){setError("Enter a movie/series ID, for example an IMDb tt ID.");return}setError("");setNotice("");setTesting(true);setStreams([]);const streamAddons=addons.filter(a=>Array.isArray(a.resources)&&a.resources.some((r:any)=>r==="stream"||(r?.name==="stream")));if(!streamAddons.length){setError("Install a stream-capable addon first.");setTesting(false);return}try{const results=await Promise.all(streamAddons.map(async a=>{const raw=await fetchAddonStreams(a.url,testType,testId.trim());return raw.map((s:Stream)=>({...s,__addon:a.name}))}));const merged=results.flat();setStreams(merged);const playable=merged.filter((s:Stream)=>Boolean(s.url)).length;setNotice(merged.length?"Found "+merged.length+" stream option(s) across installed addons ("+playable+" direct).":"No stream entries were returned for that ID.")}catch(e){setError(e instanceof Error?e.message:"Stream resolution failed")}finally{setTesting(false)}}
 function library(){if(!selected)return;const old=JSON.parse(localStorage.getItem(LIB)||"[]");if(!old.some((x:Meta)=>x.id===selected.id))localStorage.setItem(LIB,JSON.stringify([...old,selected]));setNotice("Added to Library.")}
 const streamLinks=(items:Stream[],title:string,meta?:Meta)=> <div className="streams">{items.map((s,i)=>s.url?<a key={i} href={watchHref(s,title,meta,addons)} onClick={()=>{try{localStorage.setItem("drift-stream-candidates",JSON.stringify(items.filter(x=>x.url).map(x=>({...x,__videoId:x.__videoId||meta?.id})).slice(0,12)))}catch{}}} className="stream">▶ {s.name||s.title||"Play in Drift"}</a>:s.externalUrl?<a key={i} href={s.externalUrl} target="_blank" rel="noreferrer" className="stream">{s.name||s.title||"Open external"} ↗</a>:<span key={i} className="stream">{s.name||s.title||s.infoHash||"Unsupported stream transport"}</span>)}</div>;
 return <main>
  <header><a href="/" className="brand">DRIFT</a><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your addons..."/><a className="nav" href="/library">Library</a><a className="nav" href="/addons">Addons</a></header>
  <section className="hero"><div className="heroCopy"><span className="eyebrow">DRIFT · LOCAL MEDIA</span><h1>Find something worth watching.</h1><p>Your addons, your library, one fast player. Pick a title and Drift gets you to playback without the clutter.</p></div>{addons.length===0&&<a className="heroCta" href="/addons">＋ Add your first addon</a>}</section>
  <ContinueWatching/>
  {addons.length===0?<section className="empty homeEmpty"><div className="emptyIcon">✦</div><h2>Your Drift starts here.</h2><p>Add a compatible addon to bring catalogs and streams into this local app.</p><a className="primaryAction" href="/addons">Browse addon manager</a></section>:addons.filter(a=>(a.catalogs||[]).length>0).map(a=><AddonSection key={a.url} addon={a} query={query} onOpen={openMeta}/>)}
  {selected&&<div className="modal"><div className="modalCard"><button className="close" onClick={()=>setSelected(null)}>×</button><div className="detail">{selected.poster&&<img src={selected.poster}/>}<div><span>{selected.type}</span><h2>{selected.name}</h2><p>{selected.description}</p><p>{selected.releaseInfo}</p><div className="actions"><button onClick={library}>＋ Library</button></div>{selected.type==="series"&&selected.videos?.length?<EpisodePicker meta={selected} season={selectedSeason} setSeason={setSelectedSeason} onEpisode={openEpisode}/>:null}<div className="playPanel"><div className="streamStatus">{resolving?"⏳ Finding playable streams…":notice||"Stream resolver ready."}</div>{error&&<div className="error">{error}</div>}{streams.length>0&&<div className="playLabel">PLAY OPTIONS</div>}{streamLinks(streams,selected.name,selected)}{!resolving&&!streams.length&&<button className="resolveAgain" onClick={()=>selectedAddon&&openMeta(selectedAddon,selected)} disabled={!selectedAddon}>↻ Resolve streams again</button>}</div></div></div></div></div>}
 </main>
}

function ContinueWatching(){
 const [items,setItems]=useState<any[]>([]);
 useEffect(()=>{try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");const rows=Object.values(all).filter((x:any)=>x?.url&&x?.position>0&&x?.duration&&x.position<x.duration-30).sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0));setItems(rows.slice(0,12))}catch{}},[]);
 function href(x:any){const q=new URLSearchParams({url:x.url,title:x.title||"Drift Player",ph:x.ph||"",id:x.id||"",type:x.type||"movie",poster:x.poster||"",subs:btoa(JSON.stringify(x.subs||[])),episodeId:x.episodeId||"",season:x.season||"",episode:x.episode||"",addons:btoa(JSON.stringify(x.addons||[]))});return "/watch?"+q.toString()}
 function remove(x:any){try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");const key=x.episodeId?(x.type+":"+x.episodeId):(x.id?(x.type+":"+x.id):("url:"+x.url));delete all[key];localStorage.setItem("drift-progress",JSON.stringify(all));setItems(items.filter(y=>y!==x))}catch{}}
 if(!items.length)return null;
 return <section className="continueSection"><div className="sectionHead"><h2>Continue Watching</h2><span>{items.length} in progress</span></div><div className="continueGrid">{items.map((x,i)=>{const pct=Math.max(0,Math.min(100,(x.position/x.duration)*100));return <article className="continueCard" key={(x.episodeId||x.id||x.url)+"-"+i}><a href={href(x)} className="continueLink">{x.poster?<img src={x.poster} alt=""/>:<div className="posterFallback">DRIFT</div>}<div className="continueInfo"><strong>{x.title||"Untitled"}</strong>{x.type==="series"&&x.season&&x.episode?<small>S{x.season} E{x.episode}</small>:null}<span>{fmtHome(x.position)} / {fmtHome(x.duration)}</span><i><b style={{width:pct+"%"}}/></i></div></a><button className="continueRemove" onClick={()=>remove(x)}>Remove</button></article>})}</div></section>
}
function fmtHome(n:number){if(!Number.isFinite(n)||n<0)return "0:00";const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.floor(n%60);return h?h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"):m+":"+String(s).padStart(2,"0")}
function EpisodePicker({meta,season,setSeason,onEpisode}:{meta:Meta;season:number;setSeason:(n:number)=>void;onEpisode:(m:Meta,v:any)=>void}){
 const seasons=[...new Set((meta.videos||[]).map(v=>v.season).filter((x):x is number=>Number.isInteger(x)&&x>0))].sort((a,b)=>a-b);
 const episodes=(meta.videos||[]).filter(v=>v.season===season).sort((a,b)=>(a.episode||0)-(b.episode||0));
 return <div className="episodePicker"><strong>Episodes</strong><div className="seasonTabs">{seasons.map(x=><button key={x} className={x===season?"active":""} onClick={()=>setSeason(x)}>Season {x}</button>)}</div><div className="episodeList">{episodes.map((v,i)=><button key={v.id||i} onClick={()=>onEpisode(meta,v)}>S{v.season} E{v.episode} · {v.title}</button>)}</div><a className="tvmazeCredit" href="https://www.tvmaze.com/" target="_blank" rel="noreferrer">Episode data by TVmaze</a></div>
}

function AddonSection({addon,query,onOpen}:{addon:Addon;query:string;onOpen:(a:Addon,m:Meta)=>void}){
 const [items,setItems]=useState<Meta[]>([]),[typeFilter,setTypeFilter]=useState<"movie"|"series">("movie"),[loading,setLoading]=useState(false),[catalogError,setCatalogError]=useState("");
 useEffect(()=>{let dead=false;setItems([]);setCatalogError("");setLoading(true);const load=async()=>{try{const catalogs=(addon.catalogs||[]).filter(c=>c.type===typeFilter&&(!query||c.extra?.some(e=>e?.name==="search")));const results=await Promise.all(catalogs.map(async c=>{const extra=query?"&search="+encodeURIComponent(query):"";try{const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(addon.url)+"&resource=catalog&type="+c.type+"&id="+encodeURIComponent(c.id)+extra,{cache:"no-store"});if(!r.ok)return[];const j=await r.json();return Array.isArray(j.metas)?j.metas:[]}catch{return[]}}));if(!dead){const seen=new Set<string>();const merged=results.flat().filter((m:Meta)=>m?.id&&!seen.has(m.id)&&seen.add(m.id)).slice(0,24);setItems(merged)}}catch(e){if(!dead)setCatalogError(e instanceof Error?e.message:"Catalog failed")}finally{if(!dead)setLoading(false)}};load();return()=>{dead=true}},[addon.url,query,typeFilter]);
 if(loading)return <section className="catalog"><div className="sectionHead"><h2>{addon.name}</h2><span>Loading…</span></div><div className="skeletonGrid">{Array.from({length:6}).map((_,i)=><div className="skeletonCard" key={i}/>)}</div></section>;
 if(!items.length)return <section className="panel addonInfo"><div className="sectionHead"><h2>{addon.name}</h2><span>{catalogError?"Unavailable":"No "+typeFilter+"s"}</span></div><p>{catalogError||addon.description||"No catalog supplied. This addon can resolve streams when given a title ID."}</p><small>Types: {(addon.types||[]).join(", ")||"movie, series"}{addon.behaviorHints?.configurable?" · Configurable":""}</small></section>;
 return <section className="catalog"><div className="sectionHead"><h2>{addon.name}</h2><span>{items.length} items</span><div className="typeTabs"><button className={typeFilter==="movie"?"active":""} onClick={()=>setTypeFilter("movie")}>Movies</button><button className={typeFilter==="series"?"active":""} onClick={()=>setTypeFilter("series")}>Series</button></div></div><div className="grid">{items.map((m,i)=><button className="card" key={m.id+"-"+i} onClick={()=>onOpen(addon,m)}>{m.poster?<img src={m.poster}/>:<div className="posterFallback">DRIFT</div>}<strong>{m.name}</strong><small>{m.releaseInfo||m.type}</small></button>)}</div></section>
}
