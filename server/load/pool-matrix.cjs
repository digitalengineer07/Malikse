const {spawn}=require('child_process');
const path=require('path');
async function main(){
  for(const size of [10,25,50,100]) {
    console.log('POOL EXPERIMENT',size);
    const code=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[path.join(__dirname,'profile-local.cjs')],{stdio:'inherit',env:{...process.env,PROFILE_POOL_TEST:'1',DURATION:'10s',PREALLOCATED_VUS:'80',MONGO_MAX_POOL_SIZE:String(size),MONGO_MIN_POOL_SIZE:'0'}});
      child.on('error',reject);child.on('exit',resolve);
    });
    if(code!==0) process.exitCode=1;
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
