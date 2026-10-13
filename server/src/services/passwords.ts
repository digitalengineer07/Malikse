import { Worker } from "worker_threads";

type Job = { operation: "hash" | "compare"; value: string; argument: string | number; resolve: (value: any) => void; reject: (error: Error) => void };
type Slot = { worker: Worker; job?: Job; timer?: NodeJS.Timeout };
const slots: Slot[] = [];
const queue: Job[] = [];
export class PasswordBusyError extends Error { status = 503; constructor() { super("Authentication is busy. Please try again shortly."); } }
function dispatch() {
  while (queue.length) {
    let slot = slots.find(s => !s.job);
    if (!slot && slots.length < 2) {
      const worker = new Worker(`const {parentPort,workerData}=require('worker_threads'); const bcrypt=require(workerData); parentPort.on('message',m=>{try{parentPort.postMessage({value:m.operation==='hash'?bcrypt.hashSync(m.value,m.argument):bcrypt.compareSync(m.value,m.argument)})}catch{parentPort.postMessage({error:true})}});`, { eval: true, workerData: require.resolve("bcryptjs") });
      slot = { worker }; slots.push(slot);
      const current = slot;
      const fail = () => {
        const index = slots.indexOf(current); if (index < 0) return;
        slots.splice(index, 1); clearTimeout(current.timer); current.job?.reject(new PasswordBusyError());
        void worker.terminate(); dispatch();
      };
      worker.on("error", fail); worker.on("exit", fail);
      worker.on("message", message => {
        const job = current.job; clearTimeout(current.timer); current.job = undefined; worker.unref();
        if (message.error) job?.reject(new PasswordBusyError()); else job?.resolve(message.value);
        dispatch();
      });
    }
    if (!slot) return;
    slot.job = queue.shift()!; slot.worker.ref();
    const current = slot;
    slot.timer = setTimeout(() => { void current.worker.terminate(); }, 15000);
    slot.worker.postMessage({ operation: slot.job.operation, value: slot.job.value, argument: slot.job.argument });
  }
}
function run(operation: Job["operation"], value: string, argument: string | number): Promise<any> {
  if (queue.length >= 32) return Promise.reject(new PasswordBusyError());
  return new Promise((resolve, reject) => { queue.push({ operation, value, argument, resolve, reject }); dispatch(); });
}
export default { hash: (value: string, cost: number): Promise<string> => run("hash", value, cost), compare: (value: string, hash: string): Promise<boolean> => run("compare", value, hash) };
