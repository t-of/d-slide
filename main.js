import * as L from './logic.js';

// localStorage はほかのアプリと共有される（同じ t-of.github.io のため）。
// キーは必ず 'kazukakushi.' で始める。
const STORE = 'kazukakushi.';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(STORE + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* 保存できなくても遊べる */ }
}

WebAppKit.init({ title: 'かずかくし', text: '数字の見えない 15 パズル。番号の 1 桁だけの白黒、正しい場所とのずれ、行と列の合計など、手がかりから番号を読み解いて元の並びに戻す。' });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ---- 設定と記録 ----

const settings = L.readSettings(load('settings', null));
const best = L.readBest(load('best', null));
const saveSettings = () => save('settings', settings);

// ---- 音（Web Audio で作る。ファイルは使わない） ----

// iPhone のマナーモードでも鳴らす（Safari 16.4 以降）。
// 'playback' にすると音楽アプリの曲が止まるので、アプリの音がオンのときだけにする。
function setAudioSession(soundOn) {
  try { if (navigator.audioSession) navigator.audioSession.type = soundOn ? 'playback' : 'auto'; } catch { /* 対応していない */ }
}
setAudioSession(settings.sound);

let actx = null;
function tone(freq, { dur = 0.12, type = 'sine', gain = 0.08, delay = 0 } = {}) {
  if (!settings.sound) return;
  try {
    setAudioSession(true);
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* 音が出せなくても遊べる */ }
}
const DIGIT_FREQ = { 8: 440, 4: 554, 2: 659, 1: 880 };   // 8 が低く 1 が高い
const sfx = {
  tap: () => tone(660, { dur: 0.05, type: 'triangle', gain: 0.04 }),
  slide: () => tone(196, { dur: 0.04, type: 'triangle', gain: 0.12 }),   // 木を軽くたたく
  nope: () => tone(110, { dur: 0.03, gain: 0.04 }),
  digit: (d) => tone(DIGIT_FREQ[d], { dur: 0.04, type: 'square', gain: 0.025 }),
  match: () => [988, 1319].forEach((f, i) => tone(f, { dur: 0.1, gain: 0.04, delay: 0.05 + i * 0.08 })),
  correct: () => tone(1568, { dur: 0.08, gain: 0.035, delay: 0.05 }),
  clear: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.4, type: 'triangle', gain: 0.07, delay: i * 0.22 })),
  record: () => tone(1568, { dur: 0.5, type: 'triangle', gain: 0.06, delay: 1.0 }),   // クリアの音のあとに
};

const $ = (id) => document.getElementById(id);
const titleEl = $('title'), playEl = $('play'), clearEl = $('clear');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function show(screen) {
  titleEl.hidden = screen !== titleEl;
  playEl.hidden = screen !== playEl;
}

// ---- 小さな盤（タイトルの見本・完成図・モードの絵・ビットの完成図） ----

// cell(t, pos) → [クラス, 中の文字]。t = 0 は空き
function mini(el, board, cell = () => ['', '']) {
  el.innerHTML = board.map((t, i) => {
    const [cls, text] = t ? cell(t, i) : ['', ''];
    return `<span class="${t ? 'mtile' : 'mhole'} ${cls}">${text}</span>`;
  }).join('');
}

const SAMPLE = [6, 0, 3, 1, 4, 9, 2, 7, 12, 5, 10, 11, 8, 13, 15, 14];   // 絵に使うまぜた盤
const zureMark = (t, i) => {
  const [dx, dy] = L.offset(t, i);
  return dx || dy ? ['', ''] : ['right', ''];
};
const bitCell = (digit) => (t) => [L.bit(t, digit) ? 'one' : 'zero', ''];

mini($('sample'), SAMPLE, (t, i) => (i === 5 || i === 14 ? ['ask', '?'] : zureMark(t, i)));
mini($('goal'), L.solved(), (t) => ['', t]);

const MODE_DESC = {
  zure: '各タイルの、正しい場所からの横と縦のずれが見える',
  bit: '番号を 2 進数にした 1 桁だけが白黒で見える。桁は 8・4・2・1 で切り替える',
  goukei: '行と列の番号の合計だけが見える',
};
const modesEl = $('modes');
modesEl.innerHTML = L.MODES.map((m) => `
  <button class="mode" data-mode="${m}">
    <span class="board board--mini mode__pic mode__pic--${m}" aria-hidden="true"></span>
    <span class="mode__text">
      <span class="mode__head"><span class="mode__name">${L.MODE_NAMES[m]}</span><span class="mode__level">${L.MODE_LEVELS[m]}</span></span>
      <span class="mode__desc">${MODE_DESC[m]}</span>
      <span class="mode__record"></span>
    </span>
  </button>`).join('');
for (const b of modesEl.children) {
  const m = b.dataset.mode;
  const pic = b.querySelector('.mode__pic');
  if (m === 'zure') mini(pic, SAMPLE, zureMark);
  else if (m === 'bit') mini(pic, SAMPLE, bitCell(8));
  else {
    // 合計: 左と上に合計の欄。合っているところだけ色を変える
    const { rows, cols } = L.sums(SAMPLE);
    const sum = (v, goal) => `<span class="msum${v === goal ? ' hit' : ''}"></span>`;
    pic.innerHTML = '<span></span>' + cols.map((v, c) => sum(v, L.TARGET.cols[c])).join('')
      + rows.map((v, r) => sum(v, L.TARGET.rows[r])
        + SAMPLE.slice(r * 4, r * 4 + 4).map((t) => `<span class="${t ? 'mtile' : 'mhole'}"></span>`).join('')).join('');
  }
}

function renderTitle() {
  for (const b of modesEl.children) {
    const m = b.dataset.mode;
    const rec = best[m];
    b.querySelector('.mode__record').textContent = rec == null ? '' : `最少 ${rec} 手`;
    b.classList.toggle('mode--last', m === settings.mode);
  }
  const snd = $('sound-btn');
  snd.textContent = settings.sound ? '音 オン' : '音 オフ';
  snd.setAttribute('aria-pressed', String(settings.sound));
}

// カードを押すとそのまま始まる
modesEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  settings.mode = b.dataset.mode;
  saveSettings();
  play();
});

$('sound-btn').addEventListener('click', () => {
  settings.sound = !settings.sound;
  setAudioSession(settings.sound);
  saveSettings();
  sfx.tap();
  renderTitle();
});

// ---- 遊ぶ ----

const boardEl = $('board'), stageEl = $('stage'), puzzleEl = $('puzzle'), digitsEl = $('digits');
let game = null;
let clearLockUntil = 0;

digitsEl.innerHTML = L.DIGITS.map((d) =>
  `<button class="digit" data-digit="${d}" aria-pressed="false">${d}<span class="digit__ok" aria-label="完成図と同じ"></span></button>`).join('');

// 盤を作る。タイルのボタンはここで 1 回だけ作り、動かすときは位置（--r, --c）を変えるだけ
function newGame(mode) {
  game = { mode, start: L.shuffle(), board: null, moves: 0, digit: 8, done: false };
  boardEl.innerHTML = '<span class="slot"></span>'.repeat(16)
    + Array.from({ length: 15 }, (_, i) => `<button class="tile" data-t="${i + 1}"><span class="clue"></span><span class="num">${i + 1}</span></button>`).join('');
  $('mode-name').textContent = L.MODE_NAMES[mode];
  $('count').hidden = mode === 'bit';
  $('bit-goal').hidden = mode !== 'bit';
  digitsEl.hidden = mode !== 'bit';
  puzzleEl.classList.toggle('with-sums', mode === 'goukei');
  const sumCells = (goals) => goals.map((g) => `<span class="sum"><b></b><small>目標 ${g}</small></span>`).join('');
  $('col-sums').innerHTML = sumCells(L.TARGET.cols);
  $('row-sums').innerHTML = sumCells(L.TARGET.rows);
  restart();
}

// はじめから: まぜた直後の盤に戻す
function restart() {
  game.board = game.start.slice();
  game.moves = 0;
  game.done = false;
  clearEl.hidden = true;
  playEl.classList.remove('cleared');
  boardEl.classList.remove('solved');
  $('moves').textContent = 0;
  $('hud-min').hidden = best[game.mode] == null;
  $('min').textContent = best[game.mode];
  // 位置は一気に戻す（すべらせない）
  boardEl.classList.add('instant');
  render();
  void boardEl.offsetWidth;
  boardEl.classList.remove('instant');
  fit();
}

// 盤と手がかりを今の状態に合わせる
function render() {
  const { board, mode, digit } = game;
  board.forEach((t, pos) => {
    if (!t) return;
    const el = boardEl.children[15 + t];      // 前の 16 個はマスのくぼみ
    const r = Math.floor(pos / 4), c = pos % 4;
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
    el.setAttribute('aria-label', `${r + 1} 段目 ${c + 1} 列目`);
    if (mode === 'zure') {
      const [dx, dy] = L.offset(t, pos);
      el.firstChild.innerHTML = dx || dy
        ? (dx ? `<span class="zx" aria-label="横に ${dx}">↔${dx}</span>` : '') + (dy ? `<span class="zy" aria-label="縦に ${dy}">↕${dy}</span>` : '')
        : '<span class="ok" aria-label="正しい場所"></span>';
    } else if (mode === 'bit') {
      el.classList.toggle('one', L.bit(t, digit) === 1);
    }
  });
  $('correct').textContent = L.correctCount(board);
  if (mode === 'goukei') {
    const { rows, cols } = L.sums(board);
    const put = (el, vals, goals) => vals.forEach((v, i) => {
      el.children[i].firstChild.textContent = v;
      el.children[i].classList.toggle('hit', v === goals[i]);
    });
    put($('col-sums'), cols, L.TARGET.cols);
    put($('row-sums'), rows, L.TARGET.rows);
  }
  if (mode === 'bit') {
    $('bit-goal-digit').textContent = digit;
    mini($('bit-goal-board'), L.solved(), bitCell(digit));
    for (const b of digitsEl.children) {
      b.setAttribute('aria-pressed', String(+b.dataset.digit === digit));
      b.classList.toggle('ok', L.bitMatches(board, +b.dataset.digit));
    }
  }
}

// タイルの大きさ: 幅（最大 420px）と、上下の表示を除いた高さの両方に収まる正方形。合計は横・縦とも 5 マス分
function fit() {
  if (!game || playEl.hidden) return;
  const units = game.mode === 'goukei' ? 5 : 4;
  const gap = 6;
  const w = Math.min(stageEl.clientWidth, 420) - gap * (units + 1);
  const h = stageEl.clientHeight - gap * (units + 1);
  const size = Math.max(24, Math.min(92, Math.floor(Math.min(w, h) / units)));
  puzzleEl.style.setProperty('--t', `${size}px`);
  puzzleEl.style.setProperty('--g', `${gap}px`);
}
new ResizeObserver(fit).observe(stageEl);

// 押して離したとき（click）に動かす
boardEl.addEventListener('click', (e) => {
  const el = e.target.closest('.tile');
  if (!el || !game || game.done) return;
  const { board, mode } = game;
  const before = mode === 'bit' ? L.DIGITS.filter((d) => L.bitMatches(board, d)) : null;
  const moved = L.slide(board, board.indexOf(+el.dataset.t));
  if (!moved.length) { sfx.nope(); return; }
  game.moves += moved.length;
  $('moves').textContent = game.moves;
  render();
  if (L.isSolved(board)) { finish(); return; }
  sfx.slide();
  if (mode === 'bit') {
    if (L.DIGITS.some((d) => !before.includes(d) && L.bitMatches(board, d))) sfx.match();
  } else if (moved.some((t) => board[t] === t)) {
    sfx.correct();       // ビットでは鳴らさない（画面に出ていない手がかりを音で漏らさない）
  }
});

digitsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.digit');
  if (!b || !game || game.done) return;
  game.digit = +b.dataset.digit;
  sfx.digit(game.digit);
  render();
});

function finish() {
  game.done = true;
  // 番号を 1 から順に出す（動きを弱める設定では一度に）
  for (const el of boardEl.querySelectorAll('.tile')) {
    el.style.setProperty('--delay', reduceMotion.matches ? '0s' : `${0.1 + el.dataset.t * 0.06}s`);
  }
  boardEl.classList.add('solved');
  sfx.clear();
  const record = L.addRecord(best, game.mode, game.moves);
  if (record) { save('best', best); sfx.record(); }
  $('clear-moves').textContent = game.moves;
  $('badges').hidden = !record;
  clearEl.hidden = false;
  playEl.classList.add('cleared');
  // 出た直後の 0.4 秒は押せない（最後の一手の勢いで「もう一度」を押さないように）
  clearLockUntil = performance.now() + 400;
  clearEl.classList.add('locked');
  setTimeout(() => clearEl.classList.remove('locked'), 400);
}

const unlocked = () => performance.now() >= clearLockUntil;

function play() {
  sfx.tap();
  show(playEl);
  newGame(settings.mode);
}

function toTitle() {
  sfx.tap();
  show(titleEl);
  renderTitle();
}

$('back-btn').addEventListener('click', toTitle);
$('reset-btn').addEventListener('click', () => { sfx.tap(); restart(); });
$('another-btn').addEventListener('click', play);
// もう一度: 同じモードで新しい盤
$('again-btn').addEventListener('click', () => { if (unlocked()) play(); });
$('home-btn').addEventListener('click', () => { if (unlocked()) toTitle(); });
$('share-btn').addEventListener('click', () => {
  if (!unlocked()) return;
  WebAppKit.share({ text: `かずかくし（${L.MODE_NAMES[game.mode]}）で、番号の見えない 15 パズルを ${game.moves} 手で解いた` });
});

renderTitle();
