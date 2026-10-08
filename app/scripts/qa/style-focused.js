// Run with playwright-cli run-code --filename=scripts/qa/style-focused.js.
// A browser-only style audit on an isolated local origin; API fixtures are visual evidence only.
async page => {
  const themes = ['comic','rounded-dark','doodle'];
  const sizes = [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:900}];
  const origin = 'http://127.0.0.1:5186';
  const phase = 'final';
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

  for(const size of sizes){await page.setViewportSize(size);for(const theme of themes){
    await page.goto(origin+'/');await page.evaluate(theme=>{localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme}));},theme);
    await page.goto(origin+'/');await page.getByRole('button',{name:'Style guide',exact:true}).click();
    await page.getByRole('combobox',{name:'Preview theme'}).selectOption(theme);await inspect(theme,size,'styleguide');
  }}
  const d=page.waitForEvent('download');await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)]));a.download='focused.json';a.click();},results);await(await d).saveAs('output/playwright/final/focused.json');
}
