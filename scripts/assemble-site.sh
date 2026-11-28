#!/usr/bin/env bash
# Собирает папку out/ для GitHub Pages из site/ и веб-версии (dist/).
#   scripts/assemble-site.sh            — APK и version.json берутся с текущего gh-pages (веб выкладывается сразу)
#   scripts/assemble-site.sh <apk>      — с новым APK и новым номером сборки (появится плашка обновления)
set -euo pipefail
APK="${1:-}"
rm -rf out && mkdir out
cp -r site/. out/
cp -r dist out/app
# SQLite в браузере требует cross-origin isolation, на Pages её даёт service worker.
# Safari не умеет COEP credentialless, поэтому всегда require-corp: все ресурсы у нас свои
mv out/coi-serviceworker.js out/app/
sed -i 's#<head>#<head><script>window.coi={coepCredentialless:function(){return false}}</script><script src="/Pero-gym-app/app/coi-serviceworker.js"></script>#' out/app/index.html
# Чтобы на iPhone веб-версию можно было поставить на экран «Домой» как приложение
mv out/pwa/* out/app/ && rmdir out/pwa
sed -i 's#</head>#<link rel="manifest" href="/Pero-gym-app/app/manifest.webmanifest"><link rel="apple-touch-icon" href="/Pero-gym-app/app/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Pero"><meta name="apple-mobile-web-app-status-bar-style" content="default"></head>#' out/app/index.html
cp out/app/index.html out/404.html
if [ -n "$APK" ]; then
  cp "$APK" out/pero.apk
  echo "{\"build\": ${GITHUB_RUN_NUMBER}, \"date\": \"$(date -u +%Y-%m-%d)\"}" > out/version.json
else
  git fetch -q --depth 1 origin gh-pages
  git show FETCH_HEAD:pero.apk > out/pero.apk
  git show FETCH_HEAD:version.json > out/version.json
fi
SIZE=$(du -m out/pero.apk | cut -f1)
BUILD="$(date -u +%d.%m.%Y) · ${GITHUB_SHA::7}"
sed -i "s/__APK_SIZE__/${SIZE} МБ/; s/__BUILD__/${BUILD}/" out/index.html
touch out/.nojekyll
