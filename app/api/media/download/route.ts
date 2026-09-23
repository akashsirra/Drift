import {NextRequest,NextResponse} from "next/server";
import {spawn} from "node:child_process";

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

function safeName(x:string){
  return (x.replace(/[^a-z0-9._ -]+/gi,"").trim()||"Drift").slice(0,100);
}

function isHlsUrl(raw:string){
  return /\.m3u8(?:[?#]|$)/i.test(raw);
}

function contentDisposition(name:string){
  return 'attachment; filename="'+safeName(name)+'.mp4"';
}

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get("url"),ph=req.nextUrl.searchParams.get("ph")||"",name=req.nextUrl.searchParams.get("name")||"Drift";
  if(!raw||!/^https?:\/\//i.test(raw))return NextResponse.json({error:"Missing or invalid media URL"},{status:400});

  try{
    const target=new URL(raw);
    const headers=decodeHeaders(ph);

    if(isHlsUrl(raw)){
      const ffmpeg=process.env.FFMPEG_PATH||"ffmpeg";
      const headerLines=Object.entries(headers).map(([k,v])=>k+": "+v).join("\r\n");
      const args=[
        "-hide_banner","-loglevel","error",
        "-user_agent",headers["User-Agent"]||headers["user-agent"]||"Drift/0.1",
        ...(headerLines?["-headers",headerLines+"\r\n"]:[]),
        "-i",target.toString(),
        "-map","0:v:0?","-map","0:a:0?",
        "-c:v","copy",
        "-c:a","copy",
        "-movflags","frag_keyframe+empty_moov",
        "-f","mp4",
        "pipe:1"
      ];

      const child=spawn(ffmpeg,args,{stdio:["ignore","pipe","pipe"]});
      let stderr="";
      child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-8000)});

      const body=new ReadableStream<Uint8Array>({
        start(controller){
          child.stdout.on("data",chunk=>controller.enqueue(new Uint8Array(chunk)));
          child.stdout.on("end",()=>controller.close());
          child.stdout.on("error",err=>controller.error(err));
          child.on("error",err=>controller.error(err));
          child.on("close",code=>{
            if(code!==0)controller.error(new Error(stderr.trim()||("FFmpeg exited with code "+code)));
          });
        },
        cancel(){
          child.kill("SIGTERM");
        }
      });

      return new NextResponse(body,{headers:{
        "content-type":"video/mp4",
        "content-disposition":contentDisposition(name),
        "cache-control":"no-store",
        "access-control-allow-origin":"*"
      }});
    }

    const upstream=await fetch(target,{headers:{"user-agent":"Drift/0.1","accept":"*/*",...headers},cache:"no-store",redirect:"follow"});
    if(!upstream.ok)return new NextResponse(await upstream.text(),{status:upstream.status});
    const ct=upstream.headers.get("content-type")||"application/octet-stream";
    if(!/^(video\/(mp4|webm|ogg)|application\/octet-stream)$/i.test(ct))return NextResponse.json({error:"Downloads are currently available for direct video files only."},{status:415});
    const ext=ct.includes("webm")?"webm":ct.includes("ogg")?"ogv":"mp4";
    const safe=safeName(name);
    return new NextResponse(await upstream.arrayBuffer(),{headers:{
      "content-type":ct,
      "content-disposition":'attachment; filename="'+safe+"."+ext+'"',
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Download failed"},{status:502});
  }
}
