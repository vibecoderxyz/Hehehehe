# Deploy the Supashort website (Vercel par, 5 minute)

Ye folder **poori website** hai — do single HTML files, koi build nahi, koi server nahi.

```
deploy/
  index.html     <- Control Center (main page)
  gateway.html   <- Visitor gateway (visitor isi ko kholta hai)
  DEPLOY.md      <- ye guide (deploy karne ke liye zaroori nahi)
```

Dono files **self-contained** hain: saari CSS ek `<style>` ke andar, saara JS ek `<script>` ke andar.
`index.html` se `gateway.html` ka link **relative** hai (line 1850: `location.href.replace(...) + "gateway.html?c="`),
is liye kisi bhi domain par chal jayega. Koi hard-coded URL nahi hai.

---

## Zaroori: pehle ye do files apne phone me save karein

`index.html` aur `gateway.html` ko apne Downloads me rakhein. Iske baad neeche
**Tareeqa A (phone ke liye behtareen)** follow karein.

---

## Tareeqa A — GitHub se (phone par sab se reliable, aage auto-deploy bhi)

Ye tareeqa Android par sab se asaan hai kyunke GitHub ka uploader aap ke phone ka
file-picker use karta hai (ek ek file select kar sakte hain).

1. `github.com` par free account banayein (ya sign in).
2. **New repository** → naam dein (jaise `supashort`) → Create. (Private bhi chalega.)
3. Repo khulne par **Add file → Upload files** dabayein.
4. Apne phone se **dono files** select karein: `index.html` aur `gateway.html`.
   (Sirf ye do, `DEPLOY.md` ki zaroorat nahi — magar rakh bhi sakte hain.)
5. Neeche **Commit changes** dabayein.
6. Ab `vercel.com/new` kholein → **Continue with GitHub** → apna `supashort` repo chunein → **Import**.
7. Settings screen par:
   - **Framework Preset:** `Other` (ya `No Framework`)
   - **Build Command:** khali chhor dein
   - **Output Directory:** khali chhor dein
   - **Root Directory:** waisa hi (`.`)
8. **Deploy** dabayein. ~20 second me live URL milega, jaise `https://supashort.vercel.app`.

Bonus: iske baad jab bhi GitHub me file badlein, Vercel **khud** naya deploy kar dega.

---

## Tareeqa B — Vercel Drop (sab se tez, sirf ek dafa)

`vercel.com/drop` par file/folder/`.zip` drag kar ke deploy hota hai.

- **Computer par:** `deploy` folder ko seedha drop kar dein.
- **Phone par:** drag-drop mushkil hai. Pehle `index.html` + `gateway.html` ko ek `.zip` banayein
  (koi bhi "Zip" app / Files app se), phir us page par **"choose a file or folder to upload"**
  se zip select karein.

Fir: team chunein + project name likhein → **Deploy**.

> **Ahem:** folder me `index.html` **root** par maujood hai, is liye Vercel khud `/` par wohi
> page dikhayega — "Choose your homepage" pooch **nahi** aana chahiye. Agar aa jaye, to `index.html` chunein.

---

## Deploy ke baad — pehla test (ye aap khud karein)

Main is device par **browser / Node / build tool nahi chala sakta**, is liye ye test **aap** karna.

1. Live URL kholein → **Control Center** dikhna chahiye.
2. Ek URL paste karein + chhota alias (jaise `hello`) → **Shorten** dabayein.
3. Result box me short link aayega, kuch aisa:
   `https://supashort.vercel.app/gateway.html?c=hello`
4. Us link par click karein → **gateway page** khulega (`Generating 3D Liquid Link...`).
5. Gateway par camera/GPS allow karein → wapas Control Center ke **Stats** tab me visit dikhna chahiye.

Agar ye 5 step chal gaye → **poori website theek chal rahi hai**.

---

## Ek zaroori baat (data kahan jata hai)

Ye website **koi server use nahi karti**. Saara data (links, visitors, captures) **usi browser ki
`localStorage`** me rehta hai jo isay kholta hai — key `supashort.standalone.v1`
(dono pages **ek hi key** use karte hain).

| Kya | Kahan save hota hai |
| --- | --- |
| Aap ke banaye links | **Aap ke** browser me |
| Gateway par aane wale visitor ka data | **Us visitor ke** browser me |

Yani "Live Visitor Telemetry" ki **poori UI** aap dekhenge — magar sirf un visits ki jo **usi
browser** me hue. Kisi doosre insaan ka visit **aap ke paas nahi aayega**.

Ye ek **privacy feature** hai (README "Privacy model": captures never leave your browser) — galat
nahi, magar ise "central database" na samjhein. Agar aap ko **doosron ke visits apne paas** chahiye
(to "asli" analytics), to server + database lagana parega (`src/` wala Next.js code + Postgres/KV).
Wo alag kaam hai — bata den to kar dunga.

> `file://` se kholne par browser do pages ko alag "origin" samajh sakta hai aur `localStorage`
> share na ho. Vercel (https) par ye masla **nahi** aata — is liye deploy karna behtar hai.

---

## Kya kya chalega (Vercel static par) — poori list

Short link banana, custom alias, password protection, social gate (icon + title + button),
camera capture, GPS capture, expiry date, live analytics (GPU / battery / cores / screen /
network / device-model chips), visitor photo lightbox, media studio (webcam + image converter),
coupons (`VIP-2026`, `PRO-30D`, `PRO-7D`), free/premium plan + quota bar, "Direct Download HTML"
export, Quick Actions Hub.

Sab **client-side** hai, is liye static host par sab kaam karta hai.

---

## Troubleshooting

- **`/` par 404** → `index.html` folder ke **root** me hona chahiye (kisi subfolder me nahi).
- **Gateway 404** → `gateway.html` usi folder me hona chahiye jahan `index.html` hai.
- **Vercel "Next.js" build karne lagta hai** → aap ne galti se `src/` wala code upload kar diya.
  Sirf do HTML files upload karein, ya Framework Preset `Other` chunein.
- **Fonts purane lag rahe** → Google Fonts ke liye internet chahiye; offline par system font
  dikhega, website phir bhi chalti rahegi.
- **Camera/GPS kaam nahi kar raha** → camera/GPS **sirf https** par (permission ke baad) chalta hai.
  Vercel ka https sahi hai; `http://` par browser camera block kar deta hai.
