import React, { useEffect, useMemo } from "react";
import { Link as BrowserLink, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
export type Href = string | { pathname: string; params?: Record<string, unknown> };
export function routeUrl(href: Href): string {
 let pathname = typeof href === "string" ? href : href.pathname;
 pathname = pathname.replace(/\/\([^/]+\)/g, "") || "/";
 if (typeof href === "string") return pathname;
 const query = new URLSearchParams();
 for (const [key,value] of Object.entries(href.params || {})) {
  if (value == null) continue;
  if (pathname.includes(`[${key}]`)) pathname = pathname.replace(`[${key}]`, encodeURIComponent(String(value)));
  else if (Array.isArray(value)) value.forEach(v=>query.append(key,String(v)));
  else query.set(key,String(value));
 }
 return pathname + (query.size ? (pathname.includes("?") ? "&" : "?") + query.toString() : "");
}
export function useRouter() {
 const navigate = useNavigate();
 return useMemo(()=>({ push: (href: Href)=>navigate(routeUrl(href)), navigate: (href: Href)=>navigate(routeUrl(href)), setParams: (params:Record<string,unknown>)=>{const url=new URL(window.location.href); for(const [key,value] of Object.entries(params)) {if(value == null) url.searchParams.delete(key); else url.searchParams.set(key,String(value));} navigate(url.pathname+url.search,{replace:true});}, replace: (href: Href)=>navigate(routeUrl(href),{replace:true}), back: ()=>navigate(-1), canGoBack: ()=>Number(window.history.state?.idx || 0)>0 }),[navigate]);
}
export function usePathname() { return useLocation().pathname; }
export function useLocalSearchParams<T extends Record<string, any> = Record<string, string>>() {
 const {search} = useLocation(); const params = useParams();
 return useMemo(()=>({...Object.fromEntries(new URLSearchParams(search)),...params}) as T,[search,params]);
}
export function useFocusEffect(effect: React.EffectCallback) {
 const {key} = useLocation();
 useEffect(effect,[effect,key]);
}
export function Redirect({href}: {href: Href}) { return <Navigate to={routeUrl(href)} replace />; }
export function Link({href, onPress, asChild, children, ...props}: any) {
 return <BrowserLink {...props} to={routeUrl(href)} onClick={onPress}>{children}</BrowserLink>;
}
