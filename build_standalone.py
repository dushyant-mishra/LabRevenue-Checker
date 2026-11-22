"""Make a zero-dependency, GitHub Pages friendly single HTML demo."""
from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'dev.html').read_text()
html=html.replace('<link rel="stylesheet" href="styles.css" />',f'<style>\n{(root/"styles.css").read_text()}\n</style>')
for name in ('engine.js','demo-data.js','app.js'):
    source=(root/name).read_text().replace('</script','<\\/script')
    html=html.replace(f'<script src="{name}" defer></script>',f'<script>\n{source}\n</script>')
assert all(x not in html for x in ('src="app.js"','src="engine.js"','href="styles.css"'))
(root/'index.html').write_text(html)
print(f'Built standalone HTML: {len(html):,} chars')
