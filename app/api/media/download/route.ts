import {NextRequest,NextResponse} from "next/server";

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

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get("url"),ph=req.nextUrl.searchParams.get("ph")||"",name=req.nextUrl.searchParams.get("name")||"Drift";
  if(!raw||!/^https?:\/\//i.test(raw))return NextResponse.json({error:"Missing or invalid media URL"},{status:400});
  try{
    const target=new URL(raw);
    const upstream=await fetch(target,{headers:{"user-agent":"Drift/0.1","accept":"*/*",...decodeHeaders(ph)},cache:"no-store",redirect:"follow"});
    if(!upstream.ok)return new NextResponse(await upstream.text(),{status:upstream.status});
    const ct=upstream.headers.get("content-type")||"application/octet-stream";
    if(!/^(video\/(mp4|webm|ogg)|application\/octet-stream)$/i.test(ct))return NextResponse.json({error:"Downloads are currently available for direct video files only."},{status:415});
    const ext=ct.includes("webm")?"webm":ct.includes("ogg")?"ogv":"mp4";
    const safe=name.replace(/[^a-z0-9._-]+/gi,"_").slice(0,100)||"Drift";
    return new NextResponse(await upstream.arrayBuffer(),{headers:{
      "content-type":ct,
      "content-disposition":"attachment; filename=\""+safe+"."+ext+"\"",
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Download failed"},{status:502})}
}
