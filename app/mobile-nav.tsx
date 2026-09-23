"use client";

import {usePathname} from "next/navigation";

export default function MobileNav(){
  const path=usePathname();
  const items=[["/","⌂","Home"],["/library","▣","Library"],["/downloads","↓","Downloads"],["/addons","＋","Addons"]];
  return <nav className="mobileNav" aria-label="Primary navigation">{items.map(([href,icon,label])=><a key={href} className={path===href?"active":""} href={href}><span>{icon}</span><small>{label}</small></a>)}</nav>;
}
