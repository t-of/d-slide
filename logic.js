// かずかくしの決まりごと。画面（DOM）に触らない部分をここに集める。
// main.js（ブラウザ）と test.mjs（node）の両方から読む。
//
// 盤は長さ n × n の配列 board。board[マスの番号] = タイルの番号、0 = 空き。
// マスの番号は左上から右へ 0, 1, 2 …（行 r・列 c なら n * r + c）。
// 完成形は「マスの番号 = タイルの番号」（空きは左上の 0 番）。
// n はテストで 3 × 3 も確かめるために受け取る。アプリは 4 × 4 だけ。

export const N = 4;
export const MODES = ['zure', 'bit', 'goukei'];
export const MODE_NAMES = { zure: 'ずれ', bit: 'ビット', goukei: '合計' };
export const MODE_LEVELS = { zure: 'やさしい', bit: 'ふつう', goukei: 'むずかしい' };
export const DIGITS = [8, 4, 2, 1];                 // ビットの桁（ボタンの並び）
export const DEFAULT_SETTINGS = { v: 1, sound: true, mode: 'bit' };

export const solved = (n = N) => Array.from({ length: n * n }, (_, i) => i);
export const isSolved = (board) => board.every((t, i) => t === i);

// 並び（空きを 0 とした n² 個の置換）の偶奇 = 空きの左上からの距離（行 + 列）の偶奇 なら解ける。
// 1 手ごとに置換の偶奇も距離の偶奇も 1 回ずつ変わり、完成形はどちらも偶数なので、これが解ける条件になる。
export function solvable(board, n = N) {
  const seen = new Array(board.length).fill(false);
  let swaps = 0;
  for (let i = 0; i < board.length; i++) {      // 巡回置換に分けると、長さ k の巡回は k - 1 回の入れ替え
    for (let j = i, k = 0; !seen[j]; j = board[j], k++) {
      seen[j] = true;
      if (k) swaps++;
    }
  }
  const e = board.indexOf(0);
  return swaps % 2 === (Math.floor(e / n) + e % n) % 2;
}

// まぜる: ランダムに並べ、解けるものだけ使う。完成形そのものが出たら作り直す
export function shuffle(n = N, rand = Math.random) {
  for (;;) {
    const b = solved(n);
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    if (solvable(b, n) && !isSolved(b)) return b;
  }
}

// マス pos のタイルを押す。空きと同じ行・列なら、間のタイルをまとめて 1 マスずつ空きのほうへすべらせる。
// board を書き換え、動いたタイルの番号の配列を返す（動かなければ空）。
export function slide(board, pos, n = N) {
  let e = board.indexOf(0);
  if (pos === e) return [];
  let step;
  if (Math.floor(pos / n) === Math.floor(e / n)) step = pos > e ? 1 : -1;
  else if (pos % n === e % n) step = pos > e ? n : -n;
  else return [];
  const moved = [];
  while (e !== pos) {
    board[e] = board[e + step];
    moved.push(board[e]);
    e += step;
  }
  board[pos] = 0;
  return moved;
}

// ---- 手がかり ----

// タイル t がマス pos にあるときの、正しい場所との横・縦のずれ（向きなし）
export const offset = (t, pos, n = N) => [Math.abs(t % n - pos % n), Math.abs(Math.floor(t / n) - Math.floor(pos / n))];

// 正しい場所にあるタイルの枚数（空きは数えない）
export const correctCount = (board) => board.filter((t, i) => t && t === i).length;

// 行の合計（上から）と列の合計（左から）。空きは 0
export function sums(board, n = N) {
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
  board.forEach((t, i) => { rows[Math.floor(i / n)] += t; cols[i % n] += t; });
  return { rows, cols };
}
export const TARGET = sums(solved());               // 行 6・22・38・54、列 24・28・32・36

export const bit = (t, digit) => (t & digit ? 1 : 0);

// 桁 digit で見た盤が完成図と同じか（空きの場所も同じ見た目なので、空きが左上にあることも含む）
export const bitMatches = (board, digit) => board.every((t, i) => (i === 0 ? t === 0 : t !== 0 && bit(t, digit) === bit(i, digit)));

// ---- 保存する値 ----

export function readSettings(raw) {
  const d = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
  return { v: 1, sound: raw.sound !== false, mode: MODES.includes(raw.mode) ? raw.mode : d.mode };
}

export function readBest(raw) {
  const best = { v: 1, zure: null, bit: null, goukei: null };
  if (raw && typeof raw === 'object' && raw.v === 1) {
    for (const m of MODES) if (Number.isInteger(raw[m]) && raw[m] > 0) best[m] = raw[m];
  }
  return best;
}

// クリアした手数を記録に入れる。記録を更新したら true
export function addRecord(best, mode, moves) {
  if (best[mode] != null && best[mode] <= moves) return false;
  best[mode] = moves;
  return true;
}
