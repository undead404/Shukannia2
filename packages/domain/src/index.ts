import { z } from 'zod';

export const ImdbId = z.string().regex(/^tt\d{7,10}$/);
export const Genre = z.string().trim().min(1).max(80);
export const Title = z.object({
  imdb_id: ImdbId, title_type: z.enum(['movie', 'tvMovie', 'tvEpisode']), name: z.string().min(1),
  original_year: z.number().int().min(1800).max(2200).nullable(),
  parent_series_imdb_id: ImdbId.nullable(), series_name: z.string().nullable(),
  season: z.number().int().nonnegative().nullable(), episode_number: z.number().int().nonnegative().nullable(),
  average_rating: z.number().min(0).max(10), num_votes: z.number().int().nonnegative(),
  genres: z.array(Genre), provenance: z.enum(['imdb', 'inherited', 'demo']),
});
export type Title = z.infer<typeof Title>;
export const Watchlist = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(100),
  baseline_strategy: z.enum(['manual', 'titleMean', 'voteMean']).default('manual'),
  baseline: z.number().min(0).max(10), top_n: z.number().int().min(1).max(100000),
  tags: z.array(z.object({ name: Genre, weight: z.number().min(0).max(10).default(1) })).min(1).max(30),
  excluded_tags: z.array(Genre).max(100).default([]), excluded_ids: z.array(ImdbId).max(100000).default([]),
  min_votes: z.number().int().nonnegative().default(0), include_tv_movies: z.boolean().default(false),
  mode: z.enum(['best', 'worst']).default('best'),
  worst_relevance: z.enum(['multiply', 'filterOnly']).default('multiply'),
  watched_policy: z.enum(['include', 'hideAfter', 'unwatchedFirst']).default('include'),
});
export type Watchlist = z.infer<typeof Watchlist>;
export const WatchState = z.object({
  imdb_id: ImdbId, watched_at: z.iso.datetime().nullable(), hidden: z.boolean(),
  personal_rating: z.number().min(0).max(10).nullable(), notes: z.string().max(10000),
});
export type WatchState = z.infer<typeof WatchState>;
export const RankedTitle = Title.extend({score: z.number(), relevance: z.number(), matched_tags: z.array(Genre), rank: z.number().int(), watched_at: z.string().nullable(), hidden: z.boolean()});
export type RankedTitle = z.infer<typeof RankedTitle>;
export const Diagnostics = z.object({count:z.number(), titleMean:z.number(), voteMean:z.number(), unknownYears:z.number(), episodes:z.number(), missingEpisodeMetadata:z.number()});
export type Diagnostics = z.infer<typeof Diagnostics>;
export const CatalogInfo = z.object({version:z.string(), created_at:z.string(), demo:z.boolean(), diagnostics:Diagnostics, sources:z.array(z.object({name:z.string(),sha256:z.string(),size:z.number(),downloaded_at:z.string(),etag:z.string().nullable(),last_modified:z.string().nullable()}))});
export type CatalogInfo = z.infer<typeof CatalogInfo>;
export const Pointer = z.object({active:z.string().regex(/^[\w-]+$/),previous:z.string().regex(/^[\w-]+$/).nullable()});
export const GenerateResponse = z.object({items:z.array(RankedTitle), selected:z.number(), visible:z.number(), baseline:z.number(), version:z.string(), generated_at:z.string(), config:Watchlist});
export type GenerateResponse = z.infer<typeof GenerateResponse>;
export const ScorePreview=z.object({highest:GenerateResponse,lowest:GenerateResponse});
export const Bootstrap = z.object({catalog:CatalogInfo.nullable(),tags:z.array(Genre),watchlists:z.array(Watchlist),states:z.array(WatchState)});
export const Backup = z.object({format:z.literal('shukannia-v1'),watchlists:z.array(Watchlist).max(1000),states:z.array(WatchState).max(1000000)});
export const score = (votes:number, rating:number, baseline:number, weight=1):number => votes * (rating-baseline) * weight;
export function diagnostics(titles:Title[]):Diagnostics {
  // Baseline universe is rated movies and episodes, independently of TV-movie policy.
  titles=titles.filter(t=>t.title_type!=='tvMovie');
  const votes=titles.reduce((s,t)=>s+t.num_votes,0);
  return {count:titles.length,titleMean:titles.length?titles.reduce((s,t)=>s+t.average_rating,0)/titles.length:0,voteMean:votes?titles.reduce((s,t)=>s+t.average_rating*t.num_votes,0)/votes:0,unknownYears:titles.filter(t=>t.original_year===null).length,episodes:titles.filter(t=>t.title_type==='tvEpisode').length,missingEpisodeMetadata:titles.filter(t=>t.title_type==='tvEpisode'&&(!t.series_name||t.season===null||t.episode_number===null)).length};
}
export function rank(titles:Title[],config:Watchlist,states:WatchState[]=[],stats=diagnostics(titles)): {items:RankedTitle[];selected:number;baseline:number} {
  const baseline=config.baseline_strategy==='titleMean'?stats.titleMean:config.baseline_strategy==='voteMean'?stats.voteMean:config.baseline;
  const stateMap=new Map(states.map(s=>[s.imdb_id,s]));
  const excludedIds=new Set(config.excluded_ids);
  const weights=new Map(config.tags.map(t=>[t.name,t.weight]));
  const candidates:RankedTitle[]=[];
  for(const t of titles){
    const state=stateMap.get(t.imdb_id);
    if(state?.hidden||excludedIds.has(t.imdb_id)||t.num_votes<config.min_votes||(!config.include_tv_movies&&t.title_type==='tvMovie')||t.genres.some(g=>config.excluded_tags.includes(g))||(config.watched_policy==='unwatchedFirst'&&state?.watched_at))continue;
    const matching=t.genres.filter(g=>weights.has(g));
    if(!matching.length)continue;
    const relevance=Math.max(...matching.map(g=>weights.get(g)??1));
    // A zero relevance is an explicit exclusion; it must not outrank negative records.
    if(relevance===0)continue;
    candidates.push({...t,score:score(t.num_votes,t.average_rating,baseline,config.mode==='worst'&&config.worst_relevance==='filterOnly'?1:relevance),relevance,matched_tags:matching,rank:0,watched_at:state?.watched_at??null,hidden:false});
  }
  candidates.sort((a,b)=>(config.mode==='worst'?a.score-b.score:b.score-a.score)||a.imdb_id.localeCompare(b.imdb_id));
  const chosen=candidates.slice(0,config.top_n).map((t,i)=>({...t,rank:i+1}));
  const items=chosen.filter(t=>config.watched_policy!=='hideAfter'||!t.watched_at);
  items.sort((a,b)=>(a.original_year??Infinity)-(b.original_year??Infinity)||a.imdb_id.localeCompare(b.imdb_id));
  return {items,selected:chosen.length,baseline};
}
