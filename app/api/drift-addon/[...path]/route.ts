import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {readdir,stat} from "node:fs/promises";
import path from "node:path";
import {Readable} from "node:stream";

const ROOT=path.resolve(process.env.DRIFT_MEDIA_ROOT||path.join(process.env.HOME||process.cwd(),"storage","movies"));
const VIDEO_EXTS=new Set([".mp4",".webm",".m4v",".mov",".mkv",".ogg"]);
const MIME:Record<string,string>={".mp4":"video/mp4",".webm":"video/webm",".m4v":"video/mp4",".mov":"video/quicktime",".mkv":"video/x-matroska",".ogg":"video/ogg"};

function cors(h:Headers){h.set("access-control-allow-origin","*");h.set("cache-control","no-store");return h}
function idFor(rel:string){return "local:"+createHash("sha1").update(rel).digest("hex").slice(0,16)}
function safeFile(file:string){
 const resolved=path.resolve(ROOT,file);
 if(resolved!==ROOT&&!resolved.startsWith(ROOT+path.sep))return null;
 return resolved;
}
async function mediaFiles(dir=ROOT,prefix=""):Promise<string[]>{
 const out:string[]=[];
 let entries:any[]=[];
 try{entries=await readdir(dir,{withFileTypes:true})}catch{return out}
 for(const e of entries){
  const rel=path.join(prefix,e.name);
  if(e.name.startsWith("."))continue;
  if(e.isDirectory())out.push(...await mediaFiles(path.join(dir,e.name),rel));
  else if(VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))out.push(rel);
 }
 return out;
}
function titleFromFile(file:string){return path.basename(file,path.extname(file)).replace(/[._-]+/g," ").replace(/\s+/g," ").trim()||"Untitled"}
async function metas(search=""){
 const files=(await mediaFiles()).slice(0,500);
 const q=search.trim().toLowerCase();
 return (await Promise.all(files.map(async rel=>{
   if(q&&!titleFromFile(rel).toLowerCase().includes(q))return null;
   const full=safeFile(rel);if(!full)return null;
   const s=await stat(full).catch(()=>null);if(!s?.isFile())return null;
   const id=idFor(rel);
   return {id,type:"movie",name:titleFromFile(rel),releaseInfo:"Local",description:"A movie from your Drift media library.",behaviorHints:{defaultVideoId:id}};
 }))).filter(Boolean);
}
async function streamFor(id:string){
 const files=await mediaFiles();
 for(const rel of files)if(idFor(rel)===id){
   const ext=path.extname(rel).toLowerCase();
   const u="/api/drift-addon/media?file="+encodeURIComponent(rel)+"&ext="+encodeURIComponent(ext);
   return {streams:[{name:"Drift Local · "+ext.replace(".","").toUpperCase(),url:u}]};
 }
 return {streams:[]};
}
async function media(req:NextRequest){
 const file=req.nextUrl.searchParams.get("file")||"";
 const full=safeFile(file);
 if(!full)return NextResponse.json({error:"Invalid media path"},{status:400});
 const info=await stat(full).catch(()=>null);
 if(!info?.isFile()||!VIDEO_EXTS.has(path.extname(full).toLowerCase()))return NextResponse.json({error:"Media not found"},{status:404});
 const ext=path.extname(full).toLowerCase(),mime=MIME[ext]||"application/octet-stream",range=req.headers.get("range");
 const headers=cors(new Headers({"content-type":mime,"accept-ranges":"bytes","cross-origin-resource-policy":"cross-origin"}));
 if(range){
   const m=/bytes=(\d+)-(\d*)/.exec(range);
   if(!m)return new NextResponse(null,{status:416,headers});
   const start=Number(m[1]),end=Math.min(m[2]?Number(m[2]):info.size-1,info.size-1);
   if(start> end||start>=info.size){headers.set("content-range",`bytes */${info.size}`);return new NextResponse(null,{status:416,headers})}
   headers.set("content-range",`bytes ${start}-${end}/${info.size}`);
   headers.set("content-length",String(end-start+1));
   return new NextResponse(Readable.toWeb(createReadStream(full,{start,end})) as ReadableStream,{status:206,headers});
 }
 headers.set("content-length",String(info.size));
 return new NextResponse(Readable.toWeb(createReadStream(full)) as ReadableStream,{status:200,headers});
}

export async function GET(req:NextRequest){
 const parts=(req.nextUrl.pathname.split("/api/drift-addon/")[1]||"").split("/").filter(Boolean);
 const key=parts.join("/");
 if(key==="manifest.json"){
   return NextResponse.json({
     id:"org.drift.local",
     version:"0.1.0",
     name:"Drift Local",
     description:"A local-first Stremio addon for media files you control on this device.",
     logo:"",
     types:["movie"],
     idPrefixes:["local:"],
     catalogs:[{type:"movie",id:"local-library",name:"Local Movies",extra:[{name:"search",isRequired:false}]}],
     resources:["catalog","meta","stream"]
   },{headers:cors(new Headers({"content-type":"application/json"}))});
 }
 if(key.startsWith("media"))return media(req);
 const match=key.match(/^(catalog|meta|stream)\/([^/]+)\/([^/]+?)(?:\.json)?$/);
 if(!match)return NextResponse.json({error:"Not found"},{status:404,headers:cors(new Headers())});
 const [,resource,type,id]=match;
 if(type!=="movie")return NextResponse.json({error:"Only movie is supported by Drift Local for now"},{status:404,headers:cors(new Headers())});
 if(resource==="catalog"){
   const search=req.nextUrl.searchParams.get("search")||"";
   return NextResponse.json({metas:await metas(search)},{headers:cors(new Headers({"content-type":"application/json"}))});
 }
 if(resource==="meta"){
   const all=await metas();const m=all.find((x:any)=>x.id===id);
   if(!m)return NextResponse.json({meta:[]},{headers:cors(new Headers())});
   return NextResponse.json({meta:[{...m,videos:[{id:m.id,title:m.name,season:1,episode:1}]}]},{headers:cors(new Headers({"content-type":"application/json"}))});
 }
 return NextResponse.json(await streamFor(id),{headers:cors(new Headers({"content-type":"application/json"}))});
}
