# CIPHER BVG — Website Pairing Guide

## WhatsApp number ko link karna

1. Website par **Register** karein ya account mein **Login** karein.
2. **Pair** page kholein. Pakistan ke liye `+92` default hota hai; doosre mulk ke liye apna country calling code set karein.
3. Number enter karke **Generate code** dabayein. Yeh WhatsApp linked-device code hai, SMS OTP nahi.
4. Screen par code `CIPHER12` dikhega. **Copy code** dabayein.
5. WhatsApp mein **Settings → Linked devices → Link with phone number** kholein aur code enter karein.
6. Pair page open rakhein jab tak status **connected** na ho.

## Telegram bot

Telegram se WhatsApp number pair karna, session file import karna, ya connected numbers dekhna/remove karna band hai. Purane pairing commands aur buttons ab website-only notice dete hain. Pairing ke liye sirf website ka **Pair** page use karein.

Telegram bot ke baqi owner commands ke liye `/help` dekhein. Railway par Telegram bot chahiye to `BOT_TOKEN` aur owner ka numeric `OWNER_ID` environment variable set karein.

## Railway par zaroori storage

Railway par `/app/Database` ke liye persistent Volume mount karein. Baileys ko WhatsApp link ko restart ke baad chaloo rakhne ke liye server par private auth state rakhni padti hai. User-facing session list/import controls hata diye gaye hain, lekin internal auth folder ko delete karne se WhatsApp link toot jayega aur number dobara pair karna hoga.

Bot token, account password, ya WhatsApp auth files/screenshots public logs mein share na karein.
