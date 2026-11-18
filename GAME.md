# Che-Mek Explore — Dolina Brzeziny

Samodzielny, grywalny prototyp eksploracji w Three.js/WebGL 2. Bazowy commit zawierał tylko niezwiązany skrypt WorkHub w `README.md` i przykładowy workflow. Nie zawierał źródeł gry ani zdjęć z opisu. To nowa scena i nowe sterowanie, a nie modyfikacja brakującej gry.

## Uruchomienie

Wymagania: Node.js 20.19+ lub 22.12+, przeglądarka z WebGL 2.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Wynik produkcyjny jest w `dist/` i może być podany przez zwykły serwer plików statycznych. Gra nie potrzebuje API, kluczy ani usług zewnętrznych.

### Sterowanie

| Akcja | Klawiatura i mysz | Telefon |
|---|---|---|
| Ruch, kierowanie i jazda wstecz | `WASD` lub strzałki | Lewy joystick |
| Obrót kamery | Przeciągnięcie po scenie | Przeciągnięcie po scenie |
| Przybliżenie | Rolka myszy | — |
| Sprint / hamulec | `Shift` pieszo / `Spacja` w pojeździe | Przytrzymanie przycisku Sprint / Hamuj |
| Wejście / wyjście z pojazdu | `E` lub przycisk kontekstowy | Wsiądź / Wysiądź |
| Mapa / pomoc | `M` / `H` lub górne przyciski | Górne przyciski |

Podejdź do pojazdu, aby wsiąść. Aby wysiąść, najpierw go zatrzymaj. Prędkość i położenie w HUD-zie wynikają z aktualnego stanu gry. Mapa i pomoc wstrzymują symulację.

### Gdzie zmieniać scenę

- `src/game/layout.js` — kształt i wysokość terenu, linia brzegu, trakt, pozycje budynków i pojazdów. Tę samą geometrię opisową wykorzystują renderer, mapa i kolizje.
- `src/game/landscape.js`, `flora.js` — teren z warstwami tekstur, niebo, mgła, odbicie wody, drzewa, trawy i detale brzegu. Rośliny są instancjonowane, teren jest dzielony przestrzennie, a odbicie i mapa cieni nie są odświeżane w każdej klatce.
- `src/game/survivor.js`, `vehicles.js`, `buildings.js` — proceduralne modele i materiały PBR, animacja kończyn, kół, pedałów i skrętu.
- `src/game/simulation.js`, `game.js`, `input.js` — ruch, kolizje, pojazdy, kamera śledząca, światło oraz obsługa wejścia. Telefon korzysta z niższej gęstości detali, rozdzielczości cieni i limitu pikseli renderowania.
- `index.html`, `src/style.css`, `src/game/hud.js` — polski, responsywny HUD, kompas i mapy.

Tekstury w `public/terrain/` zostały wygenerowane na potrzeby tego prototypu i zoptymalizowane do WebP. Modele, układ doliny, oznaczenia i interfejs nie wykorzystują zasobów PUBG. Inter i Barlow Condensed są dystrybuowane pod licencją SIL Open Font License przez paczki Fontsource.
