// Run with playwright-cli run-code --filename=scripts/qa/style-fixtures.js.
// A browser-only style audit on an isolated local origin; API fixtures are visual evidence only.
async page => {
  const themes = ['retro','comic','comic-dark','doodle','glass','rounded','rounded-dark','night','paper','blackboard','contrast','plum'];
  const sizes = [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:900}];
  const origin = 'http://127.0.0.1:5186';
  const phase = new URL(page.url()).searchParams.get('audit') || 'before';
  const results = [];
  await page.emulateMedia({reducedMotion:'reduce'});
  const inspect = async (theme,size,state) => {
    await page.screenshot({path:`output/playwright/${phase}/${theme}-${size.name}-${state}.png`,fullPage:true});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const evidence = await page.evaluate(() => {
      const cache=new Map(),ctx=document.createElement('canvas').getContext('2d');
      const rgb = value => {if(cache.has(value))return [...cache.get(value)];ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const c=Array.from(ctx.getImageData(0,0,1,1).data).map((v,i)=>i===3?v/255:v);cache.set(value,c);return [...c];};
      const mix = (a,b) => a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
      const lum = c => c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      const contrast = (a,b) => {const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const issues = [], skipped = [];
      const overlay=document.querySelector('.help-popover:popover-open') || Array.from(document.querySelectorAll('.dialog-content')).find(el=>el.getBoundingClientRect().width);
      const elements=overlay ? overlay.querySelectorAll('*') : document.querySelectorAll('.doku *');
      for (const el of elements) {
        if (!Array.from(el.childNodes).some(n=>n.nodeType===3 && n.textContent.trim())) continue;
        if (el.closest('.sr-only, .toast:not(.visible), option, select')) continue;
        const cs=getComputedStyle(el),r=el.getBoundingClientRect();
        if(r.width<=1.5||r.height<=1.5||cs.visibility==='hidden'||cs.display==='none')continue;
        let chain=[],opacity=1,p=el,gradient=false;
        while(p){const s=getComputedStyle(p);chain.push(rgb(s.backgroundColor));opacity*=Number(s.opacity);gradient ||= s.backgroundImage!=='none';p=p.parentElement;}
        if(opacity<.5)continue; // disabled controls have no contrast requirement
        if(gradient&&!el.closest('.board[data-variant="jigsaw"]')){skipped.push(el.className);continue;}
        let bg=[255,255,255];for(const c of chain.reverse())bg=mix(c,[...bg,1]);
        let fg=rgb(cs.color);fg[3]*=opacity;fg=mix(fg,[...bg,1]);
        const ratio=contrast(fg,bg),large=parseFloat(cs.fontSize)>=24||(parseFloat(cs.fontSize)>=18.66&&Number(cs.fontWeight)>=700),minimum=large?3:4.5;
        if(ratio+.02<minimum)issues.push({element:el.tagName.toLowerCase()+'.'+String(el.className).split(' ').join('.'),text:el.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),minimum,ink:cs.color,bg:bg.map(Math.round),opacity});
      }
      const board=document.querySelector('.board'),br=board?.getBoundingClientRect();
      const cells=Array.from(document.querySelectorAll('.board .cell')).map(e=>{const s=getComputedStyle(e);return {region:e.dataset.region,background:s.backgroundColor,image:s.backgroundImage,ink:s.color,selected:e.classList.contains('selected')};});
      const title=document.querySelector('.game-home')?.getBoundingClientRect(),timer=document.querySelector('.game-status-center')?.getBoundingClientRect();
      return {issues,headerOverlap:!!(title&&timer&&title.right>timer.left+1),gradientSkipped:skipped.length,overflow:document.documentElement.scrollWidth>innerWidth+1,board:br?{width:br.width,height:br.height,bottom:br.bottom}:null,cells};
    });
    results.push({theme,size:size.name,state,...evidence});
  };

  let signed=false,relation='friend';
  const profile={id:'qa-self',name:'A long example player name for layout',handle:'qa_self',email:'qa@example.invalid',image:null,featuredBadges:[],publicProfile:true};
  const friend={id:'qa-friend',name:'Another long example player name',handle:'qa_friend',image:null};
  const row={points:920,dailies:7,days:5,consistency:71,speed:65,accuracy:90,independence:100,bestSeconds:{easy:320,medium:420,hard:600}};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let data={};let status=200;
    if(path==='/api/account/config')data={enabled:true,providers:{email:true,passkey:true,discord:true,apple:true}};
    else if(path==='/api/me'){data={profile:signed?profile:null};status=signed?200:401;}
    else if(path==='/api/me/records')data={records:[],added:0,rejected:0};
    else if(path==='/api/me/friends')data={inviteCode:'qa-only',friends:[friend],incoming:[{...friend,id:'incoming'}],outgoing:[{...friend,id:'outgoing'}]};
    else if(path==='/api/admin/par')data={since:'2026-09-07',days:30,minPlays:20,drift:.2,lines:['classic','hue','jigsaw'].flatMap(variant=>['easy','medium','hard'].map(difficulty=>({variant,difficulty,par:420,plays:25,players:15,unassistedPlays:22,median:400,p25:250,p75:650,medianSpeedScore:52,status:'ok',suggestedPar:null})))};
    else if(path==='/api/leaderboard'){const q=new URL(route.request().url()).searchParams;data={period:q.get('period'),scope:q.get('scope'),view:q.get('view'),today:'2026-10-07',start:'2026-10-05',end:'2026-10-11',players:[{rank:1,you:true,hidden:false,player:profile,row},{rank:2,you:false,hidden:false,player:friend,row}]};}
    else if(path.startsWith('/api/players/'))data={player:{...friend,joined:'2026-09-01'},relationship:relation,featuredBadges:[],awards:[],consistency:{week:{played:5,elapsed:7,percent:71},month:{played:5,elapsed:7,percent:71},year:{played:5,elapsed:7,percent:71}},week:row,month:row,totals:{puzzles:7,dailies:7}};
    else if(path==='/api/roadmap')data={configured:true,repository:'qa/fixture',issues:['status:planned','status:in-progress','status:shipped'].map((label,i)=>({id:i+1,number:i+1,title:'Example '+label,body:'Local visual fixture',url:'https://example.invalid/'+i,state:i===2?'closed':'open',labels:['roadmap',label],updatedAt:'2026-10-07'}))};
    else {status=404;data={error:'Local fixture: unavailable'};}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  for(const size of sizes){await page.setViewportSize(size);
    for(const theme of themes){
      await page.goto(origin+'/');await page.evaluate(theme=>{localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme}));},theme);
      signed=false;await page.goto(origin+'/profile/');await page.getByRole('heading',{name:'Keep your progress everywhere'}).waitFor();await inspect(theme,size,'account-signin-fixture');
      signed=true;await page.reload();await page.locator('#friends-title').waitFor();await page.getByRole('heading',{name:'Par check (admin)'}).waitFor();await inspect(theme,size,'account-social-fixture');
      await page.getByRole('button',{name:'Delete my account',exact:true}).click();await inspect(theme,size,'delete-confirm-fixture');
      await page.goto(origin+'/leaderboard/');await page.locator('.lb-rank').first().waitFor();await inspect(theme,size,'leaderboard-fixture');
      for(const r of ['self','friend','requested','incoming','none']){relation=r;await page.goto(origin+'/u/qa/');await page.locator('.player-head').waitFor();await inspect(theme,size,'player-'+r+'-fixture');}
      await page.goto(origin+'/roadmap/');await page.locator('.roadmap-card').first().waitFor();await inspect(theme,size,'roadmap-fixture');
      await page.goto(origin+'/history/');await inspect(theme,size,'history-empty');
      await page.goto(origin+'/');await page.getByRole('button',{name:'Style guide',exact:true}).click();await page.getByRole('combobox',{name:'Preview theme'}).selectOption(theme);await inspect(theme,size,'styleguide');
    }
  }
  await page.unroute('**/api/**');
  const downloadPromise=page.waitForEvent('download');
  await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='fixtures.json';a.click();},results);
  await (await downloadPromise).saveAs(`output/playwright/${phase}/fixtures.json`);
}
