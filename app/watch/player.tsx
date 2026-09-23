"use client";
import {Suspense,useEffect,useMemo,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import Hls from "hls.js";

type Subtitle={url:string;lang?:string;label?:string;id?:string};
type Level={height:number;bitrate:number};
type AudioTrack={id:number;name:string;lang?:string;groupId?:string};
function streamExpiryMs(raw:string){
 try{
  const u=new URL(raw);
  for(const key of ["e","exp","expires","expiry","kx","t"]){
   const value=u.searchParams.get(key);
   if(!value)continue;
   const n=Number(value);
   if(!Number.isFinite(n))continue;
   const ms=n<100000000000? n*1000:n;
   if(ms>0)return ms;
  }
 }catch{}
 return 0;
}
function streamIsExpired(raw:string){const exp=streamExpiryMs(raw);return exp>0&&exp<=Date.now();}
function P(){
 const p=useSearchParams(),u=p.get("url")||"",t=p.get("title")||"Drift Player",ph=p.get("ph")||"",id=p.get("id")||"",type=p.get("type")||"movie",poster=p.get("poster")||"",episodeId=p.get("episodeId")||"",season=p.get("season")||"",episode=p.get("episode")||"",nextId=p.get("nextId")||"",nextTitle=p.get("nextTitle")||"",nextSeason=p.get("nextSeason")||"",nextEpisode=p.get("nextEpisode")||"";
 const addonUrls=useMemo<string[]>(()=>{
  try{
    const raw=p.get("addons")||"";
    if(!raw)return [];
    const parsed=JSON.parse(atob(raw));
    return Array.isArray(parsed)?parsed.filter((x):x is string=>typeof x==="string"&&x.length>0):[];
  }catch{return[]}
 },[p]);
 const videoRef=useRef<HTMLVideoElement|null>(null),playerRef=useRef<HTMLDivElement|null>(null),hlsRef=useRef<Hls|null>(null),hideRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [mounted,setMounted]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(""),[duration,setDuration]=useState(0),[resume,setResume]=useState(0),[fallbackIndex,setFallbackIndex]=useState(0),[fallbackName,setFallbackName]=useState(""),[candidates,setCandidates]=useState<{url:string;name?:string;title?:string;__addon?:string;behaviorHints?:Record<string,unknown>}[]>([]);
 const refreshKeyRef=useRef("");
 const [playing,setPlaying]=useState(false),[current,setCurrent]=useState(0),[volume,setVolume]=useState(1),[speed,setSpeed]=useState(1),[zoom,setZoom]=useState(1),[aspect,setAspect]=useState<"contain"|"cover"|"fill">("contain"),[rotate,setRotate]=useState(0),[fullscreen,setFullscreen]=useState(false),[pip,setPip]=useState(false),[levels,setLevels]=useState<Level[]>([]),[level,setLevel]=useState(-1),[audioTracks,setAudioTracks]=useState<AudioTrack[]>([]),[audioTrack,setAudioTrack]=useState(-1),[menu,setMenu]=useState<"cc"|"quality"|"speed"|"audio"|"more"|null>(null),[showControls,setShowControls]=useState(true),[nextCountdown,setNextCountdown]=useState(0),[nextLoading,setNextLoading]=useState(false);
 const subs=useMemo<Subtitle[]>(()=>{try{return JSON.parse(atob(p.get("subs")||""))||[]}catch{return[]}},[p]);
 const progressKey=episodeId?(type+":"+episodeId):(id?(type+":"+id):("url:"+u));
 const requestId=episodeId||id;
 const candidateKey=candidates.map(x=>x.url).join("|");
 const addonKey=addonUrls.join("|");
 const inputExpired=streamIsExpired(u);
 useEffect(()=>{
  try{
    const x=JSON.parse(localStorage.getItem("drift-stream-candidates")||"[]");
    if(Array.isArray(x)){
      const fresh=x.filter((s:any)=>s?.url&&!streamIsExpired(s.url)&&(!s.__videoId||!requestId||s.__videoId===requestId));
      setCandidates(fresh);
      localStorage.setItem("drift-stream-candidates",JSON.stringify(fresh));
    }
  }catch{}
 },[]);
 const active=candidates[fallbackIndex]?.url||u,activeHints:any=candidates[fallbackIndex]?.behaviorHints||{},activePh=activeHints.proxyHeaders?.request?btoa(JSON.stringify(activeHints.proxyHeaders.request)):ph;
 const isHls=/\.m3u8(\?|$)/i.test(active),isMkv=/\.mkv(\?|$)/i.test(active),isMedia=/\.(mp4|webm|ogg)(\?|$)/i.test(active),isPlayable=isHls||isMedia||isMkv;
 const activeSource=candidates[fallbackIndex]?.__addon||candidates[fallbackIndex]?.name||"Current stream";
 useEffect(()=>setMounted(true),[]);
 const touchControls=()=>{setShowControls(true);if(hideRef.current)clearTimeout(hideRef.current);hideRef.current=setTimeout(()=>setShowControls(false),3500)};
 useEffect(()=>{touchControls();return()=>{if(hideRef.current)clearTimeout(hideRef.current)}},[]);
 useEffect(()=>{try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");const item=all[progressKey];if(item?.position>5&&item?.position<Math.max(item.duration-30,0))setResume(item.position)}catch{}},[progressKey]);
 useEffect(()=>{
  if(inputExpired&&streamIsExpired(active)){
    return;
  }
  const v=videoRef.current;if(!v||!u)return;setError("");const save=()=>{try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");all[progressKey]={id,type,title:t,poster,url:u,ph,subs,episodeId,season,episode,addons:addonUrls,position:v.currentTime||0,duration:v.duration||duration,updatedAt:Date.now()};localStorage.setItem("drift-progress",JSON.stringify(all))}catch{}};const onTime=()=>{setCurrent(v.currentTime);if(Math.floor(v.currentTime)%5===0)save()};const onPlay=()=>setPlaying(true),onPause=()=>{setPlaying(false);save()};const onLoaded=()=>{setDuration(v.duration||0);if(resume>0&&resume<v.duration-30){try{v.currentTime=resume}catch{}}};const onEnded=()=>{try{const all=JSON.parse(localStorage.getItem("drift-progress")||"{}");delete all[progressKey];localStorage.setItem("drift-progress",JSON.stringify(all))}catch{};if(nextId)setNextCountdown(5)};const onVideoError=()=>{if(fallbackIndex+1<candidates.length){setFallbackIndex(x=>x+1);setFallbackName(candidates[fallbackIndex+1].name||candidates[fallbackIndex+1].title||"another stream");setError("Playback failed. Trying another available stream…")}else setError("The video could not be played. The stream may have expired or rejected the request.")};
 v.addEventListener("timeupdate",onTime);v.addEventListener("play",onPlay);v.addEventListener("pause",onPause);v.addEventListener("loadedmetadata",onLoaded);v.addEventListener("ended",onEnded);v.addEventListener("error",onVideoError);
 if(isHls){if(Hls.isSupported()){const h=new Hls({enableWorker:false,lowLatencyMode:false,backBufferLength:90});hlsRef.current=h;h.attachMedia(v);h.on(Hls.Events.MANIFEST_PARSED,()=>{setLevels(h.levels.map(x=>({height:x.height||0,bitrate:x.bitrate||0})));setAudioTracks(h.audioTracks.map(x=>({id:x.id,name:x.name||x.lang||("Audio "+(x.id+1)),lang:x.lang,groupId:x.groupId})));setAudioTrack(h.audioTrack);v.play().catch(()=>{})});
h.on(Hls.Events.AUDIO_TRACKS_UPDATED,(_,data)=>{setAudioTracks((data.audioTracks||[]).map((x:any)=>({id:x.id,name:x.name||x.lang||("Audio "+(x.id+1)),lang:x.lang,groupId:x.groupId})));setAudioTrack(h.audioTrack)});
h.on(Hls.Events.AUDIO_TRACK_SWITCHED,(_,data)=>setAudioTrack(data.id));h.loadSource("/api/media/proxy?url="+encodeURIComponent(active)+(activePh?"&ph="+encodeURIComponent(activePh):""));h.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal){if(tryNextCandidate(data.response?.code===401||data.response?.code===403?"The source rejected this stream.":"This stream failed."))return;
setError(activeSource+" failed. Refreshing stream candidates…");
refreshStreamCandidates().then(ok=>{
  if(!ok)setError("HLS playback failed. No other fresh candidate was returned.");
})}});return()=>{h.destroy();hlsRef.current=null}}if(v.canPlayType("application/vnd.apple.mpegurl"))v.src=active;else setError("This browser does not support HLS playback.")}else if(isMkv){
 const src="/api/media/download?mode=play&url="+encodeURIComponent(active)+(activePh?"&ph="+encodeURIComponent(activePh):"");
 v.src=src;
 v.load();
 v.play().catch(()=>{});
}else if(isMedia){
 const src="/api/media/proxy?url="+encodeURIComponent(active)+(activePh?"&ph="+encodeURIComponent(activePh):"");
 v.src=src;
 v.load();
 v.play().catch(()=>{});
}else setError("This stream is not a browser-native media URL.");
 return()=>{v.removeEventListener("timeupdate",onTime);v.removeEventListener("play",onPlay);v.removeEventListener("pause",onPause);v.removeEventListener("loadedmetadata",onLoaded);v.removeEventListener("ended",onEnded);v.removeEventListener("error",onVideoError)};
 },[active,isHls,isMkv,isMedia,activePh,progressKey,t,type,poster,subs,fallbackIndex,candidates.length,candidateKey,resume,nextId,inputExpired]);

 useEffect(()=>{
  let cancelled=false;
  const runFreshResolve=async()=>{
    try{
      const q=new URLSearchParams(window.location.search);
      const freshId=q.get("episodeId")||q.get("id")||"";
      const freshType=q.get("type")||"movie";
      const encoded=q.get("addons")||"";
      let freshAddons:string[]=[];
      try{
        const parsed=JSON.parse(atob(encoded));
        freshAddons=Array.isArray(parsed)?parsed.filter((x):x is string=>typeof x==="string"&&x.length>0):[];
      }catch{}
      if(!freshId||!freshAddons.length)return;
      const key=freshType+":"+freshId+":"+freshAddons.join("|");
      if(refreshKeyRef.current===key)return;
      refreshKeyRef.current=key;
      setRefreshing(true);
      setError("Refreshing stream…");
      const fresh=(await Promise.all(freshAddons.map(async a=>{
        try{
          const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(a)+"&resource=stream&type="+encodeURIComponent(freshType)+"&id="+encodeURIComponent(freshId)+"&_fresh="+Date.now()+"_"+Math.random().toString(36).slice(2),{cache:"no-store"});
          if(!r.ok)return[];
          const j=await r.json();
          return (Array.isArray(j.streams)?j.streams:[])
            .filter((x:any)=>x?.url&&!streamIsExpired(x.url))
            .map((x:any)=>({...x,__videoId:freshId,__addon:a}));
        }catch{return[]}
      }))).flat();
      if(cancelled)return;
      if(!fresh.length){
        setRefreshing(false);
        setError("The stream addon did not return a fresh playable stream.");
        return;
      }
      const unique=fresh.filter((x:any,i:number,a:any[])=>i===a.findIndex(y=>y.url===x.url)).slice(0,12);
      localStorage.setItem("drift-stream-candidates",JSON.stringify(unique));
      setCandidates(unique);
      setFallbackIndex(0);
      setFallbackName(unique[0]?.__addon||unique[0]?.name||"Fresh stream");
      setRefreshing(false);
      setError("");
    }catch{
      if(!cancelled){
        setRefreshing(false);
        setError("The stream addon refresh failed.");
      }
    }
  };
  runFreshResolve();
  return()=>{cancelled=true};
 },[]);

 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(["INPUT","TEXTAREA","SELECT"].includes((e.target as HTMLElement)?.tagName))return; if(e.key===" "){e.preventDefault();togglePlay()}else if(e.key==="ArrowLeft")seek(e.shiftKey?-30:-10);else if(e.key==="ArrowRight")seek(e.shiftKey?30:10);else if(e.key.toLowerCase()==="f")toggleFullscreen();else if(e.key.toLowerCase()==="m"){const v=videoRef.current;if(v){v.muted=!v.muted;setVolume(v.muted?0:v.volume)}}else if(e.key.toLowerCase()==="p")togglePip();else if(e.key==="+"||e.key==="=")changeZoom(zoom+.1);else if(e.key==="-")changeZoom(zoom-.1);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[zoom]);
 useEffect(()=>{if(!nextCountdown)return;const timer=setTimeout(()=>{if(nextCountdown<=1)goNext();else setNextCountdown(x=>x-1)},1000);return()=>clearTimeout(timer)},[nextCountdown]);
 async function refreshStreamCandidates(){
  if(!requestId||!addonUrls.length)return false;
  try{
    const fresh=(await Promise.all(addonUrls.map(async a=>{
      try{
        const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(a)+"&resource=stream&type="+type+"&id="+encodeURIComponent(requestId)+"&_fresh="+Date.now()+"_"+Math.random().toString(36).slice(2));
        if(!r.ok)return[];
        const j=await r.json();
        return (j.streams||[])
          .filter((x:any)=>x?.url&&!streamIsExpired(x.url))
          .map((x:any)=>({...x,__videoId:requestId,__addon:a}));
      }catch{return[]}
    }))).flat();
    if(!fresh.length)return false;
    const unique=fresh.filter((x:any,i:number,a:any[])=>i===a.findIndex(y=>y.url===x.url));
    localStorage.setItem("drift-stream-candidates",JSON.stringify(unique.slice(0,12)));
    setCandidates(unique.slice(0,12));
    setFallbackIndex(0);
    setFallbackName(unique[0]?.__addon||unique[0]?.name||"Fresh stream");
    setError("");
    return true;
  }catch{return false}
}
 async function goNext(){if(!nextId||nextLoading)return;setNextLoading(true);try{const rs=await Promise.all(addonUrls.map(async a=>{try{const r=await fetch("/api/addon/resource?addon="+encodeURIComponent(a)+"&resource=stream&type="+type+"&id="+encodeURIComponent(nextId));if(!r.ok)return[];const j=await r.json();return j.streams||[]}catch{return[]}}));const all=rs.flat().filter((s:any)=>s?.url);if(!all.length){setError("Next episode has no playable stream.");setNextCountdown(0);return}localStorage.setItem("drift-stream-candidates",JSON.stringify(all.slice(0,12)));const s=all[0],h=s.behaviorHints||{},sp=new URLSearchParams({url:s.url,title:nextTitle||"Next episode",ph:btoa(JSON.stringify(h.proxyHeaders?.request||{})),id,type,poster,subs:btoa(JSON.stringify(s.subtitles||[])),episodeId:nextId,season:nextSeason,episode:nextEpisode,nextId:"",nextTitle:"",nextSeason:"",nextEpisode:"",addons:btoa(JSON.stringify(addonUrls))});window.location.href="/watch?"+sp.toString()}finally{setNextLoading(false)}}
 async function togglePlay(){const v=videoRef.current;if(!v)return;if(v.paused)await v.play();else v.pause();touchControls()}
 function seek(delta:number){const v=videoRef.current;if(v){v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+delta));touchControls()}}
 async function toggleFullscreen(){const target=playerRef.current;const v=videoRef.current;if(!target||!v)return;try{if(!document.fullscreenElement){await target.requestFullscreen?.();setFullscreen(true);try{await (screen.orientation as any)?.lock?.("landscape")}catch{}}else{await document.exitFullscreen();setFullscreen(false);try{await (screen.orientation as any)?.unlock?.()}catch{}}}catch{}}
async function togglePip(){const v=videoRef.current;if(!v)return;try{if(document.pictureInPictureElement){await document.exitPictureInPicture();setPip(false)}else if((v as any).requestPictureInPicture){await (v as any).requestPictureInPicture();setPip(true)}}catch{}}
function changeZoom(x:number){setZoom(Math.max(.5,Math.min(3,x)));touchControls()}
function resetView(){setZoom(1);setAspect("contain");setRotate(0);setMenu(null);touchControls()}
function changeAspect(x:"contain"|"cover"|"fill"){setAspect(x);setMenu(null);touchControls()}
function toggleRotate(){setRotate(x=>(x+90)%360);touchControls()}

 function changeQuality(i:number){if(hlsRef.current){hlsRef.current.currentLevel=i;setLevel(i)}setMenu(null)}
 function changeAudio(i:number){if(hlsRef.current){hlsRef.current.audioTrack=i;setAudioTrack(i)}setMenu(null)}
 function chooseSpeed(x:number){const v=videoRef.current;if(v){v.playbackRate=x;setSpeed(x)}setMenu(null)}
 function chooseSubtitle(s:Subtitle){const v=videoRef.current;if(!v)return;v.querySelectorAll("track[data-drift]").forEach(x=>x.remove());const tr=document.createElement("track");tr.kind="subtitles";tr.label=s.label||s.lang||"Subtitle";tr.srclang=s.lang||"en";tr.src="/api/media/proxy?url="+encodeURIComponent(s.url)+(ph?"&ph="+encodeURIComponent(ph):"");tr.default=true;tr.setAttribute("data-drift","1");v.appendChild(tr);setTimeout(()=>{for(let i=0;i<v.textTracks.length;i++)v.textTracks[i].mode=i===v.textTracks.length-1?"showing":"disabled"},0);setMenu(null)}
 return <main className="watch"><a className="back" href="/">← Drift</a><div className="watchTitle"><h1>{t}</h1>{type==="series"&&season&&episode?<span className="episodeBadge">S{season} E{episode}</span>:null}{fallbackName&&<span>{fallbackName}</span>}</div>
 <div ref={playerRef} className="playerShell" onMouseMove={touchControls} onTouchStart={touchControls} onClickCapture={touchControls}>
 {isPlayable?(mounted?<video ref={videoRef} className="video" data-zoom={String(zoom)} data-aspect={aspect} data-rotate={String(rotate)} playsInline preload="metadata" poster={poster} onClick={togglePlay}/>:<div className="videoPlaceholder" style={{backgroundImage:`url(${poster})`}}/>):<div className="playerNotice"><h2>Stream resolved</h2><p>This stream uses a transport Drift browser player does not support yet.</p><code>{u}</code></div>}
 {mounted&&isPlayable&&showControls&&<div className="controlsOverlay"><div className="seekRow"><button onClick={()=>seek(-10)}>↶ 10</button><button className="bigPlay" onClick={togglePlay}>{playing?"❚❚":"▶"}</button><button onClick={()=>seek(10)}>10 ↷</button></div><input className="seekBar" type="range" min="0" max={duration||0.1} step="0.1" value={Math.min(current,duration||0)} onChange={e=>{const v=videoRef.current;if(v)v.currentTime=Number(e.target.value);touchControls()}}/><div className="controlBar"><button onClick={togglePlay}>{playing?"❚❚":"▶"}</button><span>{fmt(current)} / {fmt(duration)}</span><label>🔊<input className="volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>{const x=Number(e.target.value);setVolume(x);if(videoRef.current)videoRef.current.volume=x}}/></label>{levels.length>1&&<div className="menuBox"><button onClick={()=>setMenu(menu==="quality"?null:"quality")}>{level<0?"Auto":(levels[level]?.height?levels[level].height+"p":"Quality")}</button>{menu==="quality"&&<div className="popMenu"><button onClick={()=>changeQuality(-1)}>Auto</button>{levels.map((x,i)=><button key={i} onClick={()=>changeQuality(i)}>{x.height?x.height+"p":Math.round(x.bitrate/1000)+" kbps"}</button>)}</div>}</div>}{audioTracks.length>1&&<div className="menuBox"><button onClick={()=>setMenu(menu==="audio"?null:"audio")}>🔊 {audioTrack>=0?(audioTracks[audioTrack]?.name||"Audio"):"Audio"}</button>{menu==="audio"&&<div className="popMenu">{audioTracks.map(x=><button key={x.id} onClick={()=>changeAudio(x.id)}>{x.name}{x.lang&&x.name!==x.lang?" · "+x.lang:""}</button>)}</div>}</div>}<div className="menuBox"><button onClick={()=>setMenu(menu==="speed"?null:"speed")}>{speed}×</button>{menu==="speed"&&<div className="popMenu"><button onClick={()=>chooseSpeed(.75)}>.75×</button><button onClick={()=>chooseSpeed(1)}>1×</button><button onClick={()=>chooseSpeed(1.25)}>1.25×</button><button onClick={()=>chooseSpeed(1.5)}>1.5×</button><button onClick={()=>chooseSpeed(2)}>2×</button></div>}</div>{subs.length>0&&<div className="menuBox"><button onClick={()=>setMenu(menu==="cc"?null:"cc")}>CC</button>{menu==="cc"&&<div className="popMenu">{subs.map((s,i)=><button key={s.id||i} onClick={()=>chooseSubtitle(s)}>{s.label||s.lang||"Subtitle "+(i+1)}</button>)}</div>}</div>}
<div className="menuBox"><button onClick={()=>setMenu(menu==="more"?null:"more")}>⋮ More</button>{menu==="more"&&<div className="popMenu moreMenu"><strong>Zoom {Math.round(zoom*100)}%</strong><div className="zoomRow"><button onClick={()=>changeZoom(zoom-.1)}>−</button><button onClick={()=>changeZoom(1)}>100%</button><button onClick={()=>changeZoom(zoom+.1)}>＋</button></div><button onClick={()=>changeZoom(.5)}>50%</button><button onClick={()=>changeZoom(1.25)}>125%</button><button onClick={()=>changeZoom(1.5)}>150%</button><button onClick={()=>changeZoom(2)}>200%</button><button onClick={()=>changeZoom(3)}>300%</button><button onClick={()=>changeAspect("contain")}>Fit</button><button onClick={()=>changeAspect("cover")}>Fill / Crop</button><button onClick={()=>changeAspect("fill")}>Stretch</button><button onClick={toggleRotate}>Rotate 90°</button><button onClick={resetView}>Reset view</button></div>}</div>
<button onClick={togglePip}>{pip?"▣":"PiP"}</button><button onClick={toggleFullscreen}>{fullscreen?"⤢":"⛶"}</button>{(isMedia||isHls||isMkv)&&<button className="downloadBtn" onClick={startDownload} title={isHls?"Download HLS as MP4":"Download video"}>⇩</button>}</div></div>}
 {nextCountdown>0&&<div className="nextOverlay"><strong>Next episode in {nextCountdown}</strong><span>{nextTitle}</span><div><button onClick={goNext} disabled={nextLoading}>{nextLoading?"Loading…":"Play now"}</button><button onClick={()=>setNextCountdown(0)}>Cancel</button></div></div>}
 </div>{resume>0&&<p className="resumeNote">Resuming from {fmt(resume)}</p>}{error&&<div className="playerNotice"><h2>Playback error</h2><p>{error}</p><div className="playerErrorActions"><button onClick={()=>{setError("Refreshing stream…");refreshStreamCandidates()}}>↻ Refresh stream</button><button onClick={()=>history.back()}>← Back</button></div><code>{u}</code></div>}</main>
}
function safeFileName(x:string){return (x.replace(/[^a-z0-9._ -]/gi,"").trim()||"Drift").slice(0,80)}
function guessExt(u:string){const m=u.match(/\.(mp4|webm|ogg)(?:\?|$)/i);return m?"."+m[1].toLowerCase():".mp4"}
function fmt(n:number){if(!Number.isFinite(n)||n<0)return "0:00";const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.floor(n%60);return h?(h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")):(m+":"+String(s).padStart(2,"0"))}
export default P;