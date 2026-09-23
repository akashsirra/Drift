import {NextRequest,NextResponse} from "next/server";

function isHttp(u:string){return u.startsWith("http://")||u.startsWith("https://")}
function absolute(raw:string,base:string){try{return new URL(raw,base).toString()}catch{return raw}}

function decodeHeaders(raw:string){
  if(!raw)return {} as Record<string,string>;
  try{
    const json=Buffer.from(raw,"base64url").toString("utf8");
    const parsed=JSON.parse(json);
    const src=parsed&&typeof parsed==="object"?parsed:{};
    const out:Record<string,string>={};
    for(const [k,v] of Object.entries(src)){
      if(typeof v!=="string")continue;
      const name=k.toLowerCase();
      if(["host","connection","content-length","transfer-encoding"].includes(name))continue;
      if(/^[a-z0-9-]+$/i.test(k))out[k]=v;
    }
    return out;
  }catch{return {} as Record<string,string>}
}

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get("url"),ph=req.nextUrl.searchParams.get("ph")||"";
  if(!raw||!isHttp(raw))return NextResponse.json({error:"Missing or invalid media URL"},{status:400});
  try{
    const target=new URL(raw);
    const headers=decodeHeaders(ph);
    const upstream=await fetch(target,{headers:{"user-agent":"Drift/0.1","accept":"*/*",...headers},cache:"no-store",redirect:"follow"});
    const ct=upstream.headers.get("content-type")||"application/octet-stream";
    if(!upstream.ok)return new NextResponse(await upstream.text(),{status:upstream.status,headers:{"content-type":ct}});
    if(ct.includes("mpegurl")||target.pathname.toLowerCase().endsWith(".m3u8")){
      const text=await upstream.text(),base=upstream.url||target.toString();
      const proxy=(u:string)=>"/api/media/proxy?url="+encodeURIComponent(u)+(ph?"&ph="+encodeURIComponent(ph):"");
      const rewritten=text.split("\n").map(line=>{
        const s=line.trim();if(!s)return line;
        if(s.startsWith("#"))return line.replace(/URI="([^"]+)"/g,(_,rawUri)=>{const u=absolute(rawUri,base);return isHttp(u) ? 'URI="'+proxy(u)+'"' : 'URI="'+rawUri+'"';});
        const u=absolute(s,base);return isHttp(u)?proxy(u):line;
      }).join("\n");
      return new NextResponse(rewritten,{headers:{"content-type":"application/vnd.apple.mpegurl","cache-control":"no-store","access-control-allow-origin":"*"}});
    }
    return new NextResponse(await upstream.arrayBuffer(),{headers:{"content-type":ct,"cache-control":"no-store","access-control-allow-origin":"*","content-length":upstream.headers.get("content-length")||""}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Media proxy failed"},{status:502})}
}