import "./globals.css";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Drift — Your content. Your addons.",description:"An open, addon-powered media player compatible with Stremio addons.",themeColor:"#08090c"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
