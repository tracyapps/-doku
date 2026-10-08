// Run with playwright-cli run-code --filename=scripts/qa/style-matrix.js.
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
  await page.goto(origin+'/play/');
  // Use the real engine/session API for deterministic local saved-game fixtures.
  const samples = await page.evaluate(async () => {
    const {createPuzzle}=await import('/src/game/engine.ts');const {newSession}=await import('/src/game/session.ts');
    return ['classic','hue','jigsaw'].map(v=>{
      const s=newSession(createPuzzle('style-audit-2026-10-07',v,'medium'));
      const empty=s.values.map((x,i)=>!x?i:-1).filter(i=>i>=0);s.notes[empty[0]]=[1,3,7];s.values[empty[1]]=s.puzzle.solution[empty[1]]%9+1;
      s.first[empty[1]]=s.values[empty[1]];s.events=[{kind:'set',cell:empty[1],value:s.values[empty[1]]}];s.seconds=238;
      const done={...s,values:[...s.puzzle.solution],completedAt:'2026-10-07T20:00:00.000Z',seconds:420};
      return {variant:v,session:s,done};
    });
  });
  for(const size of sizes){
    await page.setViewportSize(size);
    for(const theme of themes){
      await page.evaluate(({theme,samples})=>{
        localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme,autocheck:true,size:1.2,noteSize:1.35}));
        localStorage.setItem('doku.history.v1',JSON.stringify(samples.map(s=>s.done)));
      },{theme,samples});
      for(const [state,path] of [['home','/'],['setup','/play/'],['history','/history/'],['profile','/profile/'],['how','/how/'],['roadmap-error','/roadmap/'],['privacy','/privacy/'],['terms','/terms/'],['leaderboard-error','/leaderboard/'],['player-error','/u/qa/']]){
        await page.goto(origin+path);await page.locator('main').waitFor();
        await inspect(theme,size,state);
        if(state==='setup'){
          for(let n=1;n<3;n++){await page.locator('.type-option').nth(n).click();await inspect(theme,size,'setup-'+samples[n].variant);}
        }
        if(state==='history'){
          await page.locator('.history-list button').first().click();await page.locator('.rv-card').first().waitFor();await inspect(theme,size,'results');
        }
      }
      for(const sample of samples){
        await page.evaluate(s=>localStorage.setItem('doku.active.v1',JSON.stringify(s)),sample.session);
        await page.goto(origin+'/play/');await page.locator('.board .cell').last().waitFor();
        await page.locator('.cell.entry').filter({has:page.locator('.notes-grid')}).first().click();
        await inspect(theme,size,'game-'+sample.variant+'-notes');
        await page.locator('.cell.given').first().click();await inspect(theme,size,'game-'+sample.variant+'-given');
        if(sample.variant==='jigsaw'){
          await page.getByRole('button',{name:'Settings',exact:true}).last().click();await page.getByRole('dialog').waitFor();await inspect(theme,size,'settings');
          await page.getByRole('combobox',{name:'Number font',exact:true}).scrollIntoViewIfNeeded();await inspect(theme,size,'settings-numbers');
          await page.getByRole('button',{name:'What do cell first and value first mean?'}).scrollIntoViewIfNeeded();
          await page.getByRole('button',{name:'What do cell first and value first mean?'}).click();await inspect(theme,size,'input-help');
          await page.getByRole('button',{name:'Got it',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
          await page.getByRole('button',{name:'More options',exact:true}).click();await inspect(theme,size,'more');
          await page.getByRole('button',{name:'Change level / restart'}).click();await inspect(theme,size,'restart-confirm');await page.getByRole('button',{name:'Keep playing',exact:true}).click();
          await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByRole('button',{name:'Friends’ results',exact:true}).click();await inspect(theme,size,'friends-empty');
        }
      }
    }
  }
  const downloadPromise=page.waitForEvent('download');
  await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='matrix.json';a.click();},results);
  await (await downloadPromise).saveAs(`output/playwright/${phase}/matrix.json`);
}
