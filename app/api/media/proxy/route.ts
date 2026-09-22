import {NextRequest,NextResponse} from "next/server";

function isHttp(u:string){return u.startsWith("http://")||u.startsWith("https://")}
function absolute(raw:string,base:string){try{return new URL(raw,base).toString()}catch{return raw}}

export async function GET(req:NextRequest){
 const raw=req.nextUrl.searchParams.get("url");
 if(!raw||!isHttp(raw))return NextResponse.json({error:"Missing or invalid media URL"},{status:400});
 try{
  const target=new URL(raw);
  const upstream=await fetch(target,{headers:{"user-agent":"Drift/0.1","accept":"*/*"},cache:"no-store",redirect:"follow"});
  const ct=upstream.headers.get("content-type")||"application/octet-stream";
  if(!upstream.ok)return new NextResponse(await upstream.text(),{status:upstream.status,headers:{"content-type":ct}});
  if(ct.includes("mpegurl")||target.pathname.toLowerCase().endsWith(".m3u8")){
   const text=await upstream.text();
   const base=upstream.url||target.toString();
   const rewritten=text.split("\n").map(line=>{
    const s=line.trim();
    if(!s||s.startsWith("#"))return line;
    const u=absolute(s,base);
    return isHttp(u)?"/api/media/proxy?url="+encodeURIComponent(u):line;
   }).join("\n");
   return new NextResponse(rewritten,{headers:{"content-type":"application/vnd.apple.mpegurl","cache-control":"no-store","access-control-allow-origin":"*"}});
  }
  return new NextResponse(await upstream.arrayBuffer(),{headers:{"content-type":ct,"cache-control":"no-store","access-control-allow-origin":"*","content-length":upstream.headers.get("content-length")||""}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Media proxy failed"},{status:502})}
}