import re
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests' / 'screenshots'
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 8765
IMG = str(ROOT / 'icons' / 'icon-512.png')

server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=ROOT,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
csp = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                  geolocation={'latitude': 22.62, 'longitude': 120.31}, permissions=['geolocation'])
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept())
        page.on('console', lambda m: csp.append(m.text) if ('Content Security Policy' in m.text or 'Refused' in m.text) else None)
        page.goto(f'http://localhost:{PORT}/')
        expect(page.locator('#emptyState')).to_be_visible()
        page.screenshot(path=str(SHOTS / '1-empty.png'))

        page.click('#btnNewProject')
        expect(page.locator('input[name=projectTitle]')).to_have_value(re.compile(r'^\d+/\d+ 高雄$'))
        page.fill('input[name=projectTitle]', '11/8 高雄')
        page.fill('input[name=maxQuota]', '2')
        page.click('#projectDialog button[value=ok]')
        expect(page.locator('#projectSelect')).to_contain_text('11/8 高雄')

        page.set_input_files('#fileInput', [IMG, IMG])
        page.wait_for_selector('#confirmDialog[open]', timeout=90000)
        expect(page.locator('#confirmList')).not_to_contain_text('AI：')
        expect(page.locator('#aiNote')).to_contain_text('備註')
        expect(page.locator('#btnSaveBatch')).to_be_visible()
        page.click('#btnSaveBatch')
        expect(page.locator('#toast')).to_contain_text(re.compile('不支援分享檔案|存相簿失敗'))
        page.locator('#confirmList li').first.locator('button[data-d="1"]').click()
        page.screenshot(path=str(SHOTS / '2-confirm.png'))
        page.locator('#confirmList li .thumb').first.click()
        expect(page.locator('#previewDialog[open]')).to_be_visible()
        page.screenshot(path=str(SHOTS / '2b-preview.png'))
        page.click('#previewDialog button[value=close]')
        expect(page.locator('#previewDialog')).not_to_be_visible()
        expect(page.locator('#confirmDialog[open]')).to_be_visible()
        page.click('#confirmDialog button[value=ok]')
        expect(page.locator('#regularList .card')).to_have_count(2)
        expect(page.locator('#statusBar')).to_contain_text('3 人')
        expect(page.locator('#statusBar')).to_contain_text('彈性超額中')
        expect(page.locator('#regularList .card').first).to_contain_text('相簿未同步')
        expect(page.locator('#selectionBar')).to_be_hidden()
        page.locator('#regularList .card .thumb').first.click()
        expect(page.locator('#previewDialog[open]')).to_be_visible()
        page.screenshot(path=str(SHOTS / '9-card-preview.png'))
        page.click('#previewDialog button[value=close]')
        expect(page.locator('#previewDialog')).not_to_be_visible()
        page.screenshot(path=str(SHOTS / '3-over.png'))

        page.click('#btnSettings')
        page.check('input[name=allowWaitingList]')
        page.click('#projectDialog button[value=ok]')
        expect(page.locator('#waitingList .card')).to_have_count(1)
        expect(page.locator('#waitingList .card .tag')).to_contain_text('備取第 1 位')
        page.screenshot(path=str(SHOTS / '4-waiting.png'))

        page.locator('#regularList .card').first.locator('button[data-act=dec]').click()
        expect(page.locator('#regularList .card')).to_have_count(2)
        expect(page.locator('#waitingList .card')).to_have_count(0)

        page.locator('#regularList .card').first.locator('button[data-act=toggleSent]').click()
        expect(page.locator('#statusBar')).to_contain_text('1 張')

        page.locator('#regularList .card .pick-box').nth(1).check()
        expect(page.locator('#selectionBar')).to_be_visible()
        expect(page.locator('#selectionBar button')).to_have_count(3)
        expect(page.locator('#btnSendSelected')).to_have_text('🚀 AirDrop（1）')
        page.click('#btnSendSelected')
        expect(page.locator('#toast')).to_contain_text(re.compile('再按一次傳送|不支援分享檔案|分享失敗'))
        page.screenshot(path=str(SHOTS / '5-sent.png'))

        page.reload()
        expect(page.locator('#regularList .card')).to_have_count(2)

        page.set_input_files('#fileInput', [IMG, IMG, IMG])
        page.wait_for_selector('#confirmDialog[open]', timeout=90000)
        expect(page.locator('#confirmList li')).to_have_count(3)
        page.locator('#confirmList li').nth(2).locator('.btn-remove').click()
        expect(page.locator('#confirmList li')).to_have_count(2)
        page.screenshot(path=str(SHOTS / '6-confirm-remove.png'))
        page.click('#confirmDialog button[value=ok]')
        expect(page.locator('#main .card')).to_have_count(4)
        expect(page.locator('#toast')).to_contain_text('已加入 2 組')

        page.reload()
        expect(page.locator('#main .card')).to_have_count(4)
        page.locator('#main .card .pick-box').nth(0).check()
        page.locator('#main .card .pick-box').nth(1).check()
        expect(page.locator('#btnDeleteSelected')).to_have_text('🗑 刪除（2）')
        page.click('#btnDeleteSelected')
        expect(page.locator('#main .card')).to_have_count(2)
        expect(page.locator('#btnDeleteSelected')).to_be_disabled()
        page.screenshot(path=str(SHOTS / '7-multi-delete.png'))

        page.click('#btnDeleteProject')
        expect(page.locator('#emptyState')).to_be_visible()
        expect(page.locator('#btnDeleteProject')).to_be_disabled()
        page.screenshot(path=str(SHOTS / '8-project-deleted.png'))
        browser.close()
finally:
    server.terminate()

if csp:
    print('CSP VIOLATIONS:', csp)
    sys.exit(1)
if errors:
    print('PAGE ERRORS:', errors)
    sys.exit(1)
print('SMOKE OK, screenshots in', SHOTS)
