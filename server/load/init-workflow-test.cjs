const {MongoClient}=require('mongodb');
(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27028/?directConnection=true');try{await c.db('admin').command({replSetInitiate:{_id:'workflow-test',members:[{_id:0,host:'127.0.0.1:27028'}]}});}catch(e){if(e.codeName!=='AlreadyInitialized')throw e;}await c.close();})().catch(e=>{console.error(e.message);process.exitCode=1});
