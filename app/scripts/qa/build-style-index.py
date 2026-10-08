"""Build a local screenshot browser after running the Playwright collectors."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'output' / 'playwright'
themes = ['comic-dark', 'rounded-dark', 'retro', 'comic', 'doodle', 'glass',
          'rounded', 'night', 'paper', 'blackboard', 'contrast', 'plum']
records = []
for group in ['final', 'edges', 'preview', 'palette']:
    for path in sorted((root / group).glob('*.png')):
        theme = next(t for t in themes if path.name.startswith(t + '-'))
        records.append(dict(group=group, theme=theme, name=path.stem[len(theme)+1:],
                            path=path.relative_to(root).as_posix()))
html = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>*doku local style evidence</title><link rel="icon" href="/assets/brand/doku-icon.png"><style>
body{margin:0;background:#101a28;color:#f5f6fa;font:16px system-ui,sans-serif}
header{position:sticky;top:0;padding:18px;background:#101a28;z-index:1;border-bottom:1px solid #435368}
h1{font-size:22px;margin:0 0 8px}p{color:#b8c8dc;margin:8px 0}
.controls{display:flex;gap:12px;flex-wrap:wrap}label{display:grid;gap:5px;font-size:13px}
select,input{font:inherit;padding:8px;border:1px solid #6f839e;border-radius:6px;background:#23344c;color:#fff}
main{padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
figure{margin:0;padding:12px;background:#1c2a3b;border-radius:8px;overflow:hidden}
img{display:block;max-width:100%;height:auto;max-height:750px;object-fit:contain;object-position:top;margin:auto}
figcaption{margin-bottom:10px;font-size:13px;color:#cbd9eb}a{color:#c1f0d8}
</style><header><h1>*doku — local style audit evidence</h1>
<p>Browser screenshots and fixtures. Physical devices, providers and stores remain unverified.</p>
<div class="controls"><label>Theme<select id="theme"></select></label>
<label>Evidence set<select id="group"><option>final</option><option>edges</option><option>preview</option><option>palette</option></select></label>
<label>Screen or device<input id="search" type="search" placeholder="e.g. setup, jigsaw, settings"></label></div>
<p id="count" aria-live="polite"></p></header><main id="screens"></main>
<script>
const records=RECORDS;
const themes=THEMES;
const theme=document.querySelector('#theme'),group=document.querySelector('#group'),search=document.querySelector('#search');
for(const name of themes){const o=document.createElement('option');o.value=name;o.textContent=name;theme.append(o)}
function render(){const rows=records.filter(r=>r.theme===theme.value&&r.group===group.value&&r.name.includes(search.value.toLowerCase()));document.querySelector('#count').textContent=rows.length+' screenshots';const host=document.querySelector('#screens');host.replaceChildren();for(const r of rows){const f=document.createElement('figure'),c=document.createElement('figcaption'),a=document.createElement('a'),im=document.createElement('img');a.href=r.path;a.target='_blank';a.rel='noopener';a.textContent=r.name;c.append(a);im.src=r.path;im.alt=r.theme+' '+r.name;im.loading='lazy';f.append(c,im);host.append(f)}}
for(const el of [theme,group,search])el.addEventListener('input',render);render();
</script></html>'''.replace('RECORDS', json.dumps(records)).replace('THEMES', json.dumps(themes))
(root / 'index.html').write_text(html)
print(f'Indexed {len(records)} screenshots: {root / "index.html"}')
