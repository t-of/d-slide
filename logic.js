// D-SLIDE（かずかくし）の決まりごと。画面（DOM）に触らない部分をここに集める。
// main.js（ブラウザ）と test.mjs（node）の両方から読む。
//
// 盤は長さ n × n の配列 board。board[マスの番号] = タイルの番号、0 = 空き。
// マスの番号は左上から右へ 0, 1, 2 …（行 r・列 c なら n * r + c）。
// 完成形は、ふつうの 15 パズルと同じく「1〜15 が左上から並び、空きは右下」
// （マスの番号 i の正しいタイルは (i + 1) % n²、最後のマスだけ空き）。
// n はテストで 3 × 3 も確かめるために受け取る。アプリは 4 × 4 だけ。

export const N = 4;
export const MODES = ['number', 'zure', 'bit', 'goukei'];
export const MODE_NAMES = { number: 'ナンバー', zure: 'ずれ', bit: 'ビット', goukei: '合計' };
export const MODE_LEVELS = { number: 'きほん', zure: 'やさしい', bit: 'ふつう', goukei: 'むずかしい' };
export const DIGITS = [8, 4, 2, 1];                 // ビットの桁（ボタンの並び）
export const DEFAULT_SETTINGS = { v: 1, sound: true, mode: 'number' };

export const solved = (n = N) => Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
export const isSolved = (board) => board.every((t, i) => t === (i + 1) % board.length);

// タイル t の正しいマスの番号（空き = 0 は最後のマス）
export const targetPos = (t, n = N) => (t === 0 ? n * n - 1 : t - 1);

// 並び（board を「タイルの正しいマス」に読み替えた置換）の偶奇
//   = 空きの、正しいマスからの距離（行 + 列）の偶奇 なら解ける。
// 1 手ごとに置換の偶奇も距離の偶奇も 1 回ずつ変わり、完成形はどちらも偶数（距離 0）なので、これが解ける条件になる。
// 正しいマスの行・列の合計は空きが左上でも右下でも偶数なので、比べる相手は「空きの位置の行 + 列」のままでよい。
export function solvable(board, n = N) {
  const pos = new Array(board.length);
  solved(n).forEach((t, i) => { pos[t] = i; });
  const seen = new Array(board.length).fill(false);
  let swaps = 0;
  for (let i = 0; i < board.length; i++) {      // 巡回置換に分けると、長さ k の巡回は k - 1 回の入れ替え
    for (let j = i, k = 0; !seen[j]; j = pos[board[j]], k++) {
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
export function offset(t, pos, n = N) {
  const g = targetPos(t, n);
  return [Math.abs(g % n - pos % n), Math.abs(Math.floor(g / n) - Math.floor(pos / n))];
}

// 正しい場所にあるタイルの枚数（空きは数えない）。空き以外の正しいマスは t - 1 番なので n に関係ない
export const correctCount = (board) => board.filter((t, i) => t && t - 1 === i).length;

// 行の合計（上から）と列の合計（左から）。空きは 0
export function sums(board, n = N) {
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
  board.forEach((t, i) => { rows[Math.floor(i / n)] += t; cols[i % n] += t; });
  return { rows, cols };
}
export const TARGET = sums(solved());               // 行 10・26・42・42、列 28・32・36・24

export const bit = (t, digit) => (t & digit ? 1 : 0);

// 桁 digit で見た盤が完成図と同じか（空きの場所も同じ見た目なので、空きが右下にあることも含む）
export const bitMatches = (board, digit) => {
  const last = board.length - 1;
  return board.every((t, i) => (i === last ? t === 0 : t !== 0 && bit(t, digit) === bit(i + 1, digit)));
};

// ---- 保存する値 ----

export function readSettings(raw) {
  const d = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
  return { v: 1, sound: raw.sound !== false, mode: MODES.includes(raw.mode) ? raw.mode : d.mode };
}

export function readBest(raw) {
  const best = { v: 1, number: null, zure: null, bit: null, goukei: null };
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
