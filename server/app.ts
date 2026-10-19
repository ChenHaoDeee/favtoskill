import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { createStore,type Store } from './store.js';
import { ServiceError } from './ai.js';
import { registerRoutes } from './routes.js';
export async function createApp(store:Store=createStore(),demoStore?:Store){
  const app=Fastify({logger:false,bodyLimit:1_000_000});
  await app.register(cors,{origin:(process.env.WEB_ORIGIN||'http://127.0.0.1:5173').split(',')});
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof ServiceError)return reply.code(error.status).send({error:{code:error.code,message:error.message,retryable:error.status>=500&&error.code!=='AI_NOT_CONFIGURED'}});
    if(error instanceof z.ZodError)return reply.code(400).send({error:{code:'INVALID_REQUEST',message:'请求格式或字段不正确，请检查输入。',retryable:false}});
    if(error instanceof Error&&/UNIQUE constraint/.test(error.message))return reply.code(409).send({error:{code:'NAME_CONFLICT',message:'名称已存在，请使用其他名称。',retryable:false}});
    return reply.code(500).send({error:{code:'INTERNAL_ERROR',message:'服务暂时不可用，请稍后重试。',retryable:true}});
  });
  await app.register(async scoped=>registerRoutes(scoped,store,'personal'),{prefix:'/api'});
  if(demoStore)await app.register(async scoped=>registerRoutes(scoped,demoStore,'demo'),{prefix:'/api/demo'});
  app.addHook('onClose',async()=>{store.db.close();demoStore?.db.close()});return app;
}
