import type {MetadataRoute} from "next";

export default function manifest():MetadataRoute.Manifest{
  return {
    name:"Drift",
    short_name:"Drift",
    description:"Your content. Your addons.",
    start_url:"/",
    scope:"/",
    display:"standalone",
    orientation:"portrait-primary",
    background_color:"#08090c",
    theme_color:"#08090c",
    icons:[
      {src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any maskable"},
      {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any maskable"}
    ]
  };
}
