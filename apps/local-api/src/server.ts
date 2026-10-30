import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Backup, Bootstrap, GenerateResponse, ScorePreview, Watchlist, WatchState } from '../../../packages/domain/src/index.js';
import { activeCatalog, backup, catalogInfo, generate, lists, putList, putState, restore, states, userDb } from '../../../packages/db/src/index.js';
import { createDemo } from '../../../packages/ingest/src/demo.js';

export async function createApp(){
  const app=Fastify({logger:true,bodyLimit:32*1024*1024});const user=await userDb();
  app.addHook('onClose',async()=>{await user.destroy();});
  // Loopback binding plus Host/Origin checks prevent DNS rebinding and cross-site local writes.
  app.addHook('onRequest',async(request,reply)=>{
    const host=request.headers.host??'';
    if(!/^127\.0\.0\.1:\d+$/.test(host))return reply.code(403).send({error:'Only loopback requests are accepted'});
    const origin=request.headers.origin;
    if(origin&&!/^http:\/\/127\.0\.0\.1:(4317|5173)$/.test(origin))return reply.code(403).send({error:'Origin rejected'});
  });
  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof z.ZodError)return reply.code(400).send({error:'Invalid input',details:error.issues});
    app.log.error(error);return reply.code(500).send({error:error instanceof Error?error.message:'Unexpected local error'});
  });
  app.get('/api/bootstrap',async()=>{
    const catalog=await activeCatalog();
    try{return Bootstrap.parse({catalog:catalog?await catalogInfo(catalog):null,tags:catalog?(await catalog.selectFrom('title_tag').select('name').distinct().orderBy('name').execute()).map(t=>t.name):[],watchlists:await lists(user),states:await states(user)});}finally{await catalog?.destroy();}
  });
  app.post('/api/generate',async(request,reply)=>{
    const config=Watchlist.parse(request.body);const catalog=await activeCatalog();
    if(!catalog)return reply.code(409).send({error:'Import a catalog or load the demo first'});
    try{
      const result=GenerateResponse.parse(await generate(catalog,config,await states(user)));
      await user.insertInto('snapshot').values({id:randomUUID(),created_at:result.generated_at,data:JSON.stringify(result)}).execute();
      // Keep recent reproductions bounded without affecting user-owned history or watchlists.
      const keep=await user.selectFrom('snapshot').select('id').orderBy('created_at','desc').limit(20).execute();
      if(keep.length)await user.deleteFrom('snapshot').where('id','not in',keep.map(r=>r.id)).execute();
      return result;
    }finally{await catalog.destroy();}
  });
  app.put('/api/watchlist',async r=>putList(user,Watchlist.parse(r.body)));
  app.post('/api/preview',async(request,reply)=>{
    const config=Watchlist.parse(request.body);const catalog=await activeCatalog();if(!catalog)return reply.code(409).send({error:'Import a catalog first'});
    try{const currentStates=await states(user);return ScorePreview.parse({highest:await generate(catalog,{...config,top_n:3,mode:'best'},currentStates),lowest:await generate(catalog,{...config,top_n:3,mode:'worst'},currentStates)});}finally{await catalog.destroy();}
  });
  app.put('/api/state',async r=>putState(user,WatchState.parse(r.body)));
  app.get('/api/backup',async()=>Backup.parse(await backup(user)));
  app.post('/api/restore',async r=>{await restore(user,Backup.parse(r.body));return {ok:true};});
  app.post('/api/demo',async r=>{z.object({confirm:z.literal(true)}).parse(r.body);const active=await activeCatalog();if(active){await active.destroy();throw new Error('A catalog already exists. Use the CLI to explicitly replace it.');}await createDemo();return {ok:true};});
  app.get('/api/snapshots',async()=>z.array(z.object({id:z.string(),created_at:z.string()})).parse(await user.selectFrom('snapshot').select(['id','created_at']).orderBy('created_at','desc').execute()));
  app.get('/api/snapshots/:id',async r=>{const {id}=z.object({id:z.string().uuid()}).parse(r.params);const row=await user.selectFrom('snapshot').select('data').where('id','=',id).executeTakeFirstOrThrow();return GenerateResponse.parse(JSON.parse(row.data));});
  const dist=fileURLToPath(new URL('../../web/dist/',import.meta.url));
  if(existsSync(dist)){
    await app.register(staticPlugin,{root:dist});
    app.setNotFoundHandler((r,reply)=>r.url.startsWith('/api/')?reply.code(404).send({error:'Unknown API route'}):reply.sendFile('index.html'));
  }
  return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const app=await createApp();await app.listen({host:'127.0.0.1',port:4317});
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close();});
}
