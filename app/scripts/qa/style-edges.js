// Run with playwright-cli run-code --filename=scripts/qa/style-edges.js.
// A browser-only style audit on an isolated local origin; API fixtures are visual evidence only.
async page => {
  const themes = ['retro','comic','comic-dark','doodle','glass','rounded','rounded-dark','night','paper','blackboard','contrast','plum'];
  const sizes = [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:900}];
  const origin = 'http://127.0.0.1:5186';
  const phase = 'edges';
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

  const id='11111111-1111-4111-8111-111111111111';
  const peerResults=Array.from({length:3},(_,i)=>({id:'peer-'+i,name:'Friend '+(i+1),difficulty:i===2?'hard':'medium',elapsedSeconds:280+i*250,accuracy:90+i*3,hints:i,checks:i,autocheck:false,autofills:0,reveals:0,conflicts:false,assisted:i>0,verification:'self-reported',completedAt:'2026-10-07T20:00:00.000Z'}));
  let variant='classic';
  await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;let data={},status=200;if(p==='/api/account/config')data={enabled:false,providers:{}};else if(p==='/api/roadmap')data={configured:false,issues:[]};else if(p==='/api/challenges/'+id)data={id,seed:'style-groups',variant,results:peerResults};else{status=404;data={error:'Local visual fixture unavailable'};}await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});});
  await page.goto(origin+'/');
  const samples=await page.evaluate(async id=>{const {createPuzzle}=await import('/src/game/engine.ts'),{newSession}=await import('/src/game/session.ts');return ['classic','hue','jigsaw'].map(v=>{const s=newSession(createPuzzle('style-groups',v,'medium'));s.values=[...s.puzzle.solution];s.first=s.values.map((v,i)=>s.puzzle.givens[i]?null:v);s.seconds=420;s.completedAt='2026-10-07T20:00:00.000Z';s.challenge={id,attemptId:'qa-me',token:'local-visual-only'};s.submitted=true;return s;});},id);
  for(const size of sizes){await page.setViewportSize(size);for(const theme of themes){
    for(const sample of samples){variant=sample.puzzle.variant;await page.evaluate(({theme,sample})=>{localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme}));localStorage.setItem('doku.history.v1',JSON.stringify([sample]));},{theme,sample});
      await page.goto(origin+'/history/');await page.locator('.history-list button').first().click();await page.locator('.rv-matrix').waitFor();await inspect(theme,size,'results-group-'+variant);
      await page.getByRole('button',{name:'Settings',exact:true}).last().click();
      // Use the actual result view labels, avoiding positional gameplay switches.
      const labels=await page.evaluate(async()=>{const {RESULT_VIEWS}=await import('/src/results/model.ts');return RESULT_VIEWS.map(v=>v.label);});
      for(const label of labels){await page.getByRole('switch',{name:label,exact:true}).click();}
      await page.getByRole('button',{name:'Close',exact:true}).click();await inspect(theme,size,'results-fallback-'+variant);
    }
  }}
  await page.setViewportSize({width:320,height:568});
  for(const theme of themes){
    const sample=await page.evaluate(async()=>{const {createPuzzle}=await import('/src/game/engine.ts'),{newSession}=await import('/src/game/session.ts');return newSession(createPuzzle('compact-audit','jigsaw','hard'));});
    await page.evaluate(({theme,sample})=>{localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme,size:1.2,noteSize:1.35}));localStorage.setItem('doku.active.v1',JSON.stringify(sample));},{theme,sample});
    await page.goto(origin+'/play/');await page.locator('.board').waitFor();await inspect(theme,{name:'compact'},'game-jigsaw');
  }
  const d=page.waitForEvent('download');await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)]));a.download='edges.json';a.click();},results);await(await d).saveAs('output/playwright/edges/matrix.json');
  await page.unroute('**/api/**');
}
