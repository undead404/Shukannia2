import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { DuckDBInstance } from '@duckdb/node-api';
import { sql } from 'kysely';
import { CatalogInfo, ImdbId, Pointer, Title, Watchlist } from '../../domain/src/index.js';
import { catalogInfo, computeDiagnostics, connect, dataDir, generate, insertTitles, migrateCatalog } from '../../db/src/index.js';

const nullableInt=z.preprocess(v=>v==='\\N'?null:v,z.union([z.null(),z.string().regex(/^\d+$/).transform(Number)]));
const Basics=z.object({tconst:ImdbId,titleType:z.string().min(1),primaryTitle:z.string().min(1),startYear:nullableInt.pipe(z.number().int().min(1800).max(2200).nullable()),genres:z.string().min(1)});
const Rating=z.object({tconst:ImdbId,averageRating:z.string().regex(/^\d+(\.\d+)?$/).transform(Number).pipe(z.number().min(0).max(10)),numVotes:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative().safe())});
const Episode=z.object({tconst:ImdbId,parentTconst:ImdbId,seasonNumber:nullableInt,episodeNumber:nullableInt});
const Source=CatalogInfo.shape.sources.element;
type Source=z.infer<typeof Source>;
export async function* lines(path:string):AsyncGenerator<string>{
  const source=createReadStream(path);const input=path.endsWith('.gz')?source.pipe(createGunzip()):source;
  // Forward source failures; readline alone does not propagate a piped source error.
  source.on('error',e=>input.destroy(e));
  const reader=createInterface({input,crlfDelay:Infinity});
  try{for await(const line of reader)yield line;}finally{reader.close();input.destroy();source.destroy();}
}
export async function validateTsv(path:string,output:string,kind:'basics'|'ratings'|'episode'):Promise<void>{
  const out=await open(output,'wx');let headers:string[]|null=null;let count=0;let malformed=0;const samples:string[]=[];
  const schema=kind==='basics'?Basics:kind==='ratings'?Rating:Episode;
  try{
    for await(const line of lines(path)){
      if(!headers){headers=line.split('\t');const required=Object.keys(schema.shape);if(required.some(h=>!headers?.includes(h)))throw new Error(`${kind}: missing required header columns`);continue;}
      count++;const values=line.split('\t');const raw=Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
      const parsed=schema.safeParse(raw);
      if(!parsed.success||values.length!==headers.length){malformed++;if(samples.length<5)samples.push(`row ${count+1}: ${parsed.error?.issues[0]?.message??'column count mismatch'}`);continue;}
      await out.write(`${JSON.stringify(parsed.data)}\n`);
    }
  }finally{await out.close();}
  console.log(`${kind}: ${count.toLocaleString()} rows, ${malformed} malformed`,samples);
  if(!count||malformed)throw new Error(`${kind}: rejected snapshot (${malformed} malformed rows; ${count} total). ${samples.join('; ')}`);
}
export async function hashFile(path:string):Promise<string>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function withUpdateLock<T>(dir:string,task:()=>Promise<T>):Promise<T>{
  await mkdir(dir,{recursive:true});const path=join(dir,'update.lock');
  let lock;try{lock=await open(path,'wx');}catch(e){if(e instanceof Error&&'code'in e&&e.code==='EEXIST')throw new Error('Another update is running, or an interrupted update left update.lock. Verify no importer is running before removing this lock.');throw e;}
  try{await lock.writeFile(JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}));return await task();}finally{await lock.close();await rm(path,{force:true});}
}
export async function activate(dir:string,version:string):Promise<void>{
  let previous:string|null=null;
  try{previous=Pointer.parse(JSON.parse(await readFile(join(dir,'catalog.json'),'utf8'))).active;}catch(e){if(!(e instanceof Error&&'code'in e&&e.code==='ENOENT'))throw e;}
  const pointer=Pointer.parse({active:version,previous});const tmp=join(dir,`pointer-${randomUUID()}.tmp`);
  const f=await open(tmp,'wx');try{await f.writeFile(JSON.stringify(pointer));await f.sync();}finally{await f.close();}
  await rename(tmp,join(dir,'catalog.json'));
}
export async function finishCatalog(path:string,info:Omit<CatalogInfo,'diagnostics'>,dir:string):Promise<CatalogInfo>{
  const db=connect(path);
  let metadata:CatalogInfo;
  try{
    const diagnostics=await computeDiagnostics(db);
    if(!diagnostics.count)throw new Error('Empty normalized catalog; activation refused');
    metadata=CatalogInfo.parse({...info,diagnostics});
    await db.insertInto('metadata').values({key:'info',value:JSON.stringify(metadata)}).execute();
    const check=await sql`PRAGMA integrity_check`.execute(db);if(JSON.stringify(check.rows)!=='[{"integrity_check":"ok"}]')throw new Error('SQLite integrity check failed');
    const fk=await sql`PRAGMA foreign_key_check`.execute(db);if(fk.rows.length)throw new Error('SQLite foreign key check failed');
    const tag=await db.selectFrom('title_tag').select('name').executeTakeFirst();
    if(tag)await generate(db,Watchlist.parse({id:randomUUID(),name:'Validation',baseline:6.6,top_n:10,tags:[{name:tag.name,weight:1}]}),[]);
    // Large drops require an explicit operator override; normal growth remains allowed.
    try{
      const pointer=Pointer.parse(JSON.parse(await readFile(join(dir,'catalog.json'),'utf8')));const old=connect(join(dir,`catalog-${pointer.active}.sqlite`),true);
      let prior;try{prior=await catalogInfo(old);}finally{await old.destroy();}
      if(!prior.demo&&!info.demo&&diagnostics.count<prior.diagnostics.count*0.8&&process.env['SHUKANNIA_ALLOW_LARGE_DROP']!=='1')throw new Error('Catalog shrank more than 20%; review snapshots, then explicitly set SHUKANNIA_ALLOW_LARGE_DROP=1 if intended');
    }catch(e){if(!(e instanceof Error&&'code'in e&&e.code==='ENOENT'))throw e;}
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(db);
  }finally{await db.destroy();}
  await activate(dir,info.version);return metadata;
}
export async function importSnapshots(sourceDir:string,dir=dataDir(),downloadSources?:Source[]):Promise<CatalogInfo>{
  return withUpdateLock(dir,()=>stageSnapshots(sourceDir,dir,downloadSources));
}
async function stageSnapshots(sourceDir:string,dir:string,downloadSources?:Source[]):Promise<CatalogInfo>{
  const temp=await mkdtemp(join(dir,'staging-'));const version=`${Date.now()}-${randomUUID().slice(0,8)}`;const catalogPath=join(dir,`catalog-${version}.sqlite`);let success=false;
  const sources:Source[]=[];
  try{
    for(const kind of ['basics','ratings','episode'] as const){
      const name=`title.${kind}.tsv.gz`;let path=join(sourceDir,name);
      try{await stat(path);}catch{path=join(sourceDir,`title.${kind}.tsv`);await stat(path);}
      sources.push(downloadSources?.find(s=>s.name===name)??Source.parse({name:basename(path),sha256:await hashFile(path),size:(await stat(path)).size,downloaded_at:new Date().toISOString(),etag:null,last_modified:null}));
      await validateTsv(path,join(temp,`${kind}.jsonl`),kind);
    }
    console.log('Staging normalized catalog with DuckDB');
    const instance=await DuckDBInstance.create(join(temp,'stage.duckdb'),{memory_limit:'1GB'});const connection=await instance.connect();
    const output=join(temp,'normalized.jsonl');
    try{
      for(const kind of ['basics','ratings','episode'] as const){
        // Table identifiers are a closed internal enum. File paths are bound values.
        await connection.run(`CREATE TABLE ${kind} AS SELECT * FROM read_json_auto($path, format='newline_delimited')`,{path:join(temp,`${kind}.jsonl`)});
        const dup=await connection.runAndReadAll(`SELECT count(*)::INTEGER AS n FROM (SELECT tconst FROM ${kind} GROUP BY tconst HAVING count(*)>1)`);
        if(z.object({n:z.number()}).parse(dup.getRowObjects()[0]).n)throw new Error(`${kind}: duplicate IMDb IDs`);
      }
      // COPY filenames cannot be prepared in DuckDB. Escape the internally generated local path.
      const destination=output.replaceAll("'","''");
      await connection.run(`COPY (
        SELECT b.tconst AS imdb_id,b.titleType AS title_type,b.primaryTitle AS name,CAST(b.startYear AS INTEGER) AS original_year,
        e.parentTconst AS parent_series_imdb_id,p.primaryTitle AS series_name,
        CAST(e.seasonNumber AS INTEGER) AS season,CAST(e.episodeNumber AS INTEGER) AS episode_number,
        CAST(r.averageRating AS DOUBLE) AS average_rating,CAST(r.numVotes AS DOUBLE) AS num_votes,
        CASE WHEN b.genres='\\N' AND p.genres IS NOT NULL AND p.genres!='\\N' THEN string_split(p.genres,',') WHEN b.genres='\\N' THEN [] ELSE string_split(b.genres,',') END AS genres,
        CASE WHEN b.genres='\\N' AND p.genres IS NOT NULL AND p.genres!='\\N' THEN 'inherited' ELSE 'imdb' END AS provenance
        FROM basics b JOIN ratings r ON b.tconst=r.tconst LEFT JOIN episode e ON b.tconst=e.tconst LEFT JOIN basics p ON e.parentTconst=p.tconst
        WHERE b.titleType IN ('movie','tvMovie','tvEpisode')
      ) TO '${destination}' (FORMAT JSON, ARRAY false)`);
    }finally{connection.closeSync();instance.closeSync();}
    const db=connect(catalogPath);
    try{
      await migrateCatalog(db);let batch:Title[]=[];
      for await(const line of lines(output)){batch.push(Title.parse(JSON.parse(line)));if(batch.length===1000){await insertTitles(db,batch);batch=[];}}
      if(batch.length)await insertTitles(db,batch);
    }finally{await db.destroy();}
    const metadata=await finishCatalog(catalogPath,{version,created_at:new Date().toISOString(),demo:false,sources},dir);success=true;return metadata;
  }finally{
    await rm(temp,{recursive:true,force:true});
    if(!success)for(const suffix of ['','-wal','-shm'])await rm(`${catalogPath}${suffix}`,{force:true});
  }
}
export async function updateCatalog(dir=dataDir()):Promise<CatalogInfo>{
  return withUpdateLock(dir,async()=>{
    const temp=await mkdtemp(join(dir,'downloads-'));const sources:Source[]=[];
    try{
      for(const kind of ['basics','ratings','episode']){
        const name=`title.${kind}.tsv.gz`;const url=`https://datasets.imdbws.com/${name}`;console.log(`Downloading ${url}`);
        const response=await fetch(url,{signal:AbortSignal.timeout(30*60*1000)});if(!response.ok||!response.body)throw new Error(`Download failed: ${response.status} ${name}`);
        const file=await open(join(temp,name),'wx');
        try{const reader=response.body.getReader();try{for(;;){const chunk=await reader.read();if(chunk.done)break;await file.write(chunk.value);}}finally{reader.releaseLock();}}finally{await file.close();}
        sources.push(Source.parse({name,sha256:await hashFile(join(temp,name)),size:(await stat(join(temp,name))).size,downloaded_at:new Date().toISOString(),etag:response.headers.get('etag'),last_modified:response.headers.get('last-modified')}));
      }
      let oldSources:Source[]=[];try{const p=Pointer.parse(JSON.parse(await readFile(join(dir,'catalog.json'),'utf8')));const old=connect(join(dir,`catalog-${p.active}.sqlite`),true);try{oldSources=(await catalogInfo(old)).sources;}finally{await old.destroy();}}catch(e){if(!(e instanceof Error&&'code'in e&&e.code==='ENOENT'))throw e;}
      if(sources.every(s=>oldSources.some(o=>o.name===s.name&&o.sha256===s.sha256))){console.log('All snapshot hashes unchanged; active catalog retained.');const p=Pointer.parse(JSON.parse(await readFile(join(dir,'catalog.json'),'utf8')));const db=connect(join(dir,`catalog-${p.active}.sqlite`),true);try{return await catalogInfo(db);}finally{await db.destroy();}}
      return await stageSnapshots(temp,dir,sources);
    }finally{await rm(temp,{recursive:true,force:true});}
  });
}
export async function rollback(dir=dataDir()):Promise<void>{await withUpdateLock(dir,async()=>{const pointer=Pointer.parse(JSON.parse(await readFile(join(dir,'catalog.json'),'utf8')));if(!pointer.previous)throw new Error('No previous catalog exists');const db=connect(join(dir,`catalog-${pointer.previous}.sqlite`),true);try{await catalogInfo(db);}finally{await db.destroy();}await activate(dir,pointer.previous);});}
