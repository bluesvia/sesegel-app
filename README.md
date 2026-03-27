# SeseGel

Electron tabanli SeseGel masaustu istemcisi. Uygulama guncellemeleri GitHub Releases uzerinden dagitilir ve paketli istemci acilisinda otomatik kontrol edilir.

## Gelistirme

```bash
npm install
npm start
```

## Yerel paket alma

```bash
npm run build
```

## Yeni surum yayinlama

1. Kod degisikliklerini commit et.
2. Surumu artir:
   - `npm run release:patch`
   - `npm run release:minor`
   - `npm run release:major`
3. GitHub'a gonder:

```bash
git push origin main --follow-tags
```

`v*.*.*` etiketi GitHub'a gittiginde `.github/workflows/release.yml` calisir, Windows paketi uretir ve GitHub Release olarak yayinlar. Paketli SeseGel istemcileri yeni release'i acilista algilar ve kullaniciya guncelleme penceresi gosterir.