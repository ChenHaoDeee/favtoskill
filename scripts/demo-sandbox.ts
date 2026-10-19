// Disposable browser QA: no user databases and no provider requests.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedDemo } from '../server/seed.js';
delete process.env.AI_API_KEY;delete process.env.AI_EMBEDDING_MODEL;delete process.env.TIKHUB_API_KEY;
process.env.WEB_ORIGIN='http://127.0.0.1:5174';
process.env.VITE_API_BASE_URL='http://127.0.0.1:3002';
const demo=createStore(':memory:');seedDemo(demo);
const api=await createApp(createStore(':memory:'),demo);
await api.listen({host:'127.0.0.1',port:3002});
const web=await createServer({configFile:false,plugins:[react()],cacheDir:'node_modules/.vite-demo-sandbox',server:{host:'127.0.0.1',port:5174,strictPort:true}});
await web.listen();console.log('Disposable demo: http://127.0.0.1:5174/?workspace=demo#knowledge');
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void web.close().then(()=>api.close()).then(()=>process.exit(0))});
