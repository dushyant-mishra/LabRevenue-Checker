from playwright.sync_api import sync_playwright
from pathlib import Path
import os,threading
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'index.html'
SHOTS=ROOT/'screenshots'
SHOTS.mkdir(exist_ok=True)
server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
URL=f"http://127.0.0.1:{server.server_port}/{P.name}"
with sync_playwright() as api:
 browser=api.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1360,'height':940},device_scale_factor=1,accept_downloads=True)
 failures=[];page.on('pageerror',lambda err: failures.append(str(err)))
 page.set_content(P.read_text(encoding="utf-8"),wait_until="load");page.wait_for_timeout(150)
 assert page.locator('h1').inner_text()=='Invoice review'
 main=page.locator('#main').inner_text()
 for phrase in ['All seven invoice totals add up.','one historical pricing question','$7,742.41','What we could confirm','What we still need']:
  assert phrase in main,phrase
 assert 'Clarity for every' not in main
 assert not page.locator('.brand-hero').count()
 page.screenshot(path=str(SHOTS/'human-overview.png'),full_page=True)
 page.locator('[data-nav=questions]').first.click()
 assert page.locator('.question-card').count()==4
 assert 'Was the higher retesting charge approved?' in page.locator('#main').inner_text()
 page.screenshot(path=str(SHOTS/'human-questions.png'),full_page=True)
 page.locator('[data-question=PLYMOUTH-CONTRACT]').click()
 assert page.locator('#detail').is_visible()
 assert 'What to ask for next' in page.locator('#detail').inner_text()
 page.locator('[data-setstatus="Need more documents"]').click()
 assert 'Need more documents' in page.locator('#main').inner_text()
 with page.expect_download() as d:page.locator('[data-action=download-questions]').click()
 d.value.save_as(str(ROOT/'questions-export-human.csv'))
 page.locator('[data-nav=invoices]').first.click()
 assert page.locator('.table tbody tr').count()==7
 page.locator('#query').fill('M24005302')
 assert page.locator('.table tbody tr').count()==1
 page.locator('[data-invoice=M24005302]').first.click()
 assert 'The listed charges add up.' in page.locator('#detail').inner_text()
 assert 'What would complete the check?' in page.locator('#detail').inner_text()
 page.keyboard.press('Escape')
 with page.expect_download() as d:page.locator('[data-action=download-invoices]').click()
 d.value.save_as(str(ROOT/'invoices-export-human.csv'))
 page.locator('[data-nav=sources]').first.click()
 assert '11 of 11' in page.locator('#main').inner_text()
 page.locator('[data-nav=practice]').first.click()
 assert 'These numbers are made up' in page.locator('#main').inner_text()
 for v in ('$1,390.00','$610.00','$210.00'):assert v in page.locator('#main').inner_text()
 assert page.locator('.question-card').count()==8
 page.screenshot(path=str(SHOTS/'human-practice.png'),full_page=True)
 page.locator('[data-practice-case]').first.click()
 assert 'Records we compared' in page.locator('#detail').inner_text()
 assert '"source"' not in page.locator('#detail').inner_text() # raw JSON prohibited
 page.locator('[data-close]').click()
 with page.expect_download() as d:page.locator('[data-action=download-demo]').click()
 d.value.save_as(str(ROOT/'practice-export-human.csv'))
 page.locator('[data-nav=summary]').first.click()
 with page.expect_download() as d:page.locator('[data-action=download-summary]').click()
 d.value.save_as(str(ROOT/'invoice-review-summary.html'))
 report=(ROOT/'invoice-review-summary.html').read_text(encoding='utf-8')
 assert 'All 7 invoice totals match' in report
 assert 'no confirmed billing mistake' in report
 assert 'Was the higher retesting charge approved?' in report
 assert not failures,failures
 print('Desktop: PASS. Four review questions, seven invoices, human reports, practice data, persistence, no page errors.')
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 mobile_errors=[];mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
 mobile.set_content(P.read_text(encoding="utf-8"),wait_until="load");mobile.wait_for_timeout(100)
 mobile.screenshot(path=str(SHOTS/'human-mobile.png'),full_page=True)
 assert mobile.locator('h1').inner_text()=='Invoice review'
 mobile.locator('[data-nav=questions]').first.click()
 mobile.screenshot(path=str(SHOTS/'human-mobile-questions.png'),full_page=True)
 mobile.locator('[data-question=PLYMOUTH-CONTRACT]').click()
 assert mobile.locator('#detail').is_visible()
 mobile.locator('[data-close]').click()
 overflow=mobile.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
 assert overflow<=2,('mobile horizontal overflow',overflow)
 assert not mobile_errors,mobile_errors
 print('Mobile: PASS. No horizontal document overflow, drawer opens and closes, no page errors.')
 browser.close()

server.shutdown()
