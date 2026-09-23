import {NextRequest,NextResponse} from "next/server";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

export const runtime="nodejs";
const execFileAsync=promisify(execFile);

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

async function curlText(url:string,headers:Record<string,string>){
  const args=["-L","--compressed","--silent","--show-error","--max-time","25"];
  for(const [k,v] of Object.entries(headers))args.push("-H",k+": "+v);
  args.push("-w","\n__DRIFT_STATUS__:%{http_code}",url);
  try{
    const r=await execFileAsync(process.env.DRIFT_CURL_PATH||"curl",args,{maxBuffer:8*1024*1024});
    const raw=String(r.stdout||"");
    const marker="\n__DRIFT_STATUS__:";
    const at=raw.lastIndexOf(marker);
    if(at<0)return null;
    return {status:Number(raw.slice(at+marker.length).trim())||0,body:raw.slice(0,at)};
  }catch(e){
    const r=e as any,raw=String(r.stdout||"");
    const marker="\n__DRIFT_STATUS__:";
    const at=raw.lastIndexOf(marker);
    if(at>=0)return {status:Number(raw.slice(at+marker.length).trim())||0,body:raw.slice(0,at)};
    return null;
  }
}

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get("url");
  const ph=req.nextUrl.searchParams.get("ph")||"";
  const mc=req.nextUrl.searchParams.get("mc")||"";
  if(!raw||!isHttp(raw))return NextResponse.json({error:"Missing or invalid media URL"},{status:400});

  try{
    const target=new URL(raw);
    const headers=decodeHeaders(ph);
    const requestHeaders:Record<string,string>={
      "user-agent":"Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "accept":"*/*",
      "accept-language":"en-US,en;q=0.9",
      ...headers
    };

    if(headers.Referer||headers.referer){
      const ref=headers.Referer||headers.referer;
      requestHeaders["Referer"]=ref;
      try{requestHeaders["Origin"]=new URL(ref).origin}catch{}
    }
    requestHeaders["sec-fetch-site"]="cross-site";
    requestHeaders["sec-fetch-mode"]="cors";
    requestHeaders["sec-fetch-dest"]="empty";

    if(mc){
      try{requestHeaders["cookie"]=Buffer.from(mc,"base64url").toString("utf8")}catch{}
    }

    let upstream=await fetch(target,{headers:requestHeaders,cache:"no-store",redirect:"follow"});
    let ct=upstream.headers.get("content-type")||"application/octet-stream";
    let playlistText:string|null=null;
    let playlistBase=upstream.url||target.toString();

    const looksLikePlaylist=target.pathname.toLowerCase().endsWith(".m3u8")||ct.includes("mpegurl");
    if(!upstream.ok && upstream.status===403 && looksLikePlaylist){
      const curl=await curlText(target.toString(),requestHeaders);
      if(curl?.status===200){
        playlistText=curl.body;
        ct="application/vnd.apple.mpegurl";
        playlistBase=target.toString();
      }
    }

    if(!upstream.ok && playlistText===null){
      return new NextResponse(await upstream.text(),{
        status:upstream.status,
        headers:{"content-type":ct}
      });
    }

    if(playlistText!==null || ct.includes("mpegurl") || target.pathname.toLowerCase().endsWith(".m3u8")){
      const text=playlistText!==null?playlistText:await upstream.text();
      const base=playlistBase;
      const upstreamCookies=typeof (upstream.headers as any).getSetCookie==="function"
        ?(upstream.headers as any).getSetCookie()
        :[];
      const cookieValue=upstreamCookies
        .map((x:string)=>x.split(";")[0])
        .filter(Boolean)
        .join("; ");
      const cookieToken=cookieValue
        ?Buffer.from(cookieValue,"utf8").toString("base64url")
        :mc;

      const proxy=(u:string)=>{
        let out="/api/media/proxy?url="+encodeURIComponent(u);
        if(ph)out+="&ph="+encodeURIComponent(ph);
        if(cookieToken)out+="&mc="+encodeURIComponent(cookieToken);
        return out;
      };

      const rewritten=text.split("\n").map(line=>{
        const s=line.trim();
        if(!s)return line;
        if(s.startsWith("#")){
          return line.replace(/URI="([^"]+)"/g,(_,rawUri)=>{
            const u=absolute(rawUri,base);
            return isHttp(u)?'URI="'+proxy(u)+'"':'URI="'+rawUri+'"';
          });
        }
        const u=absolute(s,base);
        return isHttp(u)?proxy(u):line;
      }).join("\n");

      return new NextResponse(rewritten,{
        headers:{
          "content-type":"application/vnd.apple.mpegurl",
          "cache-control":"no-store",
          "access-control-allow-origin":"*"
        }
      });
    }

    return new NextResponse(await upstream.arrayBuffer(),{
      headers:{
        "content-type":ct,
        "cache-control":"no-store",
        "access-control-allow-origin":"*",
        "content-length":upstream.headers.get("content-length")||""
      }
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Media proxy failed"},{status:502});
  }
}
