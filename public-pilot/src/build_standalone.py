"""Build a network-free standalone investor/customer demo with embedded assets."""
from pathlib import Path
import base64, mimetypes
ROOT=Path(__file__).resolve().parent
html=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'styles.css').read_text(encoding='utf-8')
data=(ROOT/'pilot-data.js').read_text(encoding='utf-8')
js=(ROOT/'app.js').read_text(encoding='utf-8')
engine=(ROOT/'engine.js').read_text(encoding='utf-8')
sandbox=(ROOT/'sandbox-data.js').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+css+'\n</style>')
html=html.replace('<script defer src="pilot-data.js"></script><script defer src="engine.js"></script><script defer src="sandbox-data.js"></script><script defer src="app.js"></script>','')
html=html.replace('</body>', ''.join('<script>\n'+x.replace('</script','<\\/script')+'\n</script>' for x in (data,engine,sandbox,js))+'\n</body>')
for name in ('hero-audit.webp','evidence-chain.webp'):
    uri='data:image/webp;base64,'+base64.b64encode((ROOT.parent/'assets'/name).read_bytes()).decode('ascii')
    html=html.replace('../assets/'+name,uri)
assert 'src="assets/' not in html
assert 'src="app.js"' not in html
path=ROOT/'LabRevenue_Public_Invoice_Pilot.html'
path.write_text(html,encoding='utf-8')
print(f'{path}: {path.stat().st_size:,} bytes')
