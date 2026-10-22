import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, ALGORITHMS } from './scheduler.mjs';
import { WORKLOAD_A, WORKLOAD_B } from './workloads.mjs';

const a = [
  ['FCFS', [['P1',0,8],['P2',8,12],['P3',12,14],['P4',14,15]],
    [[0,8,8,0,0],[8,12,11,7,7],[12,14,12,10,10],[14,15,11,10,10]], [10.5,6.75,6.75]],
  ['SJF', [['P1',0,8],['P4',8,9],['P3',9,11],['P2',11,15]],
    [[0,8,8,0,0],[11,15,14,10,10],[9,11,9,7,7],[8,9,5,4,4]], [9,5.25,5.25]],
  ['SRTF', [['P1',0,1],['P2',1,2],['P3',2,4],['P4',4,5],['P2',5,8],['P1',8,15]],
    [[0,15,15,7,0],[1,8,7,3,0],[2,4,2,0,0],[4,5,1,0,0]], [6.25,2.5,0]],
  ['RR', [['P1',0,2],['P2',2,4],['P3',4,6],['P1',6,8],['P4',8,9],['P2',9,11],['P1',11,13],['P1',13,15]],
    [[0,15,15,7,0],[2,11,10,6,1],[4,6,4,2,2],[8,9,5,4,4]], [8.5,4.75,1.75]],
];
const b = [
  ['FCFS', [[null,0,2],['P1',2,5],['P2',5,6],[null,6,8],['P3',8,10],['P4',10,11]],
    [[2,5,3,0,0],[5,6,4,3,3],[8,10,2,0,0],[10,11,2,1,1]], [2.75,1,1]],
  ...['SJF','SRTF'].map(algorithm => [algorithm,
    [[null,0,2],['P2',2,3],['P1',3,6],[null,6,8],['P3',8,10],['P4',10,11]],
    [[3,6,4,1,1],[2,3,1,0,0],[8,10,2,0,0],[10,11,2,1,1]], [2.25,0.5,0.5]]),
  ['RR', [[null,0,2],['P1',2,4],['P2',4,5],['P1',5,6],[null,6,8],['P3',8,10],['P4',10,11]],
    [[2,6,4,1,0],[4,5,3,2,2],[8,10,2,0,0],[10,11,2,1,1]], [2.75,1,0.75]],
];
const tuples = result => result.timeline.map(({id,start,end}) => [id,start,end]);

function checkProperties(input, result) {
  let end = 0;
  const received = new Map(input.map(p => [p.id, 0]));
  for (const segment of result.timeline) {
    assert.equal(segment.start, end, 'Çizelgede boşluk veya çakışma olmamalı.');
    assert.ok(segment.end > segment.start);
    if (segment.id === null) {
      for (const p of input) {
        assert.ok(p.arrival >= segment.end || received.get(p.id) === p.burst,
          'Hazır işlem varken CPU boş bırakılamaz.');
      }
    } else {
      const p = input.find(p => p.id === segment.id);
      assert.ok(p);
      assert.ok(segment.start >= p.arrival);
      received.set(p.id, received.get(p.id) + segment.end - segment.start);
    }
    end = segment.end;
  }
  for (const p of input) assert.equal(received.get(p.id), p.burst);
  for (const row of result.results) {
    const slices = result.timeline.filter(segment => segment.id === row.id);
    assert.equal(row.firstStart, slices[0].start);
    assert.equal(row.completion, slices.at(-1).end);
    assert.equal(row.turnaround, row.completion - row.arrival);
    assert.equal(row.waiting, row.turnaround - row.burst);
    assert.equal(row.response, row.firstStart - row.arrival);
    assert.ok(row.waiting >= 0 && row.response >= 0);
  }
}

for (const [name, input, cases] of [['A',WORKLOAD_A,a], ['B',WORKLOAD_B,b]]) {
  for (const [algorithm, timeline, rows, averages] of cases) {
    test(`${name} / ${algorithm}: elle hesaplanan çizelge ve tüm ölçümler`, () => {
      const original = structuredClone(input);
      const result = simulate(input, algorithm, 2);
      assert.deepEqual(tuples(result), timeline);
      assert.deepEqual(result.results.map(r =>
        [r.firstStart,r.completion,r.turnaround,r.waiting,r.response]), rows);
      assert.deepEqual(Object.values(result.averages), averages);
      assert.deepEqual(input, original, 'Giriş verisi değiştirilmemeli.');
      checkProperties(input, result);
    });
  }
}

test('Ek test 1: başlangıçta ve iki işlem arasında boş CPU', () => {
  const input = [{id:'A',arrival:2,burst:1},{id:'B',arrival:5,burst:1}];
  for (const algorithm of ALGORITHMS) {
    const result = simulate(input, algorithm);
    assert.deepEqual(tuples(result), [[null,0,2],['A',2,3],[null,3,5],['B',5,6]]);
    checkProperties(input, result);
  }
});

test('Ek test 2: aynı geliş ve sürede alfabetik sıra yerine giriş sırası', () => {
  const input = [{id:'Z',arrival:0,burst:1},{id:'A',arrival:0,burst:1}];
  for (const algorithm of ALGORITHMS) {
    const result = simulate(input, algorithm);
    assert.deepEqual(tuples(result), [['Z',0,1],['A',1,2]]);
    checkProperties(input, result);
  }
});

test('Ek test 3: SRTF kısa iş gelince keser ve uzun işe geri döner', () => {
  const input = [{id:'A',arrival:0,burst:5},{id:'B',arrival:1,burst:1}];
  const result = simulate(input, 'SRTF');
  assert.deepEqual(tuples(result), [['A',0,1],['B',1,2],['A',2,6]]);
  checkProperties(input, result);
});

test('SRTF: eşit kalan sürede çalışan işlem devam eder', () => {
  const result = simulate([{id:'A',arrival:0,burst:3},{id:'B',arrival:1,burst:2}], 'SRTF');
  assert.deepEqual(tuples(result), [['A',0,3],['B',3,5]]);
});

test('SJF ve SRTF: sürede eşitlik varsa önce daha erken gelen seçilir', () => {
  const input = [{id:'firstInList',arrival:1,burst:1},{id:'earlier',arrival:0,burst:2},
    {id:'later',arrival:2,burst:1}];
  for (const algorithm of ['SJF','SRTF']) {
    assert.deepEqual(tuples(simulate(input, algorithm)),
      [['earlier',0,2],['firstInList',2,3],['later',3,4]]);
  }
});

test('RR: sınır anındaki geliş, çalışan işlemin önüne eklenir', () => {
  const result = simulate([{id:'A',arrival:0,burst:4},{id:'B',arrival:2,burst:1}], 'RR', 2);
  assert.deepEqual(tuples(result), [['A',0,2],['B',2,3],['A',3,5]]);
});

test('RR: tek işlemde bile quantum sınırları korunur', () => {
  assert.deepEqual(tuples(simulate([{id:'A',arrival:0,burst:5}], 'RR', 2)),
    [['A',0,2],['A',2,4],['A',4,5]]);
});

test('Hatalı girişler açık hata mesajlarıyla reddedilir', () => {
  const valid = {id:'A',arrival:0,burst:1};
  const invalid = [[], [null], [{...valid,id:' '}], [valid,{...valid}],
    [{...valid,arrival:-1}], [{...valid,arrival:0.5}], [{...valid,arrival:'0'}],
    [{...valid,burst:0}], [{...valid,burst:-1}], [{...valid,burst:Infinity}],
    [{...valid,arrival:Number.MAX_SAFE_INTEGER}]];
  for (const input of invalid) assert.throws(() => simulate(input,'FCFS'), Error);
  for (const quantum of [0,-1,0.5,NaN,'2']) {
    assert.throws(() => simulate([valid],'RR',quantum), /quantum/);
  }
  assert.throws(() => simulate([valid],'unknown'), /algoritma/);
});
