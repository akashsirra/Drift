"use client";

import {useEffect,useState} from "react";

type Extra={name:string;isRequired?:boolean;options?:string[]};
type Addon={id:string;name:string;description?:string;logo?:string;url:string;resources?:unknown[];catalogs?:{id:string;type:string;name:string;extra?:Extra[]}[];types?:string[];idPrefixes?:string[];behaviorHints?:{configurable?:boolean};config?:unknown[]};
type Meta={id:string;type:string;name:string;poster?:string;background?:string;description?:string;releaseInfo?:string;genres?:string[];videos?:{id:string;title:string;released?:string;thumbnail?:string}[]};
type Stream={name?:string;title?:string;url?:string;ytId?:string;infoHash?:string;externalUrl?:string;behaviorHints?:Record<string,unknown>};

const KEY="drift-addons",LIB="drift-library";

function normalizeAddonUrl(value:string){const v=value.trim();if(v.startsWith("stremio://"))return "https://"+v.slice("stremio://".length);return v}

export default function Home(){
 const [addons,setAddons]=useState<Addon[]>([]),[url,setUrl]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[selected,setSelected]=useState<Meta|null>(null),[streams,setStreams]=useState<Stream[]>([]),[query,setQuery]=useState(""),[testId,setTestId]=useState(""),[testType,setTestType]=useState<"movie"|"series">("movie"),[testing,setTesting]=useState(false);
 useEffect(()=>{try{setAddons(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{}},[]);
 function save(a:Addon[]){setAddons(a);localStorage.setItem(KEY,JSON.stringify(a))}
 async function install(){setError("");setNotice("");setLoading(true);try{const normalized=normalizeAddonUrl(url);const r=await fetch("/api/addon/manifest?url="+encodeURIComponent(normalized));const j=await r.json();if(!r.ok)throw Error(j.error||"Could not load addon");if(!j.id||!j.name)throw Error("The URL did not return a valid addon manifest.");const a={...j,url:normalized};save([...addons.filter(x=>x.url!==normalized),a]);setUrl("");setNotice("Installed “"+j.name+"”. "+((j.catalogs||[]).length===0?"This is a stream-only addon; use Stream Resolver below or open a title from another catalog.":""))}catch(e){setError(e instanceof Error?e.message:"Failed to install addon")}finally{setLoading(false)}}
 async function openMeta(a:Addon,m:Meta){
  setSelected(m);setStreams([]);setError("");setNotice("");
  try{
    const metaResult=await fetch("/api/addon/resource?addon="+encodeURIComponent(a.url)+"&resource=meta&type="+m.type+"&id="+encodeURIComponent(m.id));
    if(metaResult.ok){const j=await metaResult.json();setSelected(j.meta?.[0]||m)}
    const streamAddons=addons.filter(x=>Array.isArray(x.resources)&&x.resources.some((r:any)=>r==="stream"||(r?.name==="stream")));
    if(!streamAddons.length){
      setNotice("No stream addon is installed. Install a stream-capable addon to get Play options.");
      return;
    }
    const results=await Promise.all(streamAddons.map(async x=>{
      try{
        const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(x.url)+"&resource=stream&type="+m.type+"&id="+encodeURIComponent(m.id));
        if(!r.ok)return [];
        const j=await r.json();
        return (j.streams||[]).map((s:Stream)=>({...s,__addon:x.name}));
      }catch{return []}
    }));
    const merged=results.flat();
    setStreams(merged);
    setNotice(merged.length?"Streams found from installed stream addon(s).":"No streams were returned for this title.");
  }catch(e){setError(e instanceof Error?e.message:"Failed to resolve title")}
 } async function resolveId(){if(!testId.trim()){setError("Enter a movie/series ID, for example an IMDb tt ID.");return}setError("");setNotice("");setTesting(true);setStreams([]);const streamAddons=addons.filter(a=>Array.isArray(a.resources)&&a.resources.some((r:any)=>r==="stream"||(r?.name==="stream")));if(!streamAddons.length){setError("Install a stream-capable addon first.");setTesting(false);return}try{const results=await Promise.all(streamAddons.map(async a=>{const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(a.url)+"&resource=stream&type="+testType+"&id="+encodeURIComponent(testId.trim()));if(!r.ok)return [];const j=await r.json();return (j.streams||[]).map((s:Stream)=>({...s,__addon:a.name}))}));const merged=results.flat();setStreams(merged);setNotice(merged.length?"Found "+merged.length+" stream(s) across installed addons.":"No streams were returned for that ID.")}catch(e){setError(e instanceof Error?e.message:"Stream resolution failed")}finally{setTesting(false)}}
 function library(){if(!selected)return;const old=JSON.parse(localStorage.getItem(LIB)||"[]");if(!old.some((x:Meta)=>x.id===selected.id))localStorage.setItem(LIB,JSON.stringify([...old,selected]));setNotice("Added to Library.")}
 const streamLinks=(items:Stream[],title:string)=> <div className="streams">{items.map((s,i)=>s.url?<a key={i} href={"/watch?url="+encodeURIComponent(s.url)+"&title="+encodeURIComponent(title)+"&ph="+encodeURIComponent(btoa(JSON.stringify((s.behaviorHints as any)?.proxyHeaders?.request||{})))} className="stream">{s.name||s.title||"Play"} ▶</a>:s.externalUrl?<a key={i} href={s.externalUrl} target="_blank" rel="noreferrer" className="stream">{s.name||s.title||"Open external"} ↗</a>:<span key={i} className="stream">{s.name||s.title||s.infoHash||"Unsupported stream transport"}</span>)}</div>;
 return <main>
  <header><a href="/" className="brand">DRIFT</a><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your addons..."/><a className="nav" href="/library">Library</a><a className="nav" href="/addons">Addons</a></header>
  <section className="hero"><span className="eyebrow">YOUR CONTENT. YOUR ADDONS.</span><h1>One home for your media.</h1><p>Install compatible addons, browse catalogs and resolve streams in one clean interface.</p></section>
  <section className="panel"><h2>Add an addon</h2><div className="install"><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")install()}} placeholder="https://example.com/manifest.json or stremio://..."/><button onClick={install} disabled={loading||!url}>{loading?"Adding…":"Add addon"}</button></div>{error&&<p className="error">{error}</p>}{notice&&<p className="success">{notice}</p>}</section>
  <section className="panel"><h2>Stream Resolver</h2><p>Test installed stream-capable addons directly with a title ID.</p><div className="install"><select value={testType} onChange={e=>setTestType(e.target.value as "movie"|"series")}><option value="movie">Movie</option><option value="series">Series</option></select><input value={testId} onChange={e=>setTestId(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")resolveId()}} placeholder="IMDb ID, e.g. tt0133093"/><button onClick={resolveId} disabled={testing}>{testing?"Resolving…":"Resolve streams"}</button></div>{streamLinks(streams,"Stream")}</section>
  {addons.map(a=><AddonSection key={a.url} addon={a} query={query} onOpen={openMeta}/>)}
  {addons.length===0&&<section className="empty"><h2>Nothing installed yet</h2><p>Add a compatible addon manifest above to populate Drift.</p></section>}
  {selected&&<div className="modal"><div className="modalCard"><button className="close" onClick={()=>setSelected(null)}>×</button><div className="detail">{selected.poster&&<img src={selected.poster}/>}<div><span>{selected.type}</span><h2>{selected.name}</h2><p>{selected.description}</p><p>{selected.releaseInfo}</p><div className="actions"><button onClick={library}>＋ Library</button></div>{streamLinks(streams,selected.name)}</div></div></div></div>}
 </main>
}

function AddonSection({addon,query,onOpen}:{addon:Addon;query:string;onOpen:(a:Addon,m:Meta)=>void}){
 const [items,setItems]=useState<Meta[]>([]);
 useEffect(()=>{let dead=false;setItems([]);const load=async()=>{for(const c of addon.catalogs||[]){if(query&&!c.extra?.some(e=>e?.name==="search"))continue;const extra=query?"&search="+encodeURIComponent(query):"";const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(addon.url)+"&resource=catalog&type="+c.type+"&id="+encodeURIComponent(c.id)+extra);if(r.ok){const j=await r.json();if(!dead)setItems(x=>[...x,...(j.metas||[]).slice(0,20)])}}};load();return()=>{dead=true}},[addon.url,query]);
 if(!items.length)return <section className="panel addonInfo"><div className="sectionHead"><h2>{addon.name}</h2><span>Stream addon</span></div><p>{addon.description||"No catalog supplied. This addon can resolve streams when given a title ID."}</p><small>Types: {(addon.types||[]).join(", ")||"movie, series"}{addon.behaviorHints?.configurable?" · Configurable":""}</small></section>;
 return <section className="catalog"><div className="sectionHead"><h2>{addon.name}</h2><span>{items.length} items</span></div><div className="grid">{items.map((m,i)=><button className="card" key={m.id+"-"+i} onClick={()=>onOpen(addon,m)}>{m.poster?<img src={m.poster}/>:<div className="posterFallback">DRIFT</div>}<strong>{m.name}</strong><small>{m.releaseInfo||m.type}</small></button>)}</div></section>
}
