# CIPHER BVG Telegram Bot — Asaan Roman Urdu Guide

## 1. Bot shuru karna

Telegram mein apne bot ki chat khol kar `/start` bhejein. Main screen par **WhatsApp Connector**, **How to use this bot**, aur aapke access ke mutabiq shortcuts nazar aayenge. Kisi command ka detail chahiye ho to `/help` bhejein.

Yeh Telegram bot sirf configured `OWNER_ID` wale owner ke **private chat** mein kaam karta hai. Kisi aur Telegram user ya group ko bot jawab nahi dega. Website ka user pairing feature is restriction se alag hai.

Is setup mein Telegram bot par sirf configured owner ka private chat allowed hai. Kisi aur user ko bot jaan-boojh kar koi jawab nahi deta; unhein bot access dene ki zaroorat nahi.

## 2. WhatsApp number pair karna — buttons wala tareeqa

1. `/start` → **WhatsApp Connector** → **Add WhatsApp number** dabayein.
2. Number country code ke saath bhejein. Pakistan ke liye misal: `+92 300 1234567`. `0300...` local format bhi bhej sakte hain.
3. Bot WhatsApp pairing code dikhayega. Yeh **SMS OTP nahi** hai.
4. Phone par WhatsApp kholein: **Settings → Linked Devices → Link a device → Link with phone number instead**.
5. Bot se mila code WhatsApp mein enter karein. Page/chat khula rakhein jab tak session connected na ho.

Pairing code button dabane ke baad bhi na aaye, to number dobara country code ke saath check karein aur Railway deployment logs dekhein. Browser refresh se server ki dependency install nahi hoti. Latest project, `package.json` aur `package-lock.json` deploy karke naya build chalana zaroori hai. Build mein Baileys `6.7.22` install hona chahiye.

## 3. Sessions dekhna, hatana, ya import karna — owner ke liye

- **View / remove connected sessions:** Connector menu → **View / remove connected sessions**. Active numbers list honge. Kisi number ko dabayein; agle message mein naam/number verify karein aur **Yes, remove** tabhi dabayein jab sahi session ho. Removal se connection band hota hai aur server par saved WhatsApp session delete hota hai.
- **Import saved session file:** Connector menu → **Import saved session file**. Uske baad complete Baileys session `.zip`, `.tar`, `.tar.gz`, `.tgz`, ya supported `.json` file isi Telegram chat mein bhejein. `.zip` mein `creds.json` ke saath us session ki key files bhi honi chahiye. Sirf `creds.json` akela aam tor par complete session nahi hota.
- Purana command-based tareeqa bhi hai: session archive par reply karke `/addsender` bhejein.
- `/listbot` active senders dikhata hai. `/delbot NUMBER` sender remove karta hai; `/delsesi NUMBER` saved session delete karta hai. Number international format mein dena behtar hai.

Session files account access ke barabar hoti hain. Unhein sirf apne trusted bot ko bhejein; public group mein upload na karein.

## 4. User keys — owner ke liye

- `/ckey username,30d,,Member` — 30 din ki Member key banaye. Bot key/UID details DM karne ki koshish karega; is liye bot ke saath private chat pehle `/start` karein.
- `/ckey username,12h,MYKEY,Reseller` — 12 ghante ki custom key aur role ki misaal.
- `/mykeys` — apni banayi hui keys dekhein.
- `/listkey` — tamam keys (owner only).
- `/delkey username` — us username ki key delete karein.

Durations ke liye `7d`, `30d`, ya `12h` jaisa format use karein. Role names: `Owner`, `Admin`, `Reseller`, `Moderator`, `Member`; Owner/Admin role sirf owner assign kar sakta hai.

## 5. Access aur roles — owner ke liye

- `/addacces TELEGRAM_ID` — full bot access.
- `/addacces TELEGRAM_ID pair` — sirf WhatsApp pairing ki permission.
- `/delacces TELEGRAM_ID` — access hataayein.
- `/addreseller ID` / `/delreseller ID` — reseller add/remove.
- `/addpt ID` / `/delpt ID` — PT role add/remove.
- `/addmod ID` / `/delmod ID` — moderator add/remove.
- `/addowner ID` / `/delowner ID` — owner add/remove. Is command ko bohat ehtiyat se use karein.

`ID` ki jagah Telegram ka numeric user ID likhein, username nahi. Pehle ID verify karein.

Yeh role records app ke baqi access/configuration ke liye rehte hain. Is Telegram bot ka owner-only private-chat lock phir bhi kisi doosre Telegram user ko bot chalane nahi deta.

## 6. Premium, CMD aur backup

- `/premium UID monthly 30` — account UID ko 30 din premium karein; `/premium UID lifetime` lifetime activation ki misaal.
- `/premium-check UID` — premium status dekhein.
- `/premium-off UID` — premium band karein (owner).
- `/commands` — command tier ka interactive panel. `/cmdlist`, `/cmdfree`, `/cmdpremium` lists hain. `/cmdset command free` se tier badla ja sakta hai, misaal `/cmdset delay premium`.
- `/backup` — owner ke liye database backup status aur one-tap backup.

Har action ke permissions alag ho sakte hain; bot ka “Access denied” jawab batata hai ke account ko us action ki ijazat nahi.

## 7. Website se number pair karna

Haan, user website se pair kar sakta hai: website account mein login karein, **PAIR** page kholein, country code aur number daalein, phir **Generate Code** dabayein. Code WhatsApp ke **Settings → Linked Devices → Link with phone number** mein daalein. Yeh Telegram bot button se alag web flow hai; Telegram bot ko owner-only rakhne se website users ke pairing endpoints band nahi hote.

## 8. Telegram bot se alag: Railway deployment check

Screenshot mein jo error tha — `Cannot find module '@whiskeysockets/baileys'` — woh page ka button error nahi, server deployment ka missing dependency error tha. Is project mein ab official Baileys `6.7.22` pinned hai aur lockfile shamil hai.

1. Latest project files GitHub/Railway tak push/deploy karein. Purane ZIP/commit par service na chal rahi ho, yeh confirm karein.
2. Railway par naya build/redeploy chalayein; build log mein `npm install` successful hona chahiye.
3. Runtime Node.js 20 ya naya ho.
4. App restart ke baad `/api/health` aur runtime logs check karein. `wa.js: Cannot find module` log ab nahi aana chahiye.
5. Uske baad website ke Pair page par number enter karke **Generate Code** dabayein.

Bot token, password ya WhatsApp session archive ko screenshots/public logs mein share na karein.
