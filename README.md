# COSCUP 2026 Session Feedback Selector

這是一個可直接部署到 GitHub Pages 的純前端網頁。它會讀取 COSCUP 2026 OPass 議程資料，依網址傳入的 session ID 顯示：

- 目前議程
- 同一天、同一場地、開始時間最接近的上一場議程

點選議程後，網頁會開啟 COSCUP 2026 議程回饋 Google 表單，並自動帶入議程名稱與議程軌名稱。

## 網址格式

主要格式：

```text
https://coscup-session-select.ospo.tw/?session=SESSION_ID
```

為方便既有系統串接，也支援 `?id=`、`?session_id=`、`?sessionId=` 與 `#SESSION_ID`。

## 資料與表單設定

- OPass JSON：`https://coscup.org/2026/api/opass.json`
- Google 表單：COSCUP 2026 議程回饋表單
- 議程名稱欄位：`entry.1246257474`
- 議程軌名稱欄位：`entry.2060906697`

如果 Google 表單的前兩題被刪除後重新建立，欄位 ID 會改變，請同步更新 `schedule.js` 中的 `FORM_CONFIG`。

## 本機測試

這個網站不需要建置流程，可用任一靜態檔案伺服器預覽，例如：

```bash
python3 -m http.server 8080
```

另可執行資料解析與預填網址測試：

```bash
npm test
```

## 部署至 GitHub Pages

1. 建立 GitHub repository，將本目錄所有檔案放在 repository 根目錄。
2. 到 repository 的 **Settings → Pages**。
3. 在 **Build and deployment** 選擇 **Deploy from a branch**。
4. 選擇 `main` branch 與 `/ (root)`，然後儲存。
5. 在 `ospo.tw` DNS 新增：

   ```text
   Type:  CNAME
   Name:  coscup-session-select
   Value: <GitHub 帳號或組織名稱>.github.io
   ```

repository 內已包含 `CNAME`，內容為 `coscup-session-select.ospo.tw`。DNS 生效後，可在 GitHub Pages 設定中啟用 **Enforce HTTPS**。

## 判定「上一場議程」的方式

程式會在相同的臺北日期與場地中，尋找開始時間早於目前議程、且時間最接近的一場。若 OPass 資料缺少時間，則退回依資料中的排列順序判定。
