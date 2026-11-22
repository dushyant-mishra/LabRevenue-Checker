from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
assert '<!DOCTYPE html>' in html
for source in ('engine.js','app.js','demo-data.js'):
    content=(root/source).read_text().replace('</script','<\\/script')
    assert content in html, f'Standalone HTML missing current {source}'
assert (root/'styles.css').read_text() in html
assert 'src="app.js"' not in html
print('PASS standalone bundle matches source files')
