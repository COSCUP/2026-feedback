# COSCUP 2026 Session Feedback Selector

這是一個可直接部署到 GitHub Pages 的純前端網頁。它會讀取 COSCUP 2026 OPass 議程資料，依網址傳入的 session ID 顯示：

- 目前議程
- 同一天、同一場地、開始時間最接近的上一場議程

點選議程後，網頁會開啟 COSCUP 2026 議程回饋 Google 表單，並自動帶入議程名稱與議程軌名稱。

頁面會同時呈現正體中文、English、日本語、한국어，並在每張議程卡顯示講者，方便填答前再次核對。視覺沿用 COSCUP 2026 參與者大調查的主視覺與配色。

## 網址格式

主要格式：

```text
https://coscup.org/2026-feedback/?session=SESSION_ID
```

為方便既有系統串接，也支援 `?id=`、`?session_id=`、`?sessionId=` 與 `#SESSION_ID`。

## 資料與表單設定

- OPass JSON：`https://coscup.org/2026/api/opass.json`
- 議程軌：從 `https://coscup.org/2026/session/<SESSION_ID>/` 的官方議程詳情頁核對
- Google 表單：COSCUP 2026 議程回饋表單
- 議程名稱欄位：`entry.1246257474`
- 議程軌名稱欄位：`entry.2060906697`

如果 Google 表單的前兩題被刪除後重新建立，欄位 ID 會改變，請同步更新 `schedule.js` 中的 `FORM_CONFIG`。

注意：OPass JSON 的 `tags` 是語言與難度，不是議程軌。程式不會再用第一個 tag 預填議程軌；若官方議程詳情頁暫時無法讀取，議程軌欄位會保留空白，避免誤填語言。

## 本機測試

這個網站不需要建置流程，可用任一靜態檔案伺服器預覽，例如：

```bash
python3 -m http.server 8080
```

另可執行資料解析與預填網址測試：

```bash
npm test
```

## 部署

對外頁面位於 `https://coscup.org/2026-feedback/`。部署時將 repository 根目錄的靜態檔案發布到這個路徑即可；頁面不需要建置步驟。

## 判定「上一場議程」的方式

程式會在相同的臺北日期與場地中，尋找開始時間早於目前議程、且時間最接近的一場。若 OPass 資料缺少時間，則退回依資料中的排列順序判定。
