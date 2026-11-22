from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os,threading
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
root=Path(__file__).resolve().parent.parent
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/LabRevenue_Public_Invoice_Pilot.html'
shots=root/'screenshots';shots.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1470,'height':1010},device_scale_factor=1,accept_downloads=True)
 errors=[];page.on('pageerror',lambda ex: errors.append(str(ex)))
 page.set_content((root/'index.html').read_text(encoding='utf-8'),wait_until='load');page.wait_for_timeout(300)
 print('Title:',page.title())
 print('Tabs:',page.locator('nav .nav').all_text_contents())
 assert page.locator('h1').first.inner_text().startswith('Clarity for every')
 assert page.get_by_text('$7,742.41').count()>0
 page.screenshot(path=str(shots/'overview-v5.png'),full_page=True)
 # evidence view and expected real case counts
 page.locator('[data-tab=ledger]').click()
 assert '7 of 7 invoices' in page.locator('#main').inner_text()
 rows=page.locator('.table tbody tr');assert rows.count()==7,rows.count()
 page.locator('#query').fill('M24005302');assert page.locator('.table tbody tr').count()==1
 page.locator('[data-open=M24005302]').click()
 assert page.locator('#detail').is_visible()
 assert '574.00' in page.locator('#detail').inner_text()
 page.keyboard.press('Escape');assert page.locator('#detail').is_hidden()
 # review desk note and export
 page.locator('[data-tab=review]').click()
 assert page.locator('[data-review]').count()==4
 page.locator('[data-review]').first.click()
 assert page.locator('#detail').is_visible()
 page.locator('[data-reviewstatus]').first.click()
 assert page.locator('#detail').is_hidden()
 assert 'Reviewed — no error concluded' in page.locator('#main').inner_text()
 page.screenshot(path=str(shots/'review-v5.png'),full_page=True)
 # real export
 with page.expect_download() as d:page.locator('[data-action=export-review]').click()
 obj=d.value; assert obj.suggested_filename.endswith('.csv'); obj.save_as(str(root/'review-export-test.csv'))
 # fictional sandbox
 page.locator('[data-tab=sandbox]').click()
 text=page.locator('#main').inner_text()
 for val in ['$1,390.00','$610.00','$210.00','FICTIONAL']:
  assert val in text,(val,text[:400])
 assert page.locator('.sim-case').count()==8
 page.screenshot(path=str(shots/'sandbox-v5.png'),full_page=True)
 page.locator('[data-simfilter=past_due]').click()
 assert page.locator('.sim-case').count()==1
 page.locator('[data-simcase]').first.click();assert 'Fictional' in page.locator('#detail').inner_text()
 page.locator('[data-close]').click()
 with page.expect_download() as d:page.locator('[data-action=export-simulation]').click()
 d.value.save_as(str(root/'simulation-export-test.csv'))
 # primary evidence page
 page.locator('[data-tab=evidence]').click()
 assert '50 charge lines' in page.locator('#main').inner_text()
 page.screenshot(path=str(shots/'evidence-v5.png'),full_page=True)
 print('Desktop browser tests OK. JS errors:',errors)
 assert not errors,errors
 # Mobile
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 errs=[];mobile.on('pageerror',lambda e: errs.append(str(e)));mobile.set_content((root/'index.html').read_text(encoding='utf-8'),wait_until='load')
 mobile.screenshot(path=str(shots/'mobile-v5.png'),full_page=True)
 assert mobile.get_by_text('Clarity for every').count()>0
 mobile.locator('[data-tab=sandbox]').click()
 assert '$1,390.00' in mobile.locator('#main').inner_text()
 mobile.screenshot(path=str(shots/'mobile-sandbox-v5.png'),full_page=True)
 # horizontally overflowing page check (some tab nav overflow acceptable but content should not)
 overflow=mobile.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
 print('Mobile horizontal overflow px',overflow)
 assert overflow<6,overflow
 assert not errs,errs
 print('Mobile browser tests OK.')
 browser.close()
 server.shutdown()
