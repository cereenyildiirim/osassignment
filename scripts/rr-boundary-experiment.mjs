// Reproduce an RR queue-order bug in a temporary copy of the engine.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { simulate } from '../scheduler.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const enginePath = path.join(root, 'scheduler.mjs');
const original = await readFile(enginePath, 'utf8');
const testName = 'RR: boundary arrivals are enqueued before the running process';
const correctOrder = `      enqueueArrivals();
      if (job.remaining > 0) queue.push(job);`;
const faultyOrder = `      if (job.remaining > 0) queue.push(job);
      enqueueArrivals();`;
assert.equal(original.split(correctOrder).length, 2, 'The mutation must match exactly one block.');

const temporary = await mkdtemp(path.join(tmpdir(), 'rr-boundary-experiment-'));
try {
  for (const filename of ['scheduler.test.mjs', 'workloads.mjs']) {
    await copyFile(path.join(root, filename), path.join(temporary, filename));
  }
  const faultyPath = path.join(temporary, 'scheduler.mjs');
  await writeFile(faultyPath, original.replace(correctOrder, faultyOrder));
  const { simulate: faultySimulate } = await import(pathToFileURL(faultyPath).href);
  const workload = [{ id: 'A', arrival: 0, burst: 4 }, { id: 'B', arrival: 2, burst: 1 }];
  const expected = simulate(workload, 'RR', 2);
  const faulty = faultySimulate(workload, 'RR', 2);
  assert.deepEqual(expected.timeline, [
    { id: 'A', start: 0, end: 2 }, { id: 'B', start: 2, end: 3 }, { id: 'A', start: 3, end: 5 },
  ]);
  assert.deepEqual(faulty.timeline, [
    { id: 'A', start: 0, end: 2 }, { id: 'A', start: 2, end: 4 }, { id: 'B', start: 4, end: 5 },
  ]);

  const runTest = directory => spawnSync(process.execPath,
    ['--test', `--test-name-pattern=${testName}`, 'scheduler.test.mjs'],
    { cwd: directory, encoding: 'utf8' });
  const faultyTest = runTest(temporary);
  const correctTest = runTest(root);
  if (faultyTest.error) throw faultyTest.error;
  if (correctTest.error) throw correctTest.error;
  assert.equal(faultyTest.status, 1, 'The existing regression test must reject the faulty engine.');
  assert.match(faultyTest.stdout + faultyTest.stderr, /ERR_ASSERTION/);
  assert.equal(correctTest.status, 0, 'The same test must pass with the correct engine.');
  assert.ok(faultyTest.stdout.includes(testName), 'The faulty-engine run must execute the selected test.');
  assert.ok(correctTest.stdout.includes(testName), 'The correct-engine run must execute the selected test.');
  assert.equal(await readFile(enginePath, 'utf8'), original, 'The project engine must stay unchanged.');

  const result = {
    method: 'Deliberately introduced queue-order error in a temporary engine copy',
    testName, workload, quantum: 2,
    expected, faulty,
    faultyTestExitCode: faultyTest.status,
    correctTestExitCode: correctTest.status,
    originalEngineUnchanged: true,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result));
  } else {
    const timeline = run => run.timeline.map(s => `${s.start}-${s.end} ${s.id}`).join(' | ');
    console.log('Controlled RR boundary experiment (temporary copy only)');
    console.log(`Test: ${testName}`);
    console.log(`Faulty timeline:  ${timeline(faulty)}`);
    console.log(`Correct timeline: ${timeline(expected)}`);
    console.log(`Faulty engine test exit code: ${faultyTest.status} (assertion failed as expected)`);
    console.log(`Correct engine test exit code: ${correctTest.status} (passed)`);
    console.log('The project engine was not modified.');
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
