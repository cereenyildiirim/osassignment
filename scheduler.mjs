// Bu modül hem tarayıcıda hem Node.js'te çalışır; arayüze bağımlı değildir.
export const ALGORITHMS = ['FCFS', 'SJF', 'SRTF', 'RR'];

function validate(processes, algorithm, quantum) {
  if (!ALGORITHMS.includes(algorithm)) throw new Error('Geçerli bir algoritma seçin.');
  if (!Array.isArray(processes) || processes.length === 0) {
    throw new Error('En az bir işlem ekleyin.');
  }
  const ids = new Set();
  let totalBurst = 0;
  let latestArrival = 0;
  const jobs = processes.map((process, index) => {
    if (!process || typeof process.id !== 'string' || !process.id.trim()) {
      throw new Error(`${index + 1}. işlemin adı boş olamaz.`);
    }
    const id = process.id.trim();
    if (ids.has(id)) throw new Error(`İşlem adları benzersiz olmalı: ${id}`);
    ids.add(id);
    if (!Number.isSafeInteger(process.arrival) || process.arrival < 0) {
      throw new Error(`${id}: geliş zamanı sıfır veya pozitif güvenli bir tam sayı olmalı.`);
    }
    if (!Number.isSafeInteger(process.burst) || process.burst <= 0) {
      throw new Error(`${id}: CPU süresi pozitif güvenli bir tam sayı olmalı.`);
    }
    totalBurst += process.burst;
    latestArrival = Math.max(latestArrival, process.arrival);
    return { id, arrival: process.arrival, burst: process.burst, index,
      remaining: process.burst, firstStart: null, completion: null };
  });
  if (!Number.isSafeInteger(latestArrival + totalBurst)) {
    throw new Error('Zaman değerlerinin toplamı JavaScript güvenli tam sayı sınırını aşıyor.');
  }
  if (algorithm === 'RR' && (!Number.isSafeInteger(quantum) || quantum <= 0)) {
    throw new Error('Round Robin quantum değeri pozitif güvenli bir tam sayı olmalı.');
  }
  return jobs;
}

// Son eşitlik bozucu işlem adı değil, giriş listesindeki sıradır.
const arrivalOrder = (a, b) => a.arrival - b.arrival || a.index - b.index;

export function simulate(processes, algorithm, quantum = 2) {
  const jobs = validate(processes, algorithm, quantum);
  const timeline = [];
  let time = 0;
  let completed = 0;

  function record(id, start, end) {
    const previous = timeline.at(-1);
    // RR'de ardışık aynı işlem dilimleri quantum sınırını korur.
    if (algorithm !== 'RR' && previous?.id === id && previous.end === start) {
      previous.end = end;
    } else {
      timeline.push({ id, start, end }); // id: null, CPU'nun boş olduğunu belirtir.
    }
  }

  function run(job, duration) {
    if (job.firstStart === null) job.firstStart = time;
    record(job.id, time, time + duration);
    time += duration;
    job.remaining -= duration;
    if (job.remaining === 0) {
      job.completion = time;
      completed++;
    }
  }

  if (algorithm === 'RR') {
    const pending = [...jobs].sort(arrivalOrder);
    const queue = [];
    let next = 0;
    const enqueueArrivals = () => {
      while (next < pending.length && pending[next].arrival <= time) {
        queue.push(pending[next++]);
      }
    };
    while (completed < jobs.length) {
      enqueueArrivals();
      if (queue.length === 0) {
        record(null, time, pending[next].arrival);
        time = pending[next].arrival;
        enqueueArrivals();
      }
      const job = queue.shift();
      run(job, Math.min(quantum, job.remaining));
      // Sınır anındaki gelişler, çalışan işlem yeniden eklenmeden önce alınır.
      enqueueArrivals();
      if (job.remaining > 0) queue.push(job);
    }
  } else {
    let current = null;
    while (completed < jobs.length) {
      const ready = jobs.filter(job => job.remaining > 0 && job.arrival <= time);
      if (ready.length === 0) {
        const nextArrival = Math.min(...jobs.filter(job => job.remaining > 0)
          .map(job => job.arrival));
        record(null, time, nextArrival);
        time = nextArrival;
        current = null;
        continue;
      }
      ready.sort((a, b) => {
        const difference = algorithm === 'SJF' ? a.burst - b.burst
          : algorithm === 'SRTF' ? a.remaining - b.remaining : 0;
        return difference || arrivalOrder(a, b);
      });
      let chosen = ready[0];
      if (algorithm === 'SRTF' && current?.remaining > 0
          && current.remaining === chosen.remaining) {
        chosen = current; // Eşit kalan sürede çalışan işlem kesilmez.
      }
      let duration = chosen.remaining;
      if (algorithm === 'SRTF') {
        const future = jobs.filter(job => job.arrival > time);
        if (future.length) {
          const nextArrival = Math.min(...future.map(job => job.arrival));
          duration = Math.min(duration, nextArrival - time);
        }
      }
      run(chosen, duration);
      current = chosen;
    }
  }

  const results = jobs.map(job => {
    const turnaround = job.completion - job.arrival;
    return { id: job.id, arrival: job.arrival, burst: job.burst,
      firstStart: job.firstStart, completion: job.completion,
      turnaround, waiting: turnaround - job.burst,
      response: job.firstStart - job.arrival };
  });
  const averages = Object.fromEntries(['turnaround', 'waiting', 'response'].map(key =>
    [key, results.reduce((sum, result) => sum + result[key], 0) / results.length]));
  return { algorithm, quantum: algorithm === 'RR' ? quantum : null,
    timeline, results, averages };
}
