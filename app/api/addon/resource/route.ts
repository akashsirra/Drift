import {NextRequest,NextResponse} from "next/server";

function extractStreams(value:any):any[]{
  const out:any[]=[];
  const seen=new Set<any>();
  function walk(v:any,depth=0){
    if(v==null||depth>6||seen.has(v))return;
    if(typeof v==="object")seen.add(v);
    if(Array.isArray(v)){
      for(const item of v){
        if(item&&typeof item==="object"&&(
          typeof item.url==="string"||
          typeof item.externalUrl==="string"||
          typeof item.infoHash==="string"||
          typeof item.ytId==="string"
        ))out.push(item);
        else walk(item,depth+1);
      }
      return;
    }
    if(typeof v==="object"){
      if(typeof v.url==="string"||typeof v.externalUrl==="string"||typeof v.infoHash==="string"||typeof v.ytId==="string")out.push(v);
      for(const value of Object.values(v))walk(value,depth+1);
    }
  }
  walk(value);
  return out.filter((x,i,a)=>i===a.findIndex(y=>JSON.stringify(y)===JSON.stringify(x)));
}

export async function GET(req:NextRequest){
  const p=req.nextUrl.searchParams;
  const addon=p.get("addon"),resource=p.get("resource"),type=p.get("type"),id=p.get("id");
  if(!addon||!resource||!type||!id)return NextResponse.json({error:"Missing resource parameters"},{status:400});
  try{
    const manifestUrl=new URL(addon);
    if(!["http:","https:"].includes(manifestUrl.protocol))return NextResponse.json({error:"Addon URL must use HTTP(S)"},{status:400});
    const base=new URL(".",manifestUrl);
    const path=resource+"/"+encodeURIComponent(type)+"/"+encodeURIComponent(id)+".json";
    const u=new URL(path,base);
    for(const [k,v] of p.entries())if(!["addon","resource","type","id"].includes(k))u.searchParams.set(k,v);
    if(resource==="stream")u.searchParams.set("_drift",String(Date.now()));
    const r=await fetch(u,{headers:{"user-agent":"Drift/0.1","cache-control":"no-cache, no-store","pragma":"no-cache"},cache:"no-store",redirect:"follow"});
    const body=await r.text();
    if(!r.ok)return NextResponse.json({error:"Addon returned HTTP "+r.status,detail:body.slice(0,500)},{status:r.status});
    const ct=r.headers.get("content-type")||"application/json";
    if(ct.includes("text/html"))return NextResponse.json({error:"Addon returned HTML instead of JSON",detail:body.slice(0,500)},{status:502});
    if(resource==="stream"){
      try{
        const parsed=JSON.parse(body);
        const streams=extractStreams(parsed);
        return NextResponse.json({streams},{status:200,headers:{"Cache-Control":"no-store"}});
      }catch{
        return NextResponse.json({streams:[],error:"Addon returned invalid JSON"},{status:502});
      }
    }
    return new NextResponse(body,{status:200,headers:{"content-type":ct,"Cache-Control":"no-store"}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Addon request failed"},{status:502})}
}
