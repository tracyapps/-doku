// Run via playwright-cli in an isolated session against the preview server.
async page => {
  const origin='http://127.0.0.1:5187';
  const themes=['retro','comic','comic-dark','doodle','glass','rounded','rounded-dark','night','paper','blackboard','contrast','plum'];
  const cases=[];
  await page.setViewportSize({width:1100,height:1100});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin);
  const samples=await page.evaluate(async()=>{const {createPuzzle}=await import('/src/game/engine.ts');const {newSession}=await import('/src/game/session.ts');return ['classic','hue','jigsaw'].map(v=>{const s=newSession(createPuzzle('style-preview',v,'hard'));const i=s.values.findIndex(x=>!x);s.notes[i]=[1,3,7];return s;});});
  for(const theme of themes)for(const device of ['iphone','pixel-10'])for(const s of samples){
    await page.evaluate(({theme,s})=>{localStorage.clear();localStorage.setItem('doku.settings.v1',JSON.stringify({theme,size:1.2,noteSize:1.35}));localStorage.setItem('doku.active.v1',JSON.stringify(s));},{theme,s});
    await page.goto(origin+'/?play=1');await page.locator('.board').waitFor();
    if(device==='pixel-10'){await page.getByTestId('device-picker').click();await page.getByTestId('device-option-pixel-10').click();}
    await page.locator('.cell.entry').filter({has:page.locator('.notes-grid')}).first().click();
    await page.mouse.move(0,0);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const metrics=await page.evaluate(()=>{const b=document.querySelector('.board').getBoundingClientRect(),s=document.querySelector('.device-screen').getBoundingClientRect(),k=document.querySelector('.keypad').getBoundingClientRect(),t=document.querySelector('.game-home').getBoundingClientRect(),timer=document.querySelector('.game-status-center').getBoundingClientRect();return {square:Math.abs(b.width-b.height)<1,keypadInside:k.bottom<=s.bottom-20,headerOverlap:t.right>timer.left+1};});
    cases.push({theme,device,variant:s.puzzle.variant,...metrics});
    await page.locator('.phone-device').screenshot({path:`output/playwright/preview/${theme}-${device}-${s.puzzle.variant}.png`});
    if(s.puzzle.variant==='jigsaw'){
      await page.getByRole('button',{name:'Settings',exact:true}).last().click();await page.getByTestId('bottom-sheet').waitFor();
      await page.getByRole('combobox',{name:'Number font',exact:true}).scrollIntoViewIfNeeded();
      await page.mouse.move(0,0);
      await page.locator('.phone-device').screenshot({path:`output/playwright/preview/${theme}-${device}-settings.png`});
      await page.keyboard.press('Escape');
    }
  }
  const d=page.waitForEvent('download');await page.evaluate(data=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)]));a.download='preview.json';a.click();},cases);await(await d).saveAs('output/playwright/preview/matrix.json');
}
