"""比較舊（只 COCO-SSD）與新（COCO-SSD + BlazeFace）人數辨識準確度。

用法：python3 tests/eval_count.py <samples_dir> [chromium|webkit]
樣本檔名開頭的數字為正確人數（例：4_b.jpg）。樣本不進 repo。
"""
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in ('chromium', 'webkit')):
    sys.exit('用法：python3 tests/eval_count.py <samples_dir> [chromium|webkit]')
# webkit 最接近 iPhone Safari；chromium headless 是 cpu backend，框的結果會不同
BROWSER = sys.argv[2] if len(sys.argv) == 3 else 'chromium'
SAMPLES = Path(sys.argv[1]).resolve()
files = sorted(f for f in SAMPLES.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg') and re.match(r'\d+', f.name))
if not files:
    sys.exit(f'{SAMPLES} 裡沒有檔名以數字開頭的 jpg')

with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    PORT = s.getsockname()[1]

# 和 js/image.js 的 drawScaled(img, 640) 相同
EVAL_JS = """
async (name) => {
  const { countSubjects, detectCount, loadModel, loadFaceModel } = await import('/js/detect.js');
  const img = new Image();
  img.src = '/__sample/' + encodeURIComponent(name);
  await img.decode();
  const scale = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const [coco, face] = await Promise.all([loadModel(), loadFaceModel()]);
  const oldCount = countSubjects(await coco.detect(canvas, 30, 0.5));
  const newCount = await detectCount(canvas);
  return { oldCount, newCount, faceModel: !!face, backend: tf.getBackend() };
}
"""

server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
rows = []
try:
    with sync_playwright() as p:
        browser = getattr(p, BROWSER).launch()
        # 擋掉 service worker，免得樣本請求繞過 page.route
        page = browser.new_context(service_workers='block').new_page()
        by_name = {f.name: f for f in files}

        def serve_sample(route):
            name = route.request.url.rsplit('/__sample/', 1)[1]
            f = by_name.get(unquote(name))
            if f:
                route.fulfill(path=str(f), content_type='image/jpeg')
            else:
                route.fulfill(status=404)

        # CSP connect-src 'self'：樣本要從同源路徑給
        page.route('**/__sample/*', serve_sample)
        page.goto(f'http://127.0.0.1:{PORT}/')
        for f in files:
            r = page.evaluate(EVAL_JS, f.name)
            if not r['faceModel']:
                sys.exit('臉部模型沒載入，無法比較')
            backend = r['backend']
            rows.append((f.name, int(re.match(r'\d+', f.name).group()), r['oldCount'], r['newCount']))
        browser.close()
finally:
    server.terminate()

print(f'{BROWSER} / tf backend: {backend}')
print(f'{"檔名":<20}{"正確":>6}{"舊":>6}{"新":>6}')
for name, truth, old, new in rows:
    print(f'{name:<20}{truth:>6}{old:>6}{new:>6}')
n = len(rows)
old_ok = sum(old == truth for _, truth, old, _ in rows)
new_ok = sum(new == truth for _, truth, _, new in rows)
print(f'舊方法完全正確 {old_ok}/{n}；新方法完全正確 {new_ok}/{n}')
