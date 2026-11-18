# Nákupný jedálniček

Webová aplikácia na plánovanie jedál podľa rozpočtu: nákupný zoznam s cenami (Lidl, Kaufland, Tesco, Billa), recepty, výživové hodnoty a aktuálne zľavy.
Funguje offline a dá sa nainštalovať do mobilu („Pridať na plochu“).

**Aplikácia:** https://samkowww.github.io/jedalnicek/

## Ako fungujú zľavy
- Pomocník `scraper/scrape.mjs` beží automaticky cez GitHub Actions (pondelok a štvrtok ráno) a zapisuje akciové ceny do `zlavy.json`.
- Aplikácia si pri otvorení stiahne aktuálny `zlavy.json` a pri skladaní jedálnička uprednostní suroviny v akcii.
- Ručné spustenie: záložka **Actions → Aktualizácia zliav → Run workflow**.

## Súbory
- `index.html` – celá aplikácia (dáta, recepty, logika, vzhľad)
- `manifest.webmanifest`, `sw.js`, ikony – inštalácia do mobilu a offline režim
- `zlavy.json` – aktuálne zľavy (generuje pomocník)
- `scraper/` – pomocník: `scrape.mjs` (zber), `mapping.mjs` (priradenie produktov k surovinám), `lib.mjs`, `test.mjs`
