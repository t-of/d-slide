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
  const b = L.solved();                         // 空きは 0 番（左上）
  assert.deepEqual(L.slide(b, 3), [1, 2, 3]);    // 右端を押すと 3 枚が左へ
  assert.deepEqual(b.slice(0, 4), [1, 2, 3, 0]);
  assert.deepEqual(L.slide(b, 15), [7, 11, 15]); // 空き（3 番）の列の下端
  assert.equal(b[15], 0);
  assert.deepEqual(L.slide(b, 0), []);           // 行も列も違う
  assert.deepEqual(L.slide(b, 15), []);          // 空きそのもの
  assert.deepEqual(L.slide(b, 12), [14, 13, 12]);
  assert.deepEqual(b.slice(12), [0, 12, 13, 14]);
});

test('解けるか: 仕様の確かめ用の値', () => {
  const b = L.solved();
  assert.ok(L.solvable(b) && L.isSolved(b));
  [b[0], b[1]] = [b[1], b[0]];                   // 1 と空きを入れ替え = 空きを右へ 1 つ
  assert.ok(L.solvable(b));
  const c = L.solved();
  [c[1], c[2]] = [c[2], c[1]];                   // 1 と 2 だけを入れ替え
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
    assert.deepEqual(b.slice().sort((x, y) => x - y), L.solved());
  }
});

test('まぜ方: 3 × 3 で、まぜた盤は実際にたどり着ける', () => {
  const ok = reachable(3), rand = rng(3);
  for (let i = 0; i < 2000; i++) assert.ok(ok.has(L.shuffle(3, rand).join()));
});

test('手がかり: ずれ・正しい場所・合計', () => {
  assert.deepEqual(L.offset(5, 5), [0, 0]);
  assert.deepEqual(L.offset(15, 0), [3, 3]);
  assert.deepEqual(L.offset(1, 4), [1, 1]);
  assert.equal(L.correctCount(L.solved()), 15);
  assert.deepEqual(L.TARGET, { rows: [6, 22, 38, 54], cols: [24, 28, 32, 36] });
  const b = L.solved();
  L.slide(b, 4);                                 // 4 が上へ
  assert.equal(L.correctCount(b), 14);
  assert.deepEqual(L.sums(b), { rows: [10, 18, 38, 54], cols: [24, 28, 32, 36] });
});

test('手がかり: ビットの完成図は縞になり、盤が完成なら 4 桁とも同じ', () => {
  const pic = (d) => L.solved().map((i) => L.bit(i, d)).join('');
  assert.equal(pic(8), '0000000011111111');       // 下 2 行
  assert.equal(pic(4), '0000111100001111');       // 2・4 行目
  assert.equal(pic(2), '0011001100110011');       // 右 2 列
  assert.equal(pic(1), '0101010101010101');       // 2・4 列目
  for (const d of L.DIGITS) assert.ok(L.bitMatches(L.solved(), d));
  const b = L.solved();
  L.slide(b, 1);                                 // 空きが 1 番へ
  assert.ok(!L.bitMatches(b, 1));
  assert.ok(L.bitMatches(b, 8) === false);       // 空きの場所が違う
  const c = L.solved();
  [c[5], c[7]] = [c[7], c[5]];                   // 5 と 7 は 2 の桁だけ違う
  assert.deepEqual(L.DIGITS.map((d) => L.bitMatches(c, d)), [true, true, false, true]);
});

test('保存: 読めない値ははじめの値、記録は少ないときだけ更新', () => {
  assert.deepEqual(L.readSettings(null), L.DEFAULT_SETTINGS);
  assert.deepEqual(L.readSettings('x'), L.DEFAULT_SETTINGS);
  assert.deepEqual(L.readSettings({ v: 2, sound: false }), L.DEFAULT_SETTINGS);
  assert.deepEqual(L.readSettings({ v: 1, sound: false, mode: 'zzz' }), { v: 1, sound: false, mode: 'bit' });
  assert.deepEqual(L.readSettings({ v: 1, sound: true, mode: 'goukei' }), { v: 1, sound: true, mode: 'goukei' });
  const best = L.readBest({ v: 1, zure: 92, bit: -3, goukei: 'a' });
  assert.deepEqual(best, { v: 1, zure: 92, bit: null, goukei: null });
  assert.ok(L.addRecord(best, 'bit', 140));
  assert.ok(!L.addRecord(best, 'bit', 140));
  assert.ok(!L.addRecord(best, 'zure', 100));
  assert.ok(L.addRecord(best, 'zure', 80));
  assert.deepEqual(best, { v: 1, zure: 80, bit: 140, goukei: null });
});

console.log(`\n${n} tests passed`);
