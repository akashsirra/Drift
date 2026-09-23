"use client";

import {useEffect,useState} from "react";

export default function PwaRegister(){
  const [installEvent,setInstallEvent]=useState<any>(null);
  const [installed,setInstalled]=useState(false);

  useEffect(()=>{
    if(!("serviceWorker" in navigator))return;
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const onBeforeInstall=(event:any)=>{
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled=()=>{setInstalled(true);setInstallEvent(null)};
    window.addEventListener("beforeinstallprompt",onBeforeInstall);
    window.addEventListener("appinstalled",onInstalled);
    return()=>{
      window.removeEventListener("beforeinstallprompt",onBeforeInstall);
      window.removeEventListener("appinstalled",onInstalled);
    };
  },[]);

  if(installed||!installEvent)return null;
  return <button className="installApp" onClick={async()=>{
    const event=installEvent;
    if(!event)return;
    await event.prompt();
    setInstallEvent(null);
  }}>＋ Install Drift</button>;
}
