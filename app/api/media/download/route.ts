import {NextRequest,NextResponse} from "next/server";
import {spawn} from "node:child_process";
import {createReadStream} from "node:fs";
import {mkdtemp,stat,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

export const runtime="nodejs";

function decodeHeaders(raw:string){
  if(!raw)return {} as Record<string,string>;
  try{
    const parsed=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));
    const out:Record<string,string>={};
    if(parsed&&typeof parsed==="object")for(const [k,v] of Object.entries(parsed)){
      if(typeof v!=="string")continue;
      const n=k.toLowerCase();
      if(["host","connection","content-length","transfer-encoding"].includes(n))continue;
      if(/^[a-z0-9-]+$/i.test(k))out[k]=v;
    }
    return out;
  }catch{return {} as Record<string,string>}
}
function safeName(x:string){return (x.replace(/[^a-z0-9._ -]+/gi,"").trim()||"Drift").slice(0,100)}
function isHlsUrl(raw:string){return /\.m3u8(?:[?#]|$)/i.test(raw)}
function contentDisposition(name:string){return 'attachment; filename="'+safeName(name)+'.mp4"'}

async function runFfmpeg(args:string,out:string){
  return await new Promise<void>((resolve,reject)=>{
    const child=spawn(process.env.FFMPEG_PATH||"ffmpeg",args,{stdio:["ignore","ignore","pipe"]});
    let stderr="";
    child.stderr.on("data",c=>{stderr=(stderr+c.toString()).slice(-12000)});
    child.on("error",reject);
    child.on("close",code=>code===0?resolve():reject(new Error(stderr.trim()||("FFmpeg exited with code "+code))));
  });
}

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get("url"),ph=req.nextUrl.searchParams.get("ph")||"",name=req.nextUrl.searchParams.get("name")||"Drift";
  if(!raw||!/^https?:\/\//i.test(raw))return NextResponse.json({error:"Missing or invalid media URL"},{status:400});
  try{
    const target=new URL(raw),headers=decodeHeaders(ph);

    if(isHlsUrl(raw)){
      const dir=await mkdtemp(join(tmpdir(),"drift-hls-"));
      const out=join(dir,"download.mp4");
      try{
        const headerLines=Object.entries(headers).map(([k,v])=>k+": "+v).join("\r\n");
        const ua=headers["User-Agent"]||headers["user-agent"]||"Drift/0.1";
        const args=[
          "-hide_banner","-loglevel","error",
          "-user_agent",ua,
          ...(headerLines?["-headers",headerLines+"\r\n"]:[]),
          "-i",target.toString(),
          "-map","0:v:0?","-map","0:a:0?",
          "-c:v","copy",
          "-c:a","copy",
          "-movflags","+faststart",
          "-y",out
        ];
        await runFfmpeg(args,out);
        const info=await stat(out);
        if(info.size<1024*10)throw new Error("FFmpeg produced an unexpectedly small MP4 ("+info.size+" bytes).");
        const stream=Readable.toWeb(createReadStream(out)) as ReadableStream<Uint8Array>;
        const cleanup=()=>rm(dir,{recursive:true,force:true}).catch(()=>{});
        stream.getReader().read().then(()=>{}).catch(()=>{});
        return new NextResponse(new ReadableStream({
          start(controller){
            const rs=createReadStream(out);
            rs.on("data",c=>controller.enqueue(new Uint8Array(c)));
            rs.on("end",async()=>{controller.close();await cleanup()});
            rs.on("error",async e=>{controller.error(e);await cleanup()});
          },
          cancel:cleanup
        }),{headers:{
          "content-type":"video/mp4",
          "content-length":String(info.size),
          "content-disposition":contentDisposition(name),
          "cache-control":"no-store",
          "access-control-allow-origin":"*"
        }});
      }catch(e){await rm(dir,{recursive:true,force:true});throw e}
    }

    const upstream=await fetch(target,{headers:{"user-agent":"Drift/0.1","accept":"*/*",...headers},cache:"no-store",redirect:"follow"});
    if(!upstream.ok)return new NextResponse(await upstream.text(),{status:upstream.status});
    const ct=upstream.headers.get("content-type")||"application/octet-stream";
    if(!/^(video\/(mp4|webm|ogg)|application\/octet-stream)$/i.test(ct))return NextResponse.json({error:"Downloads are currently available for direct video files only."},{status:415});
    const ext=ct.includes("webm")?"webm":ct.includes("ogg")?"ogv":"mp4";
    const safe=safeName(name);
    return new NextResponse(await upstream.arrayBuffer(),{headers:{"content-type":ct,"content-disposition":'attachment; filename="'+safe+"."+ext+'"',"cache-control":"no-store","access-control-allow-origin":"*"}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Download failed"},{status:502})}
}
