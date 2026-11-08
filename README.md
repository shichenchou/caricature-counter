# 似顏繪點名

iPhone / iPad 離線用的似顏繪現場點名工具：從相簿選照片（一張一組）、AI 預估人數、正取/備取自動計算、勾選多組 AirDrop 傳原圖給老師。

## 部署到 GitHub Pages（只做一次）

1. 在 GitHub 建一個**名字是亂碼**的 public repo（例：`cc-7f3k9q2m`），網址不要外流。
2. 推上去：`git remote add origin git@github.com:<帳號>/cc-7f3k9q2m.git && git push -u origin main`
3. repo → Settings → Pages → Source 選 `main` / root。
4. 網址：`https://<帳號>.github.io/cc-7f3k9q2m/`

資料（照片、名單）只存在手機裡，網址被別人打開也只會看到空的 App。

注意：GitHub Pages 上同一個帳號的所有 repo 共用 `<帳號>.github.io` 這個網域。所以這個帳號底下的其他 Pages 不要放第三方 script；要完全隔開就用自訂網域。

## iPhone 安裝（有網路時做）

1. 用 Safari 打開網址，等 10 秒讓 AI 模型（約 18MB）下載完。
2. 分享 →「加入主畫面」。
3. **之後一律從主畫面圖示開**：主畫面 App 和 Safari 分頁的資料不互通。
4. 開飛航模式，從主畫面打開，確認畫面正常、新增照片時有出現「AI：N」。

## 現場流程

1. 「＋場次」建立（名稱、目標人數、是否開放備取）。
2. 用 iPhone 相機拍客人（拍幾張都行，照片自動在相簿）。
3. App 按「＋ 新增（從相簿選）」，每組挑一張，可一次選多張。
4. 確認畫面調整人數 → 加入。
5. 勾選要傳的組 → 「🚀 傳給老師」→ 選 AirDrop → 老師的裝置。分享成功就自動標「已傳」；不準時可在卡片按「標為已傳 / 改回未傳」。
6. 設定 → 匯出名單 CSV。

## 名額規則

- 每個被畫的對象算 1（大人、小孩、嬰兒、寵物）。
- 一組加入前還沒滿額 → 整組正取（可以到 41/40）。
- 開放備取時，滿額後的組變備取，另外編號；刪除或改人數會即時重算，備取自動遞補。

## 更新程式後

改任何檔案都要把 `sw.js` 的 `CACHE = 'cc-vN'` 加 1，推上去後在 iPhone 有網路時開兩次 App 才會換新版。

## 開發

```bash
npm install
npm test                                   # 單元測試
python3 -m http.server 8765                # 本機開 http://localhost:8765
python3 tests/smoke_playwright.py          # 瀏覽器 smoke test（需要先 pip install playwright）
./scripts/fetch-vendor.sh                  # 重新下載 TF.js 與模型
```
