export type DocumentPickerAsset = {name:string; uri:string; mimeType?:string; size?:number; file?:File; lastModified?:number};
export function getDocumentAsync(options: {type?:string|string[]; multiple?:boolean; copyToCacheDirectory?:boolean} = {}): Promise<{canceled:true;assets:null}|{canceled:false;assets:DocumentPickerAsset[]}> {
 return new Promise(resolve=>{
  const input=document.createElement("input"); input.type="file"; input.accept=Array.isArray(options.type)?options.type.join(","):options.type || "*/*"; input.multiple=!!options.multiple;
  input.style.display="none"; document.body.append(input);
  const done=async(files:File[])=>{input.remove();
    const assets = await Promise.all(files.map(async file=>({name:file.name,uri:await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>resolve("");reader.readAsDataURL(file);}),mimeType:file.type,size:file.size,file,lastModified:file.lastModified})));
    resolve(assets.length?{canceled:false,assets}:{canceled:true,assets:null});};
  input.addEventListener("change",()=>done(Array.from(input.files || [])),{once:true});
  input.addEventListener("cancel",()=>done([]),{once:true}); input.click();
 });
}
