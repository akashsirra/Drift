"use client";
import {useEffect} from "react";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error(error)},[error]);return <main className="pageState"><div className="stateIcon">!</div><h1>Something went wrong</h1><p>Drift hit an unexpected error. Your addons and local library are still stored in this browser.</p><div className="stateActions"><button onClick={()=>reset()}>Try again</button><a href="/">Go home</a></div></main>}
