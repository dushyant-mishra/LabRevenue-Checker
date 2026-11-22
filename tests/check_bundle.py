from pathlib import Path
root=Path(__file__).resolve().parents[1]
pilot=root/'public-pilot'
html=(pilot/'index.html').read_text(encoding='utf-8')
assert '<!doctype html>' in html.lower()
for f in ['pilot-data.js','engine.js','sandbox-data.js','app.js']:
    js=(pilot/'src'/f).read_text(encoding='utf-8').replace('</script','<\\/script')
    assert js in html, f'{f} not embedded in standalone demo'
assert (pilot/'src'/'styles.css').read_text(encoding='utf-8') in html
assert (root/'index.html').read_text(encoding='utf-8')==html
assert 'What to check next' in html
assert 'Clarity for every' not in html
print('PASS: bundled app matches source and root demo')
