import "./globals.css";
import type {Metadata,Viewport} from "next";
import PwaRegister from "./pwa-register";

export const metadata:Metadata={
  title:"Drift — Your content. Your addons.",
  description:"An open, addon-powered media player compatible with Stremio addons.",
  applicationName:"Drift",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"Drift",statusBarStyle:"black-translucent"},
  icons:{icon:"/icon.svg",apple:"/icon.svg"}
};

export const viewport:Viewport={
  width:"device-width",
  initialScale:1,
  viewportFit:"cover",
  themeColor:"#08090c"
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}<PwaRegister/></body></html>;
}
