import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Title } from '../../domain/src/index.js';
import { connect, dataDir, insertTitles, migrateCatalog } from '../../db/src/index.js';
import { finishCatalog, withUpdateLock } from './importer.js';

// Fictional records with illustrative ratings: never presented as an IMDb snapshot.
export const demoTitles:Title[] = [
  ['The Last Observatory',1968,8.7,890000,'movie','Sci-Fi,Adventure',null,null],
  ['A Signal in the Static',1979,8.4,560000,'movie','Sci-Fi,Mystery',null,null],
  ['The Long Way Home',1982,8.9,1200000,'movie','Sci-Fi,Drama',null,null],
  ['The Garden Beyond',1985,9.1,165000,'tvEpisode','Sci-Fi,Drama','Other Worlds',3],
  ['Visitors',1991,8.2,740000,'movie','Sci-Fi,Thriller',null,null],
  ['The Quiet Earthling',1994,9.4,45000,'tvEpisode','Sci-Fi,Mystery','The Night Archive',7],
  ['A Thousand Suns',1997,8.6,1600000,'movie','Sci-Fi,Adventure',null,null],
  ['The Shape of Tomorrow',1999,8.8,2050000,'movie','Sci-Fi,Action',null,null],
  ['A Small Infinity',2002,9.2,180000,'tvEpisode','Sci-Fi,Drama','Other Worlds',9],
  ['Transmission Lost',2006,7.9,385000,'movie','Sci-Fi,Thriller',null,null],
  ['The Memory Keeper',2009,9.7,260000,'tvEpisode','Sci-Fi,Mystery','The Night Archive',2],
  ['After the Sun',2014,8.7,2200000,'movie','Sci-Fi,Adventure,Drama',null,null],
  ['All Our Yesterdays',2016,9.3,147000,'tvEpisode','Sci-Fi,Drama','Other Worlds',5],
  ['An Ocean of Stars',2021,8.1,920000,'movie','Sci-Fi,Adventure',null,null],
  ['The Unfinished Map',2024,8.9,43000,'tvEpisode','Sci-Fi,Mystery','The Night Archive',6],
  ['Space Disaster IV',2005,3.5,300000,'movie','Sci-Fi,Action',null,null],
  ['Moon Motel',null,6.2,12000,'movie','Sci-Fi,Comedy',null,null],
  ['An Ordinary Tuesday',1988,8.3,810000,'movie','Drama,Comedy',null,null],
].map((row,i)=>{
  const [name,year,rating,votes,type,genres,series,episode]=row;
  return Title.parse({imdb_id:`tt${String(9900000+i)}`,name,original_year:year,average_rating:rating,num_votes:votes,title_type:type,genres:typeof genres==='string'?genres.split(','):[],series_name:series,parent_series_imdb_id:series?'tt9999999':null,season:series?1:null,episode_number:episode,provenance:'demo'});
});
export async function createDemo(dir=dataDir()):Promise<void>{
  await mkdir(dir,{recursive:true});
  await withUpdateLock(dir,async()=>{const version=`demo-${randomUUID()}`;const path=join(dir,`catalog-${version}.sqlite`);const db=connect(path);try{await migrateCatalog(db);await insertTitles(db,demoTitles);}finally{await db.destroy();}await finishCatalog(path,{version,created_at:new Date().toISOString(),demo:true,sources:[]},dir);});
}
