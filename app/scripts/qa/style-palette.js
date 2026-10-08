// Run with playwright-cli run-code --filename=scripts/qa/style-palette.js.
// A browser-only style audit on an isolated local origin; API fixtures are visual evidence only.
async page => {
  const themes = ['retro','comic','comic-dark','doodle','glass','rounded','rounded-dark','night','paper','blackboard','contrast','plum'];
  const sizes = [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:900}];
  const origin = 'http://127.0.0.1:5186';
  const phase = 'palette';
  const results = [];
  await page.emulateMedia({reducedMotion:'reduce'});
  const inspect = async (theme,size,state) => {
    if(state.endsWith('theme-theme') || state.startsWith('easy-')) await page.screenshot({path:`output/playwright/${phase}/${theme}-${size.name}-${state}.png`,fullPage:true});
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
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/play/');
  const samples=await page.evaluate(async()=>{
    const {createPuzzle}=await import('/src/game/engine.ts'),{newSession}=await import('/src/game/session.ts');
    return ['classic','hue','jigsaw'].map(v=>newSession(createPuzzle('style-easy',v,'easy')));
  });
  for(const theme of themes){
    for(const sample of samples){
      await page.evaluate(({theme,sample})=>{localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme,size:.85,noteSize:1}));localStorage.setItem('doku.active.v1',JSON.stringify(sample));},{theme,sample});
      await page.goto(origin+'/play/');await page.locator('.board .cell').last().waitFor();
      await inspect(theme,{name:'phone'},'easy-'+sample.puzzle.variant);
    }
    // Probe every region against all text states using the real cell markup/CSS.
    // This is a palette diagnostic, not a solvable Sudoku or screen-flow proof.
    await page.evaluate(()=>{
      const board=document.querySelector('.board'),originals=[...board.querySelectorAll('.cell')];
      const states=['given','entry','entry selected','entry matching','entry selected matching','entry error','entry','entry selected','entry selected matching'];
      board.innerHTML='';
      for(let region=0;region<9;region++)for(let state=0;state<9;state++){
        const cell=originals.find(c=>c.dataset.region===String(region)).cloneNode(false);
        cell.dataset.region=String(region);cell.className='cell '+states[state];
        cell.style.borderRightWidth=state===8?'0':'1px';cell.style.borderBottomWidth=region===8?'0':'1px';
        if(state>=6){const notes=document.createElement('span');notes.className='notes-grid';for(let i=1;i<=9;i++){const n=document.createElement('span');n.textContent=[1,3,7].includes(i)?String(i):'';if(i===3&&state===8)n.className='note-match';notes.appendChild(n);}cell.appendChild(notes);}
        else {const n=document.createElement('span');n.className='cell-value';n.textContent=String(region+1);cell.appendChild(n);}
        board.appendChild(cell);
      }
    });
    for(const font of ['theme','sans','serif','mono'])for(const weight of ['theme',400,500,700]){
      await page.evaluate(({font,weight})=>{
        const d=document.querySelector('.doku');
        const family={sans:'"DM Sans", sans-serif',serif:'Georgia, serif',mono:'ui-monospace, monospace'};
        d.style.setProperty('--value-font',font==='theme'?'var(--theme-value-font)':family[font]);
        d.style.setProperty('--value-weight',weight==='theme'?'var(--theme-value-weight)':String(weight));
      },{font,weight});
      await inspect(theme,{name:'phone'},'jigsaw-palette-'+font+'-'+weight);
    }
  }
  const d=page.waitForEvent('download');await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)]));a.download='palette.json';a.click();},results);await(await d).saveAs('output/playwright/palette/matrix.json');
}
