const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
async function main() {
  for (const client of ['app','website']) {
    let active = 0, peak = 0, coverDone = false, failures = 0;
    const calls = [], completed = [], progress = [];
    const send = async (id,file,name,options) => {
      calls.push({name,id:options.uploadId});
      if(name !== 'cover.jpg') assert.ok(coverDone);
      active++; peak = Math.max(peak,active);
      await new Promise(r=>setTimeout(r,5)); active--;
      if(name === 'retry.jpg' && failures++ === 0) throw {response:{status:503}};
      if(name === 'cover.jpg') coverDone = true;
      options.onProgress(100);
      return {url:name};
    };
    const out = {exports:{}};
    const source = fs.readFileSync(`../${client}/src/services/uploadQueue.ts`,'utf8');
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {
      exports:out.exports, setTimeout:(fn)=>setTimeout(fn,0),
      require:name=>({
        'expo-crypto':require('node:crypto'),
        './prepareUpload':{prepareUpload:async asset=>({file:asset,name:asset.name})},
        './propertyService':{propertyService:{uploadPhoto:send}},
        './documentService':{documentService:{uploadDocument:(id,type,...args)=>send(id,...args)}},
      }[name]),
    });
    await out.exports.uploadListingFiles('property',[{name:'cover.jpg'},{name:'retry.jpg'},{name:'other.jpg'}],[{asset:{name:'doc.pdf'},type:'Registry'}],{
      progress:value=>progress.push(value),photo:(asset)=>completed.push(asset.name),document:doc=>completed.push(doc.asset.name),
    });
    assert.equal(peak,2); assert.equal(completed.length,4);
    const retry=calls.filter(c=>c.name==='retry.jpg');assert.equal(retry.length,2);assert.equal(retry[0].id,retry[1].id);
    assert.ok(progress.some(p=>p.includes('Retrying')));
    let finished = false, startedThird = false;
    await assert.rejects(out.exports.runUploadTasks([
      async()=>{throw Error('failed');},
      async()=>{await new Promise(r=>setTimeout(r,15));finished=true;},
      async()=>{startedThird=true;},
    ]));
    assert.ok(finished);assert.equal(startedThird,false);
  }
  console.log('PASS: both client queues preserve cover, cap concurrency, reuse retry IDs, report progress and settle in-flight work before failure');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
