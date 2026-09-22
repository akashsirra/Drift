import {NextRequest,NextResponse} from "next/server";

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
    const r=await fetch(u,{headers:{"user-agent":"Drift/0.1"},cache:"no-store",redirect:"follow"});
    const body=await r.text();
    if(!r.ok)return NextResponse.json({error:"Addon returned HTTP "+r.status,detail:body.slice(0,500)},{status:r.status});
    const ct=r.headers.get("content-type")||"application/json";
    if(ct.includes("text/html"))return NextResponse.json({error:"Addon returned HTML instead of JSON",detail:body.slice(0,500)},{status:502});
    return new NextResponse(body,{status:200,headers:{"content-type":ct,"Cache-Control":"no-store"}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Addon request failed"},{status:502})}
}