import { simulate } from './scheduler.mjs';
import { WORKLOAD_A, WORKLOAD_B } from './workloads.mjs';

const $ = selector => document.querySelector(selector);
const form = $('#simulation-form');
const inputs = $('#process-inputs');
const palette = ['#c5dfd0', '#c9def1', '#efdbb5', '#dbd1ec', '#efcfc9', '#c3e1df'];
const descriptions = {
  FCFS: 'Runs processes in arrival order. Each process keeps the CPU until it finishes.',
  SJF: 'Selects the shortest ready job when the CPU becomes free. Does not preempt.',
  SRTF: 'Runs the process with the shortest remaining time. Preempts only for a strictly shorter job.',
  RR: 'Gives each queued process one time slice. Boundary arrivals join before the running process is requeued.',
};
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
let displayed = false;

// Use textContent so process IDs are displayed as text, not HTML.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function invalidate() {
  $('#error-message').hidden = true;
  $('#results').hidden = true;
  $('#empty-state').hidden = false;
  $('#result-badge').textContent = 'Not run yet';
  $('#input-status').textContent = 'Inputs changed. Run the simulation to update the results.';
  displayed = false;
}

function addRow(process) {
  const row = document.createElement('tr');
  for (const [key, label] of [['id', 'Process ID'], ['arrival', 'Arrival time'], ['burst', 'CPU burst']]) {
    const input = document.createElement('input');
    input.dataset.field = key;
    input.type = key === 'id' ? 'text' : 'number';
    input.value = process[key];
    input.required = true;
    if (key !== 'id') {
      input.min = key === 'arrival' ? '0' : '1';
      input.step = '1';
    }
    input.setAttribute('aria-label', label);
    const cell = document.createElement('td');
    cell.append(input);
    row.append(cell);
  }
  const remove = element('button', '×', 'remove-button');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove process');
  remove.addEventListener('click', () => { row.remove(); invalidate(); });
  const cell = document.createElement('td');
  cell.append(remove);
  row.append(cell);
  inputs.append(row);
}

function readProcesses() {
  return [...inputs.rows].map(row => ({
    id: row.querySelector('[data-field=id]').value.trim(),
    arrival: row.querySelector('[data-field=arrival]').valueAsNumber,
    burst: row.querySelector('[data-field=burst]').valueAsNumber,
  }));
}

function updateAlgorithm() {
  const algorithm = form.elements.algorithm.value;
  $('#quantum').disabled = algorithm !== 'RR';
  $('#algorithm-description').textContent = descriptions[algorithm];
}

function render(result) {
  const colors = new Map(result.results.map((row, index) => [row.id, palette[index % palette.length]]));
  $('#result-rows').replaceChildren();
  $('#gantt').replaceChildren();
  $('#legend').replaceChildren();
  $('#trace-list').replaceChildren();
  for (const key of ['turnaround', 'waiting', 'response']) {
    $(`#average-${key}`).textContent = numberFormat.format(result.averages[key]);
  }
  for (const row of result.results) {
    const tr = document.createElement('tr');
    for (const key of ['id', 'arrival', 'burst', 'firstStart', 'completion', 'turnaround', 'waiting', 'response']) {
      const td = element('td', row[key]);
      if (key === 'id') {
        const dot = element('span', undefined, 'swatch');
        dot.style.background = colors.get(row.id);
        td.prepend(dot);
        td.title = row.id;
      }
      tr.append(td);
    }
    $('#result-rows').append(tr);
  }
  const end = result.timeline.at(-1).end;
  const duration = result.timeline.map(s => s.end - s.start);
  // Keep short slices readable and allow long timelines to scroll.
  const widths = duration.map(d => Math.max(48, d / end * 760));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  let idle = 0;
  result.timeline.forEach((segment, index) => {
    const { id, start, end: finish } = segment;
    const label = id ?? 'Idle';
    const block = element('div', undefined, `gantt-segment${id === null ? ' idle' : ''}`);
    block.style.flexBasis = `${widths[index] / totalWidth * 100}%`;
    block.style.minWidth = `${widths[index]}px`;
    if (id !== null) block.style.background = colors.get(id);
    else idle += finish - start;
    block.title = `${label}: ${start}–${finish} (${finish - start} units)`;
    block.setAttribute('aria-label', block.title);
    block.append(element('span', label, 'segment-id'), element('span', start, 'tick'));
    if (index === result.timeline.length - 1) block.append(element('span', finish, 'tick end-tick'));
    $('#gantt').append(block);
    $('#trace-list').append(element('li', `${start}–${finish}: ${label} · ${finish - start} units`));
  });
  for (const [id, color] of colors) {
    const item = element('span', undefined, 'legend-item');
    const dot = element('span', undefined, 'swatch');
    dot.style.background = color;
    item.append(dot, document.createTextNode(id));
    $('#legend').append(item);
  }
  if (idle > 0) $('#legend').append(element('span', '▧ Idle', 'legend-item'));
  $('#timeline-summary').textContent = `Completion: ${end} · CPU busy: ${end - idle} · Idle: ${idle}`;
  $('#quantum-note').hidden = result.algorithm !== 'RR';
  $('#result-badge').textContent = result.algorithm === 'RR' ? `RR · q = ${result.quantum}` : result.algorithm;
  $('#results').hidden = false;
  $('#empty-state').hidden = true;
  $('#error-message').hidden = true;
  $('#input-status').textContent = `${result.results.length} processes simulated.`;
  $('#result-status').textContent = `${result.algorithm} results updated.`;
  displayed = true;
}

function runSimulation() {
  try {
    const processes = readProcesses();
    const algorithm = form.elements.algorithm.value;
    const quantum = $('#quantum').valueAsNumber;
    // Avoid rendering so many RR slices that the browser becomes unresponsive.
    if (algorithm === 'RR' && Number.isSafeInteger(quantum) && quantum > 0
        && processes.reduce((sum, p) => sum + Math.ceil(p.burst / quantum), 0) > 5000) {
      throw new Error('This workload creates more than 5,000 RR slices. Reduce CPU bursts or increase the quantum.');
    }
    render(simulate(processes, algorithm, quantum));
  } catch (error) {
    invalidate();
    $('#error-message').textContent = error.message;
    $('#error-message').hidden = false;
    $('#input-status').textContent = 'Check the inputs and run again.';
  }
}

function load(workload) {
  inputs.replaceChildren();
  workload.forEach(addRow);
  runSimulation();
}

form.addEventListener('submit', event => { event.preventDefault(); runSimulation(); });
form.addEventListener('input', () => { updateAlgorithm(); invalidate(); });
$('#load-a').addEventListener('click', () => load(WORKLOAD_A));
$('#load-b').addEventListener('click', () => load(WORKLOAD_B));
$('#add-process').addEventListener('click', () => {
  const ids = new Set(readProcesses().map(p => p.id));
  let n = 1;
  while (ids.has(`P${n}`)) n++;
  addRow({ id: `P${n}`, arrival: 0, burst: 1 });
  if (displayed) invalidate();
  inputs.lastElementChild.querySelector('input').focus();
});
updateAlgorithm();
load(WORKLOAD_A);
