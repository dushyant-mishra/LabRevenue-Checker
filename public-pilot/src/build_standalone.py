"""Build public-pilot/index.html from modular src files. No remote dependencies."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
html=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'styles.css').read_text(encoding='utf-8')
scripts=[(ROOT/f).read_text(encoding='utf-8') for f in ('pilot-data.js','engine.js','sandbox-data.js','app.js')]
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+css+'\n</style>')
html=html.replace('<script defer src="pilot-data.js"></script><script defer src="engine.js"></script><script defer src="sandbox-data.js"></script><script defer src="app.js"></script>','')
html=html.replace('</body>','\n'.join('<script>\n'+s.replace('</script','<\\/script')+'\n</script>' for s in scripts)+'\n</body>')
assert 'src="app.js"' not in html and 'href="styles.css"' not in html
out=ROOT.parent/'index.html'
out.write_text(html,encoding='utf-8')
(root_copy:=ROOT.parent.parent/'index.html').write_text(html,encoding='utf-8')
print('Created',out,'and',root_copy)
