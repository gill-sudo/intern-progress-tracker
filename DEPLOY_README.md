# 部署指南｜僑外生工讀生實習進度追蹤

架構：**GitHub Pages（前端網頁）→ Cloudflare Worker（安全代理）→ Notion（資料庫）**

- 資料庫已經建好（Notion 工作區「gill的空間」，帳號 gill@wport.me）：https://app.notion.com/p/e2e1d3775d2041d586d2d6b8864cf73a
- 兩位實習生目前的代碼（尚未知道真實姓名前的暫用代碼，之後可以自己在 Notion 改）：
  - 實習生 A：`SIGXE3`
  - 實習生 B：`IZT2SN`

程式碼已經放在 GitHub：https://github.com/gill-sudo/intern-progress-tracker

完成部署後，兩人的專屬連結會是：
```
https://gill-sudo.github.io/intern-progress-tracker/?user=SIGXE3
https://gill-sudo.github.io/intern-progress-tracker/?user=IZT2SN
```

---

## 第一步：建立 Notion 整合（Integration），取得 API 金鑰

**務必用 gill@wport.me 登入 Notion 再做這一步。** integration 綁在工作區層級，用別的帳號建的無法存取「gill的空間」裡的資料庫。

1. 前往 https://www.notion.so/my-integrations
2. 點「+ New integration」，隨便取名（例如 `intern-tracker`），關聯到的 workspace 選「gill的空間」
3. 建立後，複製「Internal Integration Secret」，格式類似 `secret_xxxxxxxxxxxx`（這組是敏感資訊，不要放進程式碼或公開分享）
4. 打開「實習進度資料庫」（連結見上方），點右上角「⋯」→「Connections」（連結）→ 把剛剛建立的 integration 加進去。**這一步很重要，沒加的話 API 會抓不到資料。**

## 第二步：部署 Cloudflare Worker（安全代理）

你會拿到兩個檔案（在 `notion-proxy-worker/` 資料夾）：`worker.js`、`wrangler.toml`。

1. 安裝 wrangler（Cloudflare 的 CLI 工具，需要先有 Node.js）：
   ```bash
   npm install -g wrangler
   ```
2. 登入 Cloudflare（沒有帳號的話，指令會引導你免費註冊）：
   ```bash
   wrangler login
   ```
3. 進入 `notion-proxy-worker/` 資料夾，設定 Notion 密鑰（**不要**寫進 wrangler.toml，用這個指令加密儲存）：
   ```bash
   cd notion-proxy-worker
   wrangler secret put NOTION_TOKEN
   ```
   貼上第一步拿到的 `secret_xxxxxxxxxxxx`，按 Enter。
4. `wrangler.toml` 裡的 `NOTION_DATABASE_ID` 和 `ALLOWED_ORIGIN`（已填 `https://gill-sudo.github.io`）都設定好了，這個檔案不用動。
5. 部署：
   ```bash
   wrangler deploy
   ```
   完成後終端機會顯示一個網址，長得像：
   ```
   https://intern-progress-proxy.yourname.workers.dev
   ```
   **記下這個網址**，下一步要用。

## 第三步：把網址填進前端網頁

打開 `docs/index.html`，找到這一行（在 `<script>` 區塊最上面）：
```js
var API_BASE = "https://intern-progress-proxy.YOUR_SUBDOMAIN.workers.dev";
```
把它換成你上一步拿到的實際 Worker 網址，存檔。

## 第四步：開啟 GitHub Pages

Repo 已經建好並推上去了（https://github.com/gill-sudo/intern-progress-tracker），目前是 **private**。

1. GitHub Pages 在免費方案不支援 private repo，所以要先轉成 public：
   ```bash
   gh repo edit gill-sudo/intern-progress-tracker \
     --visibility public --accept-visibility-change-consequences
   ```
   轉 public 後，Notion 資料庫 ID 會變成公開可見。這不是密鑰，沒有 Notion token 讀不到任何資料，但要知道有這件事。
2. 到 repo 的 Settings → Pages，Source 選 `main` 分支、目錄選 `/docs`，儲存
3. 等 1-2 分鐘，網址會是：`https://gill-sudo.github.io/intern-progress-tracker/`

## 第五步：把改好的 index.html 推上去

第三步改完 `API_BASE` 之後：
```bash
git add docs/index.html
git commit -m "set worker url"
git push
```
等 1-2 分鐘 GitHub Pages 會自動更新。

## 第六步：把專屬連結交給兩位實習生

```
實習生 A：https://gill-sudo.github.io/intern-progress-tracker/?user=SIGXE3
實習生 B：https://gill-sudo.github.io/intern-progress-tracker/?user=IZT2SN
```

你（主管）自己也可以打開這兩個連結，隨時查看進度；或直接打開 Notion 資料庫，用「使用者」欄位篩選查看，效果一樣，而且可以看到最原始的資料。

---

## 之後怎麼調整內容？

- **改實習生的顯示代碼／姓名**：去 Notion 資料庫，把「使用者」欄位的選項名稱從 `SIGXE3` 改成他們的真實英文名字即可；記得同時更新他們拿到的連結網址（`?user=` 後面也要換成一樣的名字）。
- **新增常見問題／新增一支 Reel**：直接在 Notion 資料庫裡新增一列，「使用者」填對應的人、「分類」填 `常見問題收集` 或 `Reels腳本規劃`、「順序」填下一個數字即可，網頁會自動抓到新項目，不需要改程式碼。
- **新增第三位實習生**：在 Notion「使用者」欄位新增一個新選項（例如一組新代碼），複製 27 列範本資料（分類/順序都比照現有兩人），再給他一個新的 `?user=新代碼` 連結。

## 常見問題排查

- **網頁一直顯示「無法連線到後端」**：檢查 `docs/index.html` 裡的 `API_BASE` 網址有沒有貼對；用瀏覽器直接打開 `你的Worker網址/items?user=SIGXE3` 看看有沒有回傳 JSON。
- **瀏覽器 Console 出現 CORS 錯誤**：`wrangler.toml` 的 `ALLOWED_ORIGIN` 要跟 GitHub Pages 網址完全一致（含 `https://`，不含結尾斜線），改完要重新 `wrangler deploy`。
- **Worker 回傳「Notion API error」**：通常是忘記在 Notion 資料庫的「Connections」把 integration 加進去（第一步的第 4 點）。
