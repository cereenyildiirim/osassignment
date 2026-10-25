import { simulate } from './scheduler.mjs';
import { WORKLOAD_A, WORKLOAD_B } from './workloads.mjs';

const $ = selector => document.querySelector(selector);
const form = $('#simulation-form');
const inputs = $('#process-inputs');
const palette = ['#c5dfd0', '#c9def1', '#efdbb5', '#dbd1ec', '#efcfc9', '#c3e1df'];
const descriptions = {
  FCFS: 'Geliş sırasına göre çalıştırır. Başlayan işlem tamamlanana kadar CPU’yu bırakmaz.',
  SJF: 'CPU boşaldığında, hazır işlemlerden CPU süresi en kısa olanı seçer. Çalışanı kesmez.',
  SRTF: 'Kalan süresi en kısa olanı çalıştırır. Yalnızca daha kısa bir iş geldiğinde keser; eşitlikte devam eder.',
  RR: 'FIFO kuyruğundaki işlemlere sırayla bir quantum verir. Sınırdaki gelişler, yeniden eklenen işlemden önce gelir.',
};
const numberFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });
let displayed = false;

// Kullanıcı metinleri innerHTML yerine textContent ile yerleştirilir.
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
  $('#result-badge').textContent = 'Çalıştırılmayı bekliyor';
  $('#input-status').textContent = 'Girdiler değişti. Sonuçları güncellemek için çalıştır.';
  displayed = false;
}

function addRow(process) {
  const row = document.createElement('tr');
  for (const [key, label] of [['id', 'İşlem ID'], ['arrival', 'Geliş zamanı'], ['burst', 'CPU süresi']]) {
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
  remove.setAttribute('aria-label', 'İşlemi sil');
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
  // Kısa dilimler okunabilir kalır; uzun çizelgeler kendi alanında kaydırılır.
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
    block.title = `${label}: ${start}–${finish} (${finish - start} birim)`;
    block.setAttribute('aria-label', block.title);
    block.append(element('span', label, 'segment-id'), element('span', start, 'tick'));
    if (index === result.timeline.length - 1) block.append(element('span', finish, 'tick end-tick'));
    $('#gantt').append(block);
    $('#trace-list').append(element('li', `${start}–${finish}: ${label} · ${finish - start} birim`));
  });
  for (const [id, color] of colors) {
    const item = element('span', undefined, 'legend-item');
    const dot = element('span', undefined, 'swatch');
    dot.style.background = color;
    item.append(dot, document.createTextNode(id));
    $('#legend').append(item);
  }
  if (idle > 0) $('#legend').append(element('span', '▧ Idle · CPU boş', 'legend-item'));
  $('#timeline-summary').textContent = `Bitiş: ${end} · CPU kullanımı: ${end - idle} · Boş süre: ${idle}`;
  $('#quantum-note').hidden = result.algorithm !== 'RR';
  $('#result-badge').textContent = result.algorithm === 'RR' ? `RR · q = ${result.quantum}` : result.algorithm;
  $('#results').hidden = false;
  $('#empty-state').hidden = true;
  $('#error-message').hidden = true;
  $('#input-status').textContent = `${result.results.length} işlem için hesaplama tamamlandı.`;
  $('#result-status').textContent = `${result.algorithm} sonuçları güncellendi.`;
  displayed = true;
}

function runSimulation() {
  try {
    const processes = readProcesses();
    const algorithm = form.elements.algorithm.value;
    const quantum = $('#quantum').valueAsNumber;
    // Tarayıcının aşırı sayıda RR dilimiyle kilitlenmesini önler.
    if (algorithm === 'RR' && Number.isSafeInteger(quantum) && quantum > 0
        && processes.reduce((sum, p) => sum + Math.ceil(p.burst / quantum), 0) > 5000) {
      throw new Error('Bu senaryo 5.000’den fazla RR dilimi oluşturuyor. CPU sürelerini azalt veya quantum değerini artır.');
    }
    render(simulate(processes, algorithm, quantum));
  } catch (error) {
    invalidate();
    $('#error-message').textContent = error.message;
    $('#error-message').hidden = false;
    $('#input-status').textContent = 'Girdileri kontrol edip tekrar çalıştır.';
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
