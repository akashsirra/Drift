import {NextRequest,NextResponse} from "next/server";

export async function GET(req:NextRequest){
  const imdb=req.nextUrl.searchParams.get("imdb")?.trim();
  if(!imdb)return NextResponse.json({error:"Missing imdb id"},{status:400});
  try{
    const lookup=await fetch("https://api.tvmaze.com/lookup/shows?imdb="+encodeURIComponent(imdb),{headers:{"user-agent":"Drift/0.1"}});
    if(!lookup.ok)return NextResponse.json({seasons:[]});
    const show=await lookup.json();
    if(!show?.id)return NextResponse.json({seasons:[]});
    const er=await fetch("https://api.tvmaze.com/shows/"+show.id+"/episodes?specials=0",{headers:{"user-agent":"Drift/0.1"}});
    if(!er.ok)return NextResponse.json({seasons:[]});
    const eps=await er.json();
    const seasons=new Map<number,any[]>();
    for(const e of eps){
      const season=Number(e?.season),number=Number(e?.number);
      if(!Number.isInteger(season)||season<1||!Number.isInteger(number)||number<1)continue;
      const list=seasons.get(season)||[];
      list.push({
        id:`${imdb}:${season}:${number}`,
        title:e.name||`Episode ${number}`,
        season,
        episode:number,
        released:e.airdate?e.airdate+"T00:00:00.000Z":undefined,
        thumbnail:e.image?.original||e.image?.medium
      });
      seasons.set(season,list);
    }
    return NextResponse.json({
      seasons:[...seasons.entries()]
        .sort((a,b)=>a[0]-b[0])
        .map(([season,episodes])=>({season,episodes:episodes.sort((a,b)=>a.episode-b.episode)}))
    },{headers:{"cache-control":"public, max-age=3600"}});
  }catch{
    return NextResponse.json({seasons:[]});
  }
}
