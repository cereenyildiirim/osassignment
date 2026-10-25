# CPU Scheduling Simulator

A browser-based simulator for CSE513 Assignment 1. It compares FCFS, non-preemptive SJF, SRTF and Round Robin on a single CPU.

[Open the simulator](https://cereenyildiirim.github.io/osassignment/) · [Assignment report](docs/CSE513_Assignment_Report.pdf)

## Run locally

From the project directory, start a static file server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000` in a modern browser. Stop the server with Ctrl+C.
Use a local server rather than opening `index.html` directly, since the app uses JavaScript modules.
No npm install, backend or database is needed.

## Use the simulator

Load Workload A or B, or enter your own processes. Each process needs a unique ID, a nonnegative integer arrival time and a positive integer CPU burst. Select an algorithm, set the quantum if using Round Robin, and click **Run simulation**.

The results include a Gantt chart, per-process metrics and average turnaround, waiting and response times. Changing an input hides the old results until you run again. The example buttons load and run a workload using the selected algorithm.

## Tests

With Node.js 22 or later:

```sh
node --test scheduler.test.mjs
```

The 16 tests cover the hand-calculated A/B schedules and metrics, idle time, tie-breaking, SRTF preemption, RR boundary arrivals and invalid input. They also check CPU burst totals, arrival constraints, non-overlapping intervals and nonnegative waiting and response times.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page structure and responsive layout |
| `app.mjs` | Reads inputs and displays simulation results |
| `scheduler.mjs` | Scheduling algorithms, validation and metrics |
| `workloads.mjs` | Assignment workloads A and B |
| `scheduler.test.mjs` | Scheduling tests |
| `docs/` | Report, editable text and PDF generation script |

## Model and limits

- One CPU, one burst per process, no I/O and zero context-switch cost. This is not Ubuntu's scheduler.
- Ties use arrival time, then input order. SRTF keeps the running process on equal remaining time.
- RR enqueues arrivals at a quantum boundary before requeuing the unfinished running process. Consecutive slices remain separate in the chart.
- Short chart blocks have a minimum width for readability. Use the time labels or **Execution intervals** for exact durations; charts and tables scroll on narrow screens.
- The UI rejects workloads requiring more than 5,000 RR slices. Time values must fit JavaScript's safe integer range.
- Process colors repeat after six IDs. Labels identify each process.

## Report

The [English report](docs/CSE513_Assignment_Report.pdf) includes the eight worked examples, additional tests and analysis. Its remaining draft item is the account of a development mistake in analysis question 6.

To regenerate the PDF and editable Markdown, install Python's `reportlab` package and run:

```sh
python3 docs/build_report.py
```

ReportLab is only needed to build the report, not to run the simulator.

## Deployment

GitHub Pages publishes the root of the `feature` branch. Pushing changes to that branch updates the live site. `main` will be updated when development is finished.
