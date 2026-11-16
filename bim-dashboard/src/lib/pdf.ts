/** Data-driven PDF reports (jsPDF + autotable). Charts are drawn as vector graphics from the same report data. */
import type { jsPDF as JsPDF } from 'jspdf';
import type { ReportData, ReportSettings, ReportType } from './report';
import { REPORT_TYPES } from './report';
import { DISCIPLINES, SEVERITIES, SEVERITY_COLOR } from './constants';
import { fmtDate } from './dates';
import type { MatrixCell, ClashMatrix } from './metrics';

const NAVY: [number, number, number] = [14, 23, 40];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [88, 103, 128];
const LINE: [number, number, number] = [222, 228, 238];
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (h: string, t: number): [number, number, number] => { const c = hex(h); return c.map((v) => Math.round(255 - (255 - v) * t)) as [number, number, number]; };

export interface PdfMeta { projectName: string; projectCode: string; periodLabel: string; asOf: string; isDemo: boolean; companyName: (id: string) => string }

export async function generatePdf(type: ReportType, r: ReportData, st: ReportSettings, meta: PdfMeta) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
  const title = REPORT_TYPES.find((t) => t.id === type)!.title;
  let y = 0;

  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(title, M, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`${meta.projectName}  ·  ${meta.projectCode}`, M, 16);
    doc.text(`Reporting period: ${meta.periodLabel}  ·  As at ${fmtDate(meta.asOf)}`, W - M, 10, { align: 'right' });
    doc.text(`Prepared by: ${st.preparedBy || '—'}  ·  Issue date: ${fmtDate(st.issueDate)}`, W - M, 16, { align: 'right' });
    if (meta.isDemo) {
      doc.setFillColor(250, 178, 25); doc.rect(0, 22, W, 5, 'F'); doc.setTextColor(...INK); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text('DEMO DATA — fictional project and records generated for demonstration. Figures do not represent actual project performance.', W / 2, 25.6, { align: 'center' });
    }
    y = meta.isDemo ? 33 : 29;
  };
  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
      doc.text(`BIM Coordination Center · ${title} · generated ${new Date().toLocaleString('en-GB')}`, M, H - 6);
      doc.text(`Page ${i} of ${n}`, W - M, H - 6, { align: 'right' });
    }
  };
  const newPage = () => { doc.addPage(); header(); };
  const ensure = (h: number) => { if (y + h > H - 14) newPage(); };
  const h2 = (t: string) => { ensure(14); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(t, M, y); doc.setDrawColor(...LINE); doc.line(M, y + 1.5, W - M, y + 1.5); y += 6; };
  const bullets = (lines: string[], x = M, w = W - 2 * M) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
    for (const l of lines.filter(Boolean)) { const wrapped = doc.splitTextToSize(l, w - 5); ensure(wrapped.length * 4.2 + 1); doc.text('•', x, y); doc.text(wrapped, x + 4, y); y += wrapped.length * 4.2 + 1; }
    y += 2;
  };
  const table = (head: string[], body: (string | number)[][], opts: Record<string, unknown> = {}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTable(doc as any, { startY: y, head: [head], body, margin: { left: M, right: M, top: meta.isDemo ? 33 : 29 }, styles: { fontSize: 7.8, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.1 }, headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [246, 248, 252] }, didDrawPage: () => { /* header redrawn below */ }, ...opts });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  };
  const kpiTiles = (items: { label: string; value: string; prev?: string }[], cols = 6) => {
    const gap = 3, w = (W - 2 * M - gap * (cols - 1)) / cols, h = 17;
    items.forEach((k, i) => {
      const cx = M + (i % cols) * (w + gap), cy = y + Math.floor(i / cols) * (h + gap);
      doc.setDrawColor(...LINE); doc.setFillColor(248, 250, 253); doc.roundedRect(cx, cy, w, h, 1.5, 1.5, 'FD');
      doc.setFontSize(6.6); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'bold'); doc.text(doc.splitTextToSize(k.label.toUpperCase(), w - 4)[0], cx + 2, cy + 4.5);
      doc.setFontSize(13); doc.setTextColor(...INK); doc.text(k.value, cx + 2, cy + 11.5);
      if (k.prev !== undefined) { doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(`previous period: ${k.prev}`, cx + 2, cy + 15); }
    });
    y += Math.ceil(items.length / cols) * (h + gap) + 3;
  };
  const barChart = (x: number, top: number, w: number, h: number, labels: string[], series: { name: string; values: number[]; color: string }[], ttl: string) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(ttl, x, top);
    const cy = top + 4, ch = h - 14, max = Math.max(1, ...series.flatMap((s) => s.values));
    doc.setDrawColor(...LINE); for (let i = 0; i <= 4; i++) { const yy = cy + ch - (ch * i) / 4; doc.line(x + 8, yy, x + w, yy); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.text(String(Math.round((max * i) / 4)), x + 6, yy + 1, { align: 'right' }); }
    const gw = (w - 10) / labels.length, bw = Math.min(5, (gw - 2) / series.length);
    labels.forEach((l, i) => {
      series.forEach((s, j) => { const v = s.values[i] ?? 0, bh = (v / max) * ch; doc.setFillColor(...hex(s.color)); if (bh > 0) doc.rect(x + 10 + i * gw + (gw - bw * series.length) / 2 + j * bw, cy + ch - bh, bw - 0.4, bh, 'F'); });
      doc.setFontSize(6); doc.setTextColor(...MUTED); doc.text(l, x + 10 + i * gw + gw / 2, cy + ch + 3.5, { align: 'center' });
    });
    series.forEach((s, j) => { doc.setFillColor(...hex(s.color)); doc.rect(x + 10 + j * 30, cy + ch + 6, 3, 2, 'F'); doc.setTextColor(...INK); doc.text(s.name, x + 14 + j * 30, cy + ch + 7.7); });
  };
  const lineChart = (x: number, top: number, w: number, h: number, labels: string[], series: { name: string; values: number[]; color: string }[], ttl: string) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(ttl, x, top);
    const cy = top + 4, ch = h - 14;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.1);
    for (let i = 0; i <= 4; i++) { const yy = cy + ch - (ch * i) / 4; doc.line(x + 10, yy, x + w, yy); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.text(`${i * 25}%`, x + 8, yy + 1, { align: 'right' }); }
    const px = (i: number) => x + 10 + ((w - 12) * i) / Math.max(1, labels.length - 1);
    labels.forEach((l, i) => { doc.setFontSize(6); doc.setTextColor(...MUTED); doc.text(l, px(i), cy + ch + 3.5, { align: 'center' }); });
    series.forEach((s, j) => {
      doc.setDrawColor(...hex(s.color)); doc.setLineWidth(0.6);
      for (let i = 1; i < s.values.length; i++) doc.line(px(i - 1), cy + ch - (s.values[i - 1] / 100) * ch, px(i), cy + ch - (s.values[i] / 100) * ch);
      doc.setFillColor(...hex(s.color)); doc.rect(x + 10 + j * 38, cy + ch + 6, 3, 2, 'F'); doc.setTextColor(...INK); doc.text(s.name, x + 14 + j * 38, cy + ch + 7.7);
    });
    doc.setLineWidth(0.1);
  };
  const matrixTable = (m: ClashMatrix, ttl: string) => {
    ensure(70);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(`${ttl} — ${m.grandTotal} unique clashes`, M, y); y += 2;
    const codes: string[] = DISCIPLINES.map((d) => d.code);
    const cell = (a: string, b: string): MatrixCell | undefined => { const ia = codes.indexOf(a), ib = codes.indexOf(b); return m.cells.get(ia <= ib ? `${a}|${b}` : `${b}|${a}`); };
    const body = codes.map((r, ri) => [r, ...codes.map((c, ci) => (ci <= ri ? (cell(r, c)?.count ?? 0) || '' : '')), m.disciplineTotals[r] ?? 0]);
    table(['', ...codes, 'Involved'], body as (string | number)[][], {
      styles: { fontSize: 8, halign: 'center', cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.1 }, columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (d: any) => {
        if (d.section !== 'body' || d.column.index === 0 || d.column.index > codes.length) return;
        const ri = d.row.index, ci = d.column.index - 1;
        if (ci > ri) { d.cell.styles.fillColor = [255, 255, 255]; return; }
        const c = cell(codes[ri], codes[ci]);
        if (c?.count) { d.cell.styles.fillColor = mix(SEVERITY_COLOR[c.worst ?? 'Low'], 0.25 + 0.6 * (c.count / Math.max(1, m.maxCount))); d.cell.styles.fontStyle = 'bold'; }
      },
    });
  };
  const outstandingTable = () => table(['ID', 'Description', 'Pair', 'Location', 'Severity', 'Status', 'Responsible', 'Due', 'Days'],
    r.outstanding.map((o) => [o.id, o.description, o.pair, o.location, o.severity, o.status, meta.companyName(o.responsible), `${fmtDate(o.due)}${o.overdue ? ' (OVERDUE)' : ''}`, o.days]),
    { columnStyles: { 1: { cellWidth: 80 } } });

  header();
  const obs = st.observations.split('\n').map((s) => s.trim()).filter(Boolean);
  const acts = st.actions.split('\n').map((s) => s.trim()).filter(Boolean);
  const weeks = r.weekly.map((w) => w.label);

  if (type === 'executive' || type === 'weekly') {
    h2('KPI summary');
    kpiTiles(r.kpis);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    doc.text(`Overall BIM health: ${r.health.score === null ? 'n/a' : Math.round(r.health.score)} / 100 — ${r.health.rating}`, M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(r.health.components.map((c) => `${c.label} ${c.value.toFixed(0)}%`).join('  ·  '), M, y + 4.5); y += 11;
    ensure(62);
    const cw = (W - 2 * M - 8) / 2;
    barChart(M, y, cw, 60, weeks, [{ name: 'New', values: r.weekly.map((w) => w.newClashes), color: SERIES[1] }, { name: 'Resolved', values: r.weekly.map((w) => w.resolved), color: SERIES[2] }], 'Weekly clash resolution');
    lineChart(M + cw + 8, y, cw, 60, weeks, [{ name: 'Overall progress', values: r.weekly.map((w) => w.overall), color: SERIES[0] }, { name: 'Resolution rate', values: r.weekly.map((w) => w.resolutionRate), color: SERIES[2] }, { name: 'Model coordination', values: r.weekly.map((w) => w.coordination), color: SERIES[6] }], 'BIM performance trend');
    y += 66;
    if (type === 'weekly') {
      h2('Movement this period');
      table(['Metric', 'Start of period', 'End of period', 'Change'], [
        ['Open clashes', r.pk.open, r.ck.open, r.ck.open - r.pk.open], ['Closed clashes', r.pk.closed, r.ck.closed, r.ck.closed - r.pk.closed],
        ['Critical (open)', r.pk.critical, r.ck.critical, r.ck.critical - r.pk.critical], ['Overdue clashes', r.pk.overdue, r.ck.overdue, r.ck.overdue - r.pk.overdue],
        ['New clashes in period', '', r.ck.newInPeriod, ''], ['Resolved in period', '', r.ck.resolvedInPeriod, ''],
      ]);
      h2('Progress components');
      table(['Component', 'Value'], [['Model development', `${r.prog.model.toFixed(1)}%`], ['Model coordination', `${r.prog.coordination.toFixed(1)}%`], ['Clash resolution', `${r.prog.clash.toFixed(1)}%`], ['Deliverables approved', `${r.prog.deliverables.toFixed(1)}%`], ['Overall', `${r.prog.overall.toFixed(1)}%`]]);
    }
    h2('Key observations'); bullets(obs);
    h2('Action items'); bullets(acts);
    h2(`Outstanding issues — critical, high and overdue clashes (${r.outstanding.length} shown of ${r.openCount} open)`); outstandingTable();
    if (r.risks.length) { h2('Top open risks'); table(['ID', 'Risk', 'Severity', 'Score', 'Owner', 'Mitigation', 'Target'], r.risks.map((k) => [k.id, k.title, k.severity, k.score, meta.companyName(k.owner), k.mitigation, fmtDate(k.target)]), { columnStyles: { 5: { cellWidth: 90 } } }); }
  }

  if (type === 'matrix') {
    h2('Clash matrix summary');
    kpiTiles([
      { label: 'Total clashes', value: String(r.matrices.total.grandTotal) }, { label: 'Open', value: String(r.matrices.open.grandTotal) },
      { label: 'Critical (open)', value: String(r.matrices.critical.grandTotal) }, { label: 'Overdue', value: String(r.matrices.overdue.grandTotal) },
      { label: 'Resolution rate', value: `${r.ck.resolutionRate.toFixed(1)}%` }, { label: 'Repeat detections (open)', value: String(r.ck.repeated) },
    ]);
    matrixTable(r.matrices.open, 'Open clashes');
    doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text('Lower triangle — each discipline pair counted once; diagonal = same-discipline clashes. Cell shade = worst severity, intensity = count. “Involved” counts a clash for both disciplines.', M, y - 3); y += 2;
    newPage();
    matrixTable(r.matrices.critical, 'Critical open clashes');
    matrixTable(r.matrices.overdue, 'Overdue clashes');
    h2('Coordination hotspots (open, severity-weighted)');
    table(['Pair', 'Open', ...SEVERITIES, 'Hard', 'Soft', 'Clearance', 'Score'], [...r.matrices.open.cells.values()].sort((a, b) => b.score - a.score).slice(0, 12).map((c) => [`${c.a} / ${c.b}`, c.count, ...SEVERITIES.map((s) => c.bySeverity[s]), c.byType.Hard, c.byType.Soft, c.byType.Clearance, c.score]));
    h2('Key observations'); bullets(obs);
    h2('Action items'); bullets(acts);
    h2(`Outstanding clashes (${r.outstanding.length} shown of ${r.openCount} open)`); outstandingTable();
  }

  if (type === 'monthly') {
    h2('KPI summary'); kpiTiles(r.kpis);
    ensure(62);
    const cw = (W - 2 * M - 8) / 2, months = r.monthly.map((m) => m.label);
    barChart(M, y, cw, 60, months, [{ name: 'New clashes', values: r.monthly.map((m) => m.newClashes), color: SERIES[1] }, { name: 'Resolved', values: r.monthly.map((m) => m.resolved), color: SERIES[2] }], 'Monthly clash flow');
    lineChart(M + cw + 8, y, cw, 60, months, [{ name: 'Overall progress', values: r.monthly.map((m) => m.overall), color: SERIES[0] }, { name: 'Resolution rate', values: r.monthly.map((m) => m.resolutionRate), color: SERIES[2] }], 'Monthly performance trend');
    y += 66;
    h2('Monthly performance');
    table(['Month', 'New clashes', 'Resolved', 'Open at month end', 'Resolution rate', 'Deliverables submitted', 'Deliverables approved', 'Overall progress'], r.monthly.map((m) => [m.label, m.newClashes, m.resolved, m.open, `${m.resolutionRate}%`, m.deliverablesSubmitted, m.deliverablesApproved, `${m.overall}%`]));
    h2('Model coordination by discipline');
    table(['Discipline', 'Models', 'Approved', 'Avg. development'], r.discProgress.map((d) => [d.code, d.models, d.approved, d.progress === null ? 'n/a' : `${d.progress.toFixed(0)}%`]));
    h2('Deliverables');
    table(['In plan', 'Due to date', 'Submitted', 'Approved', 'Rejected', 'Overdue', 'On-time rate'], [[r.dk.total, r.dk.due, r.dk.submitted, r.dk.approved, r.dk.rejected, r.dk.overdue, `${r.dk.onTimeRate.toFixed(0)}%`]]);
    h2(`Compliance & quality — overall ${r.compOverall.score === null ? 'not verified' : r.compOverall.score.toFixed(1) + '%'} (${r.compOverall.verified}/${r.compOverall.total} categories verified)`);
    table(['Category', 'Status', 'Score', 'Checks', 'Pass', 'Obs.', 'Fail', 'Open observations'], r.comp.map((c) => [c.category, c.verified ? 'Verified' : 'NOT VERIFIED — no evidence', c.score === null ? '—' : `${c.score.toFixed(0)}%`, c.checks, c.pass, c.observation, c.fail, c.openObservations]));
    if (r.risks.length) { h2('Top open risks'); table(['ID', 'Risk', 'Severity', 'Score', 'Owner', 'Mitigation', 'Target'], r.risks.map((k) => [k.id, k.title, k.severity, k.score, meta.companyName(k.owner), k.mitigation, fmtDate(k.target)]), { columnStyles: { 5: { cellWidth: 90 } } }); }
    h2('Key observations'); bullets(obs);
    h2('Action items'); bullets(acts);
    h2('Outstanding issues'); outstandingTable();
  }

  // Redraw header on pages that autotable created
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) { doc.setPage(i); const saveY = y; header(); y = saveY; }
  footer();
  return doc as JsPDF;
}
