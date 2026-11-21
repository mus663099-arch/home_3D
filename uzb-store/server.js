const express=require('express'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),crypto=require('crypto'),path=require('path');
const app=express();app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'100kb'}));app.use(express.static(path.join(__dirname,'public')));
let apps=[];let nextId=Math.max(0,...apps.map(a=>Number(a.id)||0))+1;const sessions=new Map();
// F-Droid — rasmiy ochiq kodli APK katalogi. Katalog yuklanishi server loglarida qayd etiladi.
const termuxFallback={id:'fdroid:com.termux',name:'Termux',category:'Asboblar',description:'Android uchun terminal va Linux muhiti. Python, Git va boshqa paketlarni qo‘llab-quvvatlaydi.',version:'0.119.0-beta.3',icon:'',download_url:'https://f-droid.org/repo/com.termux_1022.apk',download_type:'apk',source:'F-Droid',package_name:'com.termux',featured:true};
const fallbackFdroidApps=[
{id:'fdroid:org.videolan.vlc',name:'VLC',category:'Ko‘ngilochar',description:'Video va audio fayllarni ko‘plab formatlarda ijro etuvchi bepul media pleer.',version:'3.7.2',icon:'',download_url:'https://f-droid.org/repo/org.videolan.vlc_13070206.apk',download_type:'apk',source:'F-Droid',featured:true},
{id:'fdroid:org.fossify.gallery',name:'Fossify Gallery',category:'Asboblar',description:'Reklamasiz, ochiq kodli foto va video galereya hamda oddiy tahrirlash vositalari.',version:'1.14.2',icon:'',download_url:'https://f-droid.org/repo/org.fossify.gallery_40.apk',download_type:'apk',source:'F-Droid',featured:true},
{id:'fdroid:de.danoeh.antennapod',name:'AntennaPod',category:'Ko‘ngilochar',description:'Podkastlarni tinglash, yuklab olish va boshqarish uchun ochiq kodli ilova.',version:'3.12.3',icon:'',download_url:'https://f-droid.org/repo/de.danoeh.antennapod_3120395.apk',download_type:'apk',source:'F-Droid',featured:false},
{id:'fdroid:me.zhanghai.android.files',name:'Material Files',category:'Asboblar',description:'Fayllar, arxivlar va tarmoq xotiralarini boshqaruvchi Material Design fayl menejeri.',version:'1.7.5',icon:'',download_url:'https://f-droid.org/repo/me.zhanghai.android.files_40.apk',download_type:'apk',source:'F-Droid',featured:false}
];
let fdroidCache={at:0,items:[termuxFallback,...fallbackFdroidApps]},fdroidFetch=null;
function getFdroidApps(){
  if(Date.now()-fdroidCache.at>1800000&&!fdroidFetch){
    fdroidFetch=(async()=>{try{
      const [mainResponse,archiveResponse]=await Promise.all([
        fetch('https://f-droid.org/repo/index-v1.json',{headers:{'user-agent':'UZB-STORE/1.0'},signal:AbortSignal.timeout(30000)}),
        fetch('https://f-droid.org/archive/index-v1.json',{headers:{'user-agent':'UZB-STORE/1.0'},signal:AbortSignal.timeout(30000)})
      ]);
      if(!mainResponse.ok)throw new Error('F-Droid main index unavailable');
      const mainIndex=await mainResponse.json();
      const archiveIndex=archiveResponse.ok?await archiveResponse.json():null;
      const items=[],seenPackages=new Set();
      // Rasmiy asosiy va arxiv indekslarini birlashtiramiz; faol versiya arxivdagi takrordan ustun.
      function addRepository(index,isArchive=false){
        if(!index)return;
        const appMetaById=new Map((Array.isArray(index.apps)?index.apps:Object.values(index.apps||{})).filter(a=>a&&a.packageName).map(a=>[a.packageName,a]));
        for(const [packageName,versions] of Object.entries(index.packages||{})){
          if(seenPackages.has(packageName)||!Array.isArray(versions)||!versions.length)continue;
          const v=[...versions].sort((a,b)=>Number(b.versionCode||0)-Number(a.versionCode||0))[0],meta=appMetaById.get(packageName)||{};
          if(!v.apkName||!meta.name)continue;
          const icon=meta.icon||'',cats=Array.isArray(meta.categories)?meta.categories:[];
          const category=cats.some(x=>/game/i.test(x))?'O‘yin':cats.some(x=>/internet|social|multimedia/i.test(x))?'Ko‘ngilochar':cats.some(x=>/science|education/i.test(x))?'Ta’lim':'Asboblar';
          const searchable=[meta.name,meta.summary,meta.description,cats.join(' ')].join(' ');if(/casino|betting|gambling|weapon|firearm|ammo|adult|porn|drug|cannabis|marijuana|tobacco|vape/i.test(searchable))continue;
          seenPackages.add(packageName);
          items.push({id:'fdroid:'+packageName,name:String(meta.name).slice(0,100),category,description:String(meta.summary||meta.description||'Ochiq kodli Android ilovasi.').replace(/<[^>]*>/g,' ').slice(0,500),version:String(v.versionName||v.versionCode||'').slice(0,30),icon:icon?'https://f-droid.org/repo/icons-640/'+encodeURIComponent(icon):'',download_url:'https://f-droid.org/'+(isArchive?'archive/':'repo/')+encodeURIComponent(v.apkName),download_type:'apk',size:Number(v.size||0),source:isArchive?'F-Droid Archive':'F-Droid',archived:isArchive,package_name:packageName,featured:false});
        }
      }
      addRepository(mainIndex,false);
      addRepository(archiveIndex,true);
      // F-Droid asosiy repozitoriysidagi barcha mos APK yozuvlarini ko‘rsatamiz.
      // Taniqli ilovalar va o‘yinlar ro‘yxat boshida turadi; qolganlari alifbo tartibida.
      // Faqat indeksda haqiqatan mavjud APK yozuvlari qo‘shiladi.
      const appPriority=[
        /^F-Droid$/i,/^Termux$/i,/Firefox/i,/^VLC$/i,/KDE Connect/i,
        /Fossify.*(File|Gallery)/i,/AntennaPod/i,/NewPipe/i,/Aurora Store/i,
        /OsmAnd/i,/Organic Maps/i,/K-9 Mail|Thunderbird/i,/Signal/i,/Element/i,
        /Tor Browser/i,/Wikipedia/i,/Tasks(\.org)?/i,/Nextcloud/i,/OpenBoard/i,
        /Syncthing/i,/Feeder/i,/Droid-?ify/i,/AnkiDroid/i,/KeePassDX/i,/Aegis/i,
        /AdAway/i,/Shelter/i,/DAVx/i,/Markor/i,/Material Files/i,/Transistor/i,
        /OpenTracks/i,/Mastodon/i,/Librera/i,/KOReader/i,/Kiwix/i,/Open Camera/i,
        /Fennec/i,/Mull/i,/Fossify/i,/Calculator/i,/Calendar/i,/Notes/i,/Recorder/i,
        /File Manager/i,/Gallery/i
      ];
      const gamePriority=[
        /Unciv/i,/Shattered Pixel Dungeon/i,/Mindustry/i,/Luanti|Minetest/i,
        /OpenTTD/i,/SuperTuxKart/i,/Battle for Wesnoth/i,/Endless Sky/i,
        /Simon Tatham.*Puzzles/i,/Sudoku/i,/Chess/i,/Solitaire/i,/2048/i,
        /Tetris/i,/Pac-?Man/i,/Pixel Dungeon/i,/OpenMW/i,/ScummVM/i,
        /RetroArch/i,/Puzzle/i,/Tower Defense/i,/Roguelike/i
      ];
      const priorityScore=(item,patterns)=>{
        const i=patterns.findIndex(pattern=>pattern.test(item.name)||pattern.test(item.package_name||''));
        return i<0?10000:i;
      };
      const isGame=x=>x.category==='O‘yin';
      const appPool=items.filter(x=>!isGame(x)).sort((a,b)=>
        priorityScore(a,appPriority)-priorityScore(b,appPriority)||a.name.localeCompare(b.name)
      );
      const gamePool=items.filter(isGame).sort((a,b)=>
        priorityScore(a,gamePriority)-priorityScore(b,gamePriority)||a.name.localeCompare(b.name)
      );
      const selectedApps=appPool;
      const selectedGames=gamePool;
      for(const item of selectedApps)item.featured=true;
      for(const item of selectedGames){item.category='O‘yin';item.featured=true;}
      fdroidCache={at:Date.now(),items:[...selectedApps,...selectedGames]};
      if(!fdroidCache.items.length)fdroidCache={at:Date.now(),items:[termuxFallback,...fallbackFdroidApps]};
    }catch(error){console.error('F-Droid katalogi:',error.message);fdroidCache={at:Date.now(),items:[termuxFallback,...fallbackFdroidApps]};}finally{fdroidFetch=null;}})();
  }
  return fdroidFetch ? fdroidFetch.then(()=>fdroidCache.items) : Promise.resolve(fdroidCache.items);
}
const loginLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false});
function admin(req,res,next){const t=(req.headers.authorization||'').replace(/^Bearer /,'');if(!sessions.has(t)||sessions.get(t)<Date.now()){sessions.delete(t);return res.status(401).json({error:'Admin sifatida qayta kiring'});}next();}
app.get('/api/apps',async(req,res)=>{const q=(req.query.q||'').toLowerCase(),c=req.query.category||'';let catalog=[...apps,...await getFdroidApps()];if(req.query.admin!=='1')catalog=catalog.filter(a=>a.download_type==='apk');res.json(catalog.filter(a=>(!q||a.name.toLowerCase().includes(q)||a.description.toLowerCase().includes(q))&&(!c||a.category===c)).sort((a,b)=>Number(b.featured)-Number(a.featured)||a.name.localeCompare(b.name)));});
app.get('/api/catalog/status',async(req,res)=>{const items=await getFdroidApps();res.json({source:'F-Droid main + archive',count:items.length,active:items.filter(x=>!x.archived).length,archived:items.filter(x=>x.archived).length,apps:items.filter(x=>x.category!=='O‘yin').length,games:items.filter(x=>x.category==='O‘yin').length,updatedAt:fdroidCache.at||null});});
app.post('/api/admin/login',loginLimit,(req,res)=>{if(req.body.password!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:'Parol noto‘g‘ri'});const t=crypto.randomBytes(32).toString('hex');sessions.set(t,Date.now()+12*60*60*1000);res.json({token:t});});
app.post('/api/admin/logout',admin,(req,res)=>{sessions.delete((req.headers.authorization||'').replace(/^Bearer /,''));res.json({ok:true});});
app.post('/api/apps',admin,(req,res)=>{const a=validate(req.body);if(!a)return res.status(400).json({error:'Ilova nomi va https:// bilan boshlanuvchi yuklab olish havolasi kerak'});a.id=nextId++;apps.push(a);res.status(201).json(a);});
app.put('/api/apps/:id',admin,(req,res)=>{const i=apps.findIndex(a=>a.id===Number(req.params.id)),a=validate(req.body);if(i<0)return res.sendStatus(404);if(!a)return res.status(400).json({error:'Ilova nomi va to‘g‘ri havola kerak'});apps[i]={...a,id:apps[i].id};res.json(apps[i]);});
app.delete('/api/apps/:id',admin,(req,res)=>{apps=apps.filter(a=>a.id!==Number(req.params.id));res.json({ok:true});});
function validate(b){if(!b.name||!/^https:\/\//i.test(b.download_url||''))return null;const url=new URL(b.download_url),host=url.hostname.toLowerCase();if(['play.google.com','market.android.com','play.app.goo.gl'].includes(host))return null;return{name:String(b.name).slice(0,100),category:String(b.category||'Ilova').slice(0,40),description:String(b.description||'').slice(0,1200),version:String(b.version||'1.0').slice(0,30),icon:String(b.icon||'').slice(0,500),download_url:b.download_url,download_type:url.pathname.toLowerCase().endsWith('.apk')?'apk':'link',featured:!!b.featured};}
app.get('/health',(_,res)=>res.json({ok:true,app:'UZB STORE'}));const port=process.env.PORT||3000;app.listen(port,'0.0.0.0',()=>console.log('UZB STORE running on '+port));