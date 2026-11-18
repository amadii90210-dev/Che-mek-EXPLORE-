import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import './style.css';
import { startGame } from './game/game.js';

startGame(document.querySelector('#viewport')).catch(error => {
  console.error('Nie udało się uruchomić gry', error);
  document.querySelector('#hud').hidden = true;
  document.querySelector('#loading-message').textContent = 'Nie udało się wczytać sceny. Upewnij się, że przeglądarka obsługuje WebGL 2, i odśwież stronę.';
});
