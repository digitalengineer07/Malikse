import { describe, expect, it } from "vitest";
import { routeUrl } from "./navigation";
describe("existing website URLs under React Router",()=>{
 it("preserves login return destinations",()=>{
  expect(routeUrl({pathname:"/(auth)/login",params:{returnTo:"/property/abc?from=search"}})).toBe("/login?returnTo=%2Fproperty%2Fabc%3Ffrom%3Dsearch");
 });
 it("resolves property IDs without leaking them into query parameters",()=>{
  expect(routeUrl({pathname:"/verification/[id]",params:{id:"abc/def",mode:"review"}})).toBe("/verification/abc%2Fdef?mode=review");
 });
 it("keeps existing search filters and excludes unset values",()=>{
  expect(routeUrl({pathname:"/(tabs)/search",params:{q:"Patna & Danapur",type:"land",max:undefined}})).toBe("/search?q=Patna+%26+Danapur&type=land");
 });
 it("preserves deep links and external links",()=>{
  expect(routeUrl("/deal/123")).toBe("/deal/123");
  expect(routeUrl("https://example.com/help")).toBe("https://example.com/help");
 });
});
