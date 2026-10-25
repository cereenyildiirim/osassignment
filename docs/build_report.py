"""Build the assignment report. Requires Node.js and Python ReportLab."""

from pathlib import Path
import json
import argparse
import re
import subprocess
from html import unescape
from xml.sax.saxutils import escape

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Expected values were worked out before the scheduling engine was implemented.
MANUAL = {'A': {'FCFS': ([('P1', 0, 8), ('P2', 8, 12), ('P3', 12, 14), ('P4', 14, 15)],
                [[0, 8, 8, 0, 0], [8, 12, 11, 7, 7], [12, 14, 12, 10, 10], [14, 15, 11, 10, 10]],
                [10.5, 6.75, 6.75]),
       'SJF': ([('P1', 0, 8), ('P4', 8, 9), ('P3', 9, 11), ('P2', 11, 15)],
               [[0, 8, 8, 0, 0], [11, 15, 14, 10, 10], [9, 11, 9, 7, 7], [8, 9, 5, 4, 4]],
               [9, 5.25, 5.25]),
       'SRTF': ([('P1', 0, 1),
                 ('P2', 1, 2),
                 ('P3', 2, 4),
                 ('P4', 4, 5),
                 ('P2', 5, 8),
                 ('P1', 8, 15)],
                [[0, 15, 15, 7, 0], [1, 8, 7, 3, 0], [2, 4, 2, 0, 0], [4, 5, 1, 0, 0]],
                [6.25, 2.5, 0]),
       'RR': ([('P1', 0, 2),
               ('P2', 2, 4),
               ('P3', 4, 6),
               ('P1', 6, 8),
               ('P4', 8, 9),
               ('P2', 9, 11),
               ('P1', 11, 13),
               ('P1', 13, 15)],
              [[0, 15, 15, 7, 0], [2, 11, 10, 6, 1], [4, 6, 4, 2, 2], [8, 9, 5, 4, 4]],
              [8.5, 4.75, 1.75])},
 'B': {'FCFS': ([(None, 0, 2),
                 ('P1', 2, 5),
                 ('P2', 5, 6),
                 (None, 6, 8),
                 ('P3', 8, 10),
                 ('P4', 10, 11)],
                [[2, 5, 3, 0, 0], [5, 6, 4, 3, 3], [8, 10, 2, 0, 0], [10, 11, 2, 1, 1]],
                [2.75, 1, 1]),
       'SJF': ([(None, 0, 2),
                ('P2', 2, 3),
                ('P1', 3, 6),
                (None, 6, 8),
                ('P3', 8, 10),
                ('P4', 10, 11)],
               [[3, 6, 4, 1, 1], [2, 3, 1, 0, 0], [8, 10, 2, 0, 0], [10, 11, 2, 1, 1]],
               [2.25, 0.5, 0.5]),
       'SRTF': ([(None, 0, 2),
                 ('P2', 2, 3),
                 ('P1', 3, 6),
                 (None, 6, 8),
                 ('P3', 8, 10),
                 ('P4', 10, 11)],
                [[3, 6, 4, 1, 1], [2, 3, 1, 0, 0], [8, 10, 2, 0, 0], [10, 11, 2, 1, 1]],
                [2.25, 0.5, 0.5]),
       'RR': ([(None, 0, 2),
               ('P1', 2, 4),
               ('P2', 4, 5),
               ('P1', 5, 6),
               (None, 6, 8),
               ('P3', 8, 10),
               ('P4', 10, 11)],
              [[2, 6, 4, 1, 0], [4, 5, 3, 2, 2], [8, 10, 2, 0, 0], [10, 11, 2, 1, 1]],
              [2.75, 1, 0.75])}}

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'
parser = argparse.ArgumentParser(description='Build the assignment report.')
parser.add_argument('--name', help='Optional student name for a private submission copy.')
parser.add_argument('--student-id', help='Optional student ID for a private submission copy.')
parser.add_argument('--degree', help='Optional degree description for the cover.')
parser.add_argument('--output', type=Path, default=DOCS / 'CSE513_Assignment_Report.pdf')
args = parser.parse_args()
# Personal copies stay outside the public checkout and must not be deployed by Pages.
if args.name or args.student_id or args.degree:
    destination = args.output.resolve()
    if destination.is_relative_to(ROOT):
        parser.error('Write personal submission copies outside the public repository.')
SITE = 'https://cereenyildiirim.github.io/osassignment/'
SOURCE = 'https://github.com/cereenyildiirim/osassignment/tree/feature'
script = """
import { simulate } from './scheduler.mjs';
import { WORKLOAD_A, WORKLOAD_B } from './workloads.mjs';
const data = {};
for (const [name, workload] of [['A', WORKLOAD_A], ['B', WORKLOAD_B]]) {
  data[name] = {};
  for (const algorithm of ['FCFS', 'SJF', 'SRTF', 'RR']) {
    data[name][algorithm] = simulate(workload, algorithm, 2);
  }
  data[name].quantums = [1, 2, 4].map(q => simulate(workload, 'RR', q));
}
console.log(JSON.stringify(data));
"""
data = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', script], cwd=ROOT, text=True))
subprocess.run(['node', '--test', 'scheduler.test.mjs'], cwd=ROOT, check=True)

font_dir = Path('/usr/share/fonts/truetype/dejavu')
if (font_dir / 'DejaVuSans.ttf').exists():
    pdfmetrics.registerFont(TTFont('Body', str(font_dir / 'DejaVuSans.ttf')))
    pdfmetrics.registerFont(TTFont('Bold', str(font_dir / 'DejaVuSans-Bold.ttf')))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold')
    body_font, bold_font = 'Body', 'Bold'
else:
    body_font, bold_font = 'Helvetica', 'Helvetica-Bold'

INK = colors.HexColor('#243d38')
MUTED = colors.HexColor('#61726a')
LIGHT = colors.HexColor('#edf3ef')
styles = {
    'body': ParagraphStyle('BodyText', fontName=body_font, fontSize=9, leading=13.5,
                           spaceAfter=8, textColor=INK),
    'title': ParagraphStyle('TitleText', fontName=bold_font, fontSize=19, leading=24,
                            spaceAfter=14, textColor=INK),
    'heading': ParagraphStyle('HeadingText', fontName=bold_font, fontSize=11, leading=16,
                              spaceBefore=9, spaceAfter=6, textColor=INK),
    'small': ParagraphStyle('SmallText', fontName=body_font, fontSize=7.5, leading=10.5,
                            spaceAfter=7, textColor=MUTED),
}
story, markdown = [], []


def plain(text):
    text = re.sub(r'<link href="([^"]+)"[^>]*>(.*?)</link>', r'[\2](\1)', text)
    text = text.replace('<br/>', '\n')
    text = text.replace('<b>', '**').replace('</b>', '**')
    return unescape(re.sub(r'<[^>]+>', '', text))


def p(text, style='body'):
    story.append(Paragraph(text, styles[style]))
    markdown.append(plain(text) + '\n')


def heading(text):
    story.append(Paragraph(text, styles['heading']))
    markdown.append('### ' + text + '\n')


def page(title):
    if story:
        story.append(PageBreak())
    story.append(Paragraph(title, styles['title']))
    markdown.append('## ' + title + '\n')


def number(value):
    return f'{value:g}' if isinstance(value, (int, float)) else str(value)


def table(rows, widths):
    cells = [[Paragraph(escape(number(cell)), styles['small']) for cell in row] for row in rows]
    block = Table(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
    block.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.6, INK),
        ('LINEBELOW', (0, 1), (-1, -1), 0.25, colors.HexColor('#dfe6e1')),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.extend([block, Spacer(1, 8)])
    for index, row in enumerate(rows):
        markdown.append('| ' + ' | '.join(number(cell).replace('|', '\\|') for cell in row) + ' |')
        if index == 0:
            markdown.append('| ' + ' | '.join('---' for _ in row) + ' |')
    markdown.append('')


class Gantt(Flowable):
    def __init__(self, timeline):
        super().__init__()
        self.timeline = timeline
        self.width, self.height = 484, 65

    def draw(self):
        canvas = self.canv
        scale = 480 / self.timeline[-1][2]
        palette = {'P1': '#c5dfd0', 'P2': '#c9def1', 'P3': '#efdbb5', 'P4': '#dbd1ec', None: '#e7ebe5'}
        for process_id, start, end in self.timeline:
            left, width = start * scale, (end - start) * scale
            canvas.setFillColor(colors.HexColor(palette[process_id]))
            canvas.setStrokeColor(colors.white)
            canvas.rect(left, 23, width, 24, fill=1, stroke=1)
            canvas.setFillColor(INK)
            canvas.setFont(body_font, 7.5)
            canvas.drawCentredString(left + width / 2, 32, process_id or 'Idle')
            canvas.setFont(body_font, 7)
            canvas.drawCentredString(left, 11, str(start))
        canvas.drawCentredString(480, 11, str(self.timeline[-1][2]))


def timeline_text(timeline):
    return ' | '.join(f'{start}-{end}: {process_id or "Idle"}' for process_id, start, end in timeline)


explanations = {
    ('A', 'FCFS'): 'P1 is the only ready process at time 0, so it runs to completion at time 8. P2, P3 and P4 then run in arrival order. P4 needs only one time unit but waits behind the longer jobs.',
    ('A', 'SJF'): 'P1 still runs first: the shorter jobs have not arrived at time 0, and SJF does not preempt. At time 8, all three waiting jobs are ready. Their burst lengths give the order P4, P3, P2.',
    ('A', 'SRTF'): 'At time 1, P1 has 7 units left and P2 needs 4, so P2 preempts P1. At time 2, P2 has 3 units left and P3 needs 2, so P3 takes over. P3 finishes at time 4, when P4 arrives. P4 runs next, followed by the remaining parts of P2 and P1.',
    ('A', 'RR'): 'With q=2, the queue at time 2 is P2, P3, P1. At time 4, P4 arrives before the unfinished P2 is requeued, giving P3, P1, P4, P2. P4 finishes after one unit. The final two P1 slices are kept separate so the quantum boundary at time 13 remains visible.',
    ('B', 'FCFS'): 'No process is ready during 0-2 or 6-8, so both intervals are idle. P1 and P2 arrive together at time 2; input order puts P1 first. P4 arrives while P3 is running but cannot preempt it.',
    ('B', 'SJF'): 'At time 2, P2 is shorter than P1 and runs first. P1 follows. After the idle interval, P3 starts at time 8 and finishes before P4 can run because SJF is non-preemptive.',
    ('B', 'SRTF'): 'The early decisions match SJF. At time 9, P3 has one unit left and the new P4 also needs one unit. Equal remaining time does not cause preemption, so P3 continues. The whole schedule therefore matches SJF.',
    ('B', 'RR'): 'P1 and P2 enter the queue in input order. P1 runs for two units, leaving one, then moves behind P2. P2 finishes at time 5 and P1 at time 6. Later, P4 joins the queue at time 9 and waits for P3 to finish its slice at time 10.',
}

# Cover: the website address is directly below the assignment heading.
cover_style = ParagraphStyle('CoverText', parent=styles['body'], alignment=1,
                            fontSize=12, leading=19, spaceAfter=14)
cover_title = ParagraphStyle('CoverTitle', parent=styles['title'], alignment=1,
                            fontSize=22, leading=30, spaceAfter=12)
cover_link = ParagraphStyle('CoverLink', parent=styles['body'], alignment=1,
                           fontSize=9, leading=14)
logo = Image(str(DOCS / 'assets' / 'gtu-logo.jpg'), width=250, height=160)
logo.hAlign = 'CENTER'
story.extend([Spacer(1, 35), logo, Spacer(1, 34)])
story.append(Paragraph('GEBZE TECHNICAL UNIVERSITY', cover_style))
story.append(Spacer(1, 28))
story.append(Paragraph('CSE513 Assignment 1<br/>CPU Scheduling Simulator', cover_title))
story.append(Paragraph(f'<link href="{SITE}" color="#17634d">{SITE}</link>', cover_link))
story.append(Spacer(1, 52))
markdown.extend(['# CSE513 Assignment 1: CPU Scheduling Simulator\n',
                 f'[Working website]({SITE})\n', 'Gebze Technical University\n'])
for text in [args.name, f'Student ID: {args.student_id}' if args.student_id else None, args.degree]:
    if text:
        story.append(Paragraph(escape(text), cover_style))
        markdown.append(text + '\n')

page('Model and local setup')
heading('Scheduling model')
p('The simulator compares FCFS, non-preemptive SJF, SRTF and Round Robin on one CPU. Each process has one CPU burst, with no I/O and zero context-switch cost. This is a policy model, not Ubuntu\'s actual scheduler.')
p('FCFS follows arrival order. SJF selects the shortest ready burst when the CPU becomes free. SRTF preempts only for a strictly shorter remaining time. RR uses a FIFO queue, adding boundary arrivals before requeuing an unfinished process. Other ties use arrival time, then input order. The CPU is idle only when no process is ready.')
heading('Metrics')
p('<b>Turnaround (TAT)</b> = completion - arrival<br/><b>Waiting (WT)</b> = turnaround - CPU burst<br/><b>Response (RT)</b> = first start - arrival')
p('Tables use A for arrival, B for burst, S for first start and C for completion. Intervals use [start, end), so 2-5 represents three time units.')
heading('Run locally')
p('Download the source ZIP from the repository or clone the feature branch. Open a terminal in the project folder and run:')
p('<b>python3 -m http.server 8000 --bind 127.0.0.1</b>')
p('Open <b>http://127.0.0.1:8000</b> in a modern browser. On Windows, <b>py -m http.server 8000 --bind 127.0.0.1</b> can be used instead. Stop the server with Ctrl+C. Python 3 is needed only to serve the files locally; no npm installation, backend or database is required. JavaScript modules should be opened through the server rather than by double-clicking index.html.')
p('Load Workload A or B, choose an algorithm, set the quantum for RR and click <b>Run simulation</b>. Processes can also be added, edited or removed. Node.js 22 or later is needed only for the tests: <b>node --test scheduler.test.mjs</b>. All 16 tests pass.')
p('The same local setup instructions, dependencies and limitations are documented in <b>README.md</b>, included with the source code.')
p(f'Source code: <link href="{SOURCE}" color="#17634d">github.com/cereenyildiirim/osassignment/tree/feature</link>')

for workload in ['A', 'B']:
    for algorithm in ['FCFS', 'SJF', 'SRTF', 'RR']:
        page(f'Workload {workload}: {algorithm}' + (' (q = 2)' if algorithm == 'RR' else ''))
        result = data[workload][algorithm]
        timeline, values, averages = MANUAL[workload][algorithm]
        p('Input: ' + '; '.join(f"{row['id']} (arrival {row['arrival']}, burst {row['burst']})" for row in result['results']) + '.')
        heading('Hand calculation')
        p(explanations[(workload, algorithm)])
        story.append(Gantt(timeline))
        p(timeline_text(timeline), 'small')
        expected = [[row['id'], row['arrival'], row['burst']] + metrics
                    for row, metrics in zip(result['results'], values)]
        headers = ['Process', 'A', 'B', 'S', 'C', 'TAT', 'WT', 'RT']
        table([headers] + expected, [61, 46, 46, 55, 55, 55, 55, 55])
        p('Hand-calculated averages: TAT = <b>' + number(averages[0]) + '</b>, WT = <b>' + number(averages[1]) + '</b>, RT = <b>' + number(averages[2]) + '</b>.')
        row = expected[1]
        _, arrival, burst, first, completion, tat, waiting, response = row
        p(f'For P2: TAT = {completion} - {arrival} = {tat}; WT = {tat} - {burst} = {waiting}; RT = {first} - {arrival} = {response}.')
        heading('Simulator output')
        actual = [[row[key] for key in ['id', 'arrival', 'burst', 'firstStart', 'completion', 'turnaround', 'waiting', 'response']] for row in result['results']]
        actual_timeline = [(row['id'], row['start'], row['end']) for row in result['timeline']]
        actual_averages = [result['averages'][key] for key in ['turnaround', 'waiting', 'response']]
        assert actual == expected and actual_timeline == timeline and actual_averages == averages
        table([headers] + actual, [61, 46, 46, 55, 55, 55, 55, 55])
        p('Output averages: TAT = ' + number(actual_averages[0]) + ', WT = ' + number(actual_averages[1]) + ', RT = ' + number(actual_averages[2]) + '.')
        heading('Comparison')
        p('Every execution interval, per-process metric and average matches the hand calculation. No discrepancy was found. The browser check also compares the displayed table and interval list with the engine output for this case.')

page('Additional tests')
heading('1. Idle CPU')
p('Input: A(arrival 2, burst 1), B(arrival 5, burst 1). Expected under all four algorithms: 0-2 Idle | 2-3 A | 3-5 Idle | 5-6 B. Both processes have TAT=1 and WT=RT=0. This checks that the initial gap and the gap between jobs appear in the timeline. Result: passed.')
heading('2. Simultaneous arrivals and a tie')
p('Input order: Z(arrival 0, burst 1), A(arrival 0, burst 1). Expected under all four algorithms: 0-1 Z | 1-2 A. Z has TAT=1 and WT=RT=0; A has TAT=2 and WT=RT=1. This catches implementations that sort tied processes by their IDs instead of their input positions. Result: passed.')
heading('3. SRTF preemption')
p('Input: A(arrival 0, burst 5), B(arrival 1, burst 1). Expected SRTF timeline: 0-1 A | 1-2 B | 2-6 A. A has TAT=6, WT=1, RT=0; B has TAT=1 and WT=RT=0. This checks preemption, preservation of remaining time and resumption of the longer job. Result: passed.')
heading('General correctness properties')
table([
    ['Property', 'Check'],
    ['Exact CPU burst', 'Add the durations of all slices for each process.'],
    ['No early execution', 'Each slice starts at or after the process arrival.'],
    ['No overlap', 'Each interval ends where the next interval starts. Idle gaps are explicit.'],
    ['Nonnegative WT and RT', 'Check both metrics in every result row.'],
    ['No avoidable idle time', 'No arrived, unfinished process exists during an idle interval.'],
], [135, 353])
p('These properties are checked for the eight assignment examples and the three additional workloads. Validation tests also reject empty lists, duplicate or blank IDs, invalid times and invalid quantum values. Run the suite with <b>node --test scheduler.test.mjs</b>.')

page('Analysis: results and quantum size')
heading('1. Which algorithm performs best for Workload A?')
table([['Algorithm', 'Average TAT', 'Average WT', 'Average RT']] +
      [[algorithm] + [data['A'][algorithm]['averages'][key] for key in ['turnaround', 'waiting', 'response']]
       for algorithm in ['FCFS', 'SJF', 'SRTF', 'RR']], [125, 121, 121, 121])
p('SRTF gives the lowest average waiting time, 2.5, and the lowest average response time, 0. P2 preempts P1, then P3 preempts P2. P4 arrives just as P3 finishes. Each process therefore starts at its arrival time in this workload. That explains the zero response average; it is not a general guarantee of SRTF.')
heading('2. What changes with RR quantum 1, 2 and 4?')
p('The following results use Workload A with three quantum values.')
p('<b>Workload A</b>')
table([['Quantum', 'Average TAT', 'Average WT', 'Average RT']] +
      [[run['quantum']] + [run['averages'][key] for key in ['turnaround', 'waiting', 'response']]
       for run in data['A']['quantums']], [125, 121, 121, 121])
p('For A, reducing q from 2 to 1 improves response from 1.75 to 0.75 but leaves waiting at 4.75 and turnaround at 8.5. A shorter quantum does not improve every metric. It gets processes their first CPU time sooner, but also spreads their work across more turns. Completion time depends on the resulting queue order, not just how soon a process first runs.')
p('These results assume zero switching cost. In a real system, extra context switches would add another cost to very small quantum values.')

page('Analysis: assumptions and verification')
heading('3. When do SJF and SRTF produce the same schedule?')
p('They agree when no arrival would force SRTF to interrupt the process selected by SJF. In particular, no newly arriving job may be strictly shorter than the running job\'s remaining time. If every job is ready at the start, this condition is satisfied. Workload B is another example: P4 arrives when P3 has one unit left, so the equal-time rule lets P3 finish.')
heading('4. Why estimate CPU bursts in a real operating system?')
p('A real operating system usually does not know when a program will finish its next CPU burst or request I/O. That depends on the program and its input. A scheduler can estimate future bursts from earlier measurements. Here, the user supplies each burst in advance, so the simulator can use the exact value.')
heading('5. Can SJF or SRTF cause starvation?')
p('Yes. A continuing stream of short jobs can repeatedly push a long job out of the SJF selection or interrupt it under SRTF. The assignment workloads are finite, so arrivals eventually stop. With finite bursts and no avoidable idle time, every process eventually finishes, even if a long process waits much longer than the others.')
heading('6. Implementation mistake')
p('No actual scheduling defect has been recorded during development so far.')
heading('AI assistance')
p('OpenAI Codex was used to explain the scheduling rules, work through examples, help implement the simulator and edit the report. The generated code and calculations were checked against hand-calculated schedules, the Node.js tests and browser checks.')


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#dfe6e1'))
    canvas.line(54, 44, 541, 44)
    canvas.setFont(body_font, 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(54, 31, 'CSE513 Assignment 1 | CPU Scheduling Simulator')
    canvas.drawRightString(541, 31, str(document.page))
    canvas.restoreState()


output = args.output.resolve()
output.parent.mkdir(parents=True, exist_ok=True)
document = SimpleDocTemplate(str(output), pagesize=(595.28, 841.89),
    leftMargin=54, rightMargin=54, topMargin=45, bottomMargin=58,
    title='CSE513 Assignment 1: CPU Scheduling Simulator', author='')
document.build(story, onFirstPage=footer, onLaterPages=footer)
text_output = DOCS / 'report.md' if output == (DOCS / 'CSE513_Assignment_Report.pdf').resolve() else output.with_suffix('.md')
text_output.write_text('\n'.join(markdown), encoding='utf-8')
print(f'Created {output}')
