// node test.mjs — 画面を使わない部分のテスト（すべらせる・解けるか・まぜ方・手がかり・保存）
import assert from 'node:assert/strict';
import * as L from './logic.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${name}`); };

// 決まった種から同じ列を返す乱数
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// 完成形から 1 手ずつ動かしてたどり着ける盤を全部集める（小さい盤だけ）
function reachable(size) {
  const start = L.solved(size);
  const seen = new Set([start.join()]);
  const queue = [start];
  while (queue.length) {
    const b = queue.pop();
    for (let p = 0; p < b.length; p++) {
      const c = b.slice();
      if (!L.slide(c, p, size).length) continue;
      const k = c.join();
      if (!seen.has(k)) { seen.add(k); queue.push(c); }
    }
  }
  return seen;
}

// 並びをすべて作る
function* permutations(a, k = 0) {
  if (k === a.length) { yield a.slice(); return; }
  for (let i = k; i < a.length; i++) {
    [a[k], a[i]] = [a[i], a[k]];
    yield* permutations(a, k + 1);
    [a[k], a[i]] = [a[i], a[k]];
  }
}

test('すべらせる: 同じ行・列ならまとめて動き、ほかは動かない', () => {
  const b = L.solved();                          // 空きは 15 番（右下）。中身は 1..15, 0
  assert.deepEqual(L.slide(b, 3), [12, 8, 4]);   // 右上を押すと同じ列の 3 枚が空きのほうへ詰まる
  assert.equal(b[3], 0);
  assert.equal(b[7], 4);
  assert.equal(b[11], 8);
  assert.equal(b[15], 12);
  assert.deepEqual(L.slide(b, 8), []);           // 行も列も違う（空きは今 3 番）
  assert.deepEqual(L.slide(b, 3), []);           // 空きそのもの
  assert.deepEqual(L.slide(b, 15), [4, 8, 12]);  // 同じ列を戻す
  assert.equal(b[15], 0);
});

test('解けるか: 仕様の確かめ用の値', () => {
  const b = L.solved();
  assert.ok(L.solvable(b) && L.isSolved(b));
  [b[14], b[15]] = [b[15], b[14]];                // 15 と空きを入れ替え = 空きを左へ 1 つ
  assert.ok(L.solvable(b));
  const c = L.solved();
  [c[0], c[1]] = [c[1], c[0]];                    // 1 と 2 だけを入れ替え
  assert.ok(!L.solvable(c));
});

test('解けるか: 2 × 2 と 3 × 3 の全部の並びで、たどり着けるものとちょうど一致する', () => {
  for (const size of [2, 3]) {
    const ok = reachable(size);
    let count = 0;
    for (const p of permutations(L.solved(size))) {
      count++;
      assert.equal(L.solvable(p, size), ok.has(p.join()), p.join());
    }
    assert.equal(ok.size, count / 2);            // ちょうど半分が解ける
  }
});

test('解けるか: 4 × 4 で、完成形からどう動かしても解ける盤のまま', () => {
  const rand = rng(7);
  const b = L.solved();
  for (let i = 0; i < 20000; i++) {
    L.slide(b, Math.floor(rand() * 16));
    assert.ok(L.solvable(b));
  }
  const i1 = b.indexOf(1), i2 = b.indexOf(2);
  [b[i1], b[i2]] = [2, 1];                       // 2 枚入れ替えると解けなくなる
  assert.ok(!L.solvable(b));
});

test('まぜ方: 4 × 4 で、いつも解ける・完成形でない・1〜15 と空きがそろっている', () => {
  const rand = rng(1);
  for (let i = 0; i < 5000; i++) {
    const b = L.shuffle(4, rand);
    assert.ok(L.solvable(b) && !L.isSolved(b));
    assert.deepEqual(b.slice().sort((x, y) => x - y), L.solved().slice().sort((x, y) => x - y));
  }
});

test('まぜ方: 3 × 3 で、まぜた盤は実際にたどり着ける', () => {
  const ok = reachable(3), rand = rng(3);
  for (let i = 0; i < 2000; i++) assert.ok(ok.has(L.shuffle(3, rand).join()));
});

test('手がかり: ずれ・正しい場所・合計', () => {
  assert.deepEqual(L.offset(5, 4), [0, 0]);       // 5 の正しいマスは 4 番
  assert.deepEqual(L.offset(1, 15), [3, 3]);      // 1 の正しいマス（左上）から右下の隅まで
  assert.deepEqual(L.offset(6, 10), [1, 1]);
  assert.equal(L.correctCount(L.solved()), 15);
  assert.deepEqual(L.TARGET, { rows: [10, 26, 42, 42], cols: [28, 32, 36, 24] });
  const b = L.solved();
  L.slide(b, 14);                                // 15 が空きのほうへ
  assert.equal(L.correctCount(b), 14);
  assert.deepEqual(L.sums(b), { rows: [10, 26, 42, 42], cols: [28, 32, 21, 39] });
});

test('手がかり: ビット。盤が完成なら 4 桁ともそろい、空きの位置も含めて確かめる', () => {
  for (const d of L.DIGITS) assert.ok(L.bitMatches(L.solved(), d));
  const b = L.solved();
  L.slide(b, 11);                                // 空きが 11 番へ動く（12 が空きのほうへ）
  for (const d of L.DIGITS) assert.ok(!L.bitMatches(b, d));   // 空きの場所がどの桁でもずれる
  const c = L.solved();
  [c[4], c[6]] = [c[6], c[4]];                   // 5 と 7 は 2 の桁だけ違う
  assert.deepEqual(L.DIGITS.map((d) => L.bitMatches(c, d)), [true, true, false, true]);
});

test('保存: 読めない値ははじめの値、記録は少ないときだけ更新', () => {
  assert.deepEqual(L.readSettings(null), L.DEFAULT_SETTINGS);
  assert.deepEqual(L.readSettings('x'), L.DEFAULT_SETTINGS);
  assert.deepEqual(L.readSettings({ v: 2, sound: false }), L.DEFAULT_SETTINGS);
  assert.deepEqual(L.readSettings({ v: 1, sound: false, mode: 'zzz' }), { v: 1, sound: false, mode: 'number' });
  assert.deepEqual(L.readSettings({ v: 1, sound: true, mode: 'goukei' }), { v: 1, sound: true, mode: 'goukei' });
  assert.deepEqual(L.readSettings({ v: 1, sound: true, mode: 'number' }), { v: 1, sound: true, mode: 'number' });
  const best = L.readBest({ v: 1, zure: 92, bit: -3, goukei: 'a' });
  assert.deepEqual(best, { v: 1, number: null, zure: 92, bit: null, goukei: null });
  assert.ok(L.addRecord(best, 'bit', 140));
  assert.ok(!L.addRecord(best, 'bit', 140));
  assert.ok(!L.addRecord(best, 'zure', 100));
  assert.ok(L.addRecord(best, 'zure', 80));
  assert.ok(L.addRecord(best, 'number', 30));
  assert.deepEqual(best, { v: 1, number: 30, zure: 80, bit: 140, goukei: null });
});

test('保存: 「ナンバー」を足す前の古い best（v:1、number キーなし）もそのまま引き継ぐ', () => {
  const old = { v: 1, zure: 55, bit: 40, goukei: 99 };
  const best = L.readBest(old);
  assert.deepEqual(best, { v: 1, number: null, zure: 55, bit: 40, goukei: 99 });
});

console.log(`\n${n} tests passed`);
