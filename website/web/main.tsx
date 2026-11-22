import React, { Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useAuthStore } from "../src/store/authStore";
import { authService } from "../src/services/authService";
import AppBackground from "../components/AppBackground";
import "leaflet/dist/leaflet.css";
import "./styles.css";

if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes('"shadow*" style props are deprecated') ||
      msg.includes('"textShadow*" style props are deprecated') ||
      msg.includes("props.pointerEvents is deprecated") ||
      msg.includes("useNativeDriver")
    ) {
      return;
    }
    originalWarn(...args);
  };
}
const modules = import.meta.glob<{default: React.ComponentType}>("../routes/**/*.tsx");
const pages = Object.entries(modules).filter(([file])=>!file.includes("_layout") && (!file.endsWith(".tsx") || file.endsWith(".web.tsx") || !modules[file.replace(/\.tsx$/, ".web.tsx")])).map(([file,load])=>({
 path: file.replace("../routes", "").replace(/\/\([^/]+\)/g, "").replace(/(?:\.web)?\.tsx$/, "").replace(/\[([^/]+)\]/g, ":$1").replace(/\/index$/, "") || "/",
 Component: lazy(load)
}));
function App() {
 useEffect(()=>{if(useAuthStore.getState().accessToken) void authService.getMe().catch(()=>{});},[]);
 return (
   <>
     <AppBackground />
     <Suspense fallback={<div className="page-status" role="status">Loading MalikSe…</div>}>
       <Routes>
         {pages.map(({path,Component})=><Route key={path} path={path} element={<Component/>}/>)}
         <Route path="*" element={<main className="page-status"><h1>Page not found</h1><Link to="/home">Browse properties</Link></main>}/>
       </Routes>
     </Suspense>
   </>
 );
}
createRoot(document.getElementById("root")!).render(<BrowserRouter><App/></BrowserRouter>);
