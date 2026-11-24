/* Compliware pitch: editable content (presenter notes, document cards, previews) */
(function () {
  const CW = (window.CW = window.CW || {});

  /* ---------- Presenter notes, one entry per scene ---------- */
  CW.NOTES = [
    {
      title: '1 · Every project forgets',
      notes: [
        'Screen starts black. Press → once to start; stay silent while the lines type.',
        'After the logo assembles: “Compliware gives a construction project a memory, and a conscience.”',
      ],
    },
    {
      title: '2 · The problem',
      notes: [
        'A mega-project produces thousands of emails, RFIs, drawings and minutes, and nobody can hold all of it.',
        'Point at the amber card: one RFI about the spa sleeves on Level 2 is raised, then buried in the thread.',
        'The slab is poured without sleeves. Now it is core drilling, re-approvals and delay.',
        'Be explicit: this is an illustrative scenario on Oberoi – Wadi Safar, not a reported incident.',
      ],
    },
    {
      title: '3 · The shift',
      notes: [
        'Compliware turns every document into one connected project memory.',
        'Two engines: Zakerah (ذاكرة, “memory”) answers with sources. Mutabiq (مطابق, “compliant”) checks submittals against code.',
        'Bottom line: the same open RFI is flagged before the pour, not after.',
      ],
    },
    {
      title: '4 · Demo A: AHU route',
      notes: [
        'A question engineers ask every week. The answer takes seconds, not a morning in the inbox.',
        'Every answer carries its sources. Nothing is asserted without a document behind it.',
        'Clicker: → opens RFI-245, → opens Shop Drawing Rev B, → closes. (Or click a chip with the mouse.)',
      ],
    },
    {
      title: '5 · Demo B: Fire pump room',
      notes: [
        'Harder question: it needs history across documents, not one keyword match.',
        'Zakerah links the consultant comment (RFI-0847) to the decision in MM-112, page 3.',
        'Clicker: → opens RFI-0847, → opens MM-112, → closes.',
      ],
    },
    {
      title: '6 · Mutabiq: compliance',
      notes: [
        'A fire pump submittal is read line by line and checked against NFPA 20.',
        'Three checks pass. One fails: at 150% flow the pump delivers 62% of rated pressure; the minimum is 65%.',
        'Mutabiq cites the clause and drafts the review comment. The engineer stays the decision-maker.',
      ],
    },
    {
      title: '7 · The value',
      notes: [
        'Illustrative, per project per year: ~SAR 720k of engineering time recovered, ~SAR 600k of rework avoided.',
        'Together that is ~SAR 1.3M per project. The pilot exists to replace these assumptions with measured numbers.',
      ],
    },
    {
      title: '8 · The proof',
      notes: [
        'This is not a slide-ware idea: the prototype runs on real project documents.',
        'Research results: 94.3% retrieval accuracy and 91.7% compliance precision.',
        'Introduce Mohanad Elgayar and Mostafa Fouad.',
      ],
    },
    {
      title: '9 · The roadmap',
      notes: [
        'Memory is the foundation. Every workflow after it reuses the same project knowledge.',
        'Zakerah → Mutabiq → Submittal/RFI → Tender Engine → Estimation/QTO.',
      ],
    },
    {
      title: '10 · The ask',
      notes: [
        'Pause. Let the line land.',
        'Three asks: a 90-day pilot on Oberoi – Wadi Safar, secure read-only document access, and one executive sponsor.',
        'Close: “If it doesn’t pay for itself in 90 days, you’ll have the data to say so.”',
      ],
    },
  ];

  /* ---------- Document cards for the chaos / order scenes ---------- */
  // Order matters: column placement in scene 3 follows this order.
  CW.CARD_TYPES = [
    { key: 'email', label: 'EMAIL', items: [
      ['MAIL-3381', 'Re: Façade mock-up approval', '11 Feb · Consultant'],
      ['MAIL-3402', 'FW: Chiller delivery slot', '13 Feb · Supplier'],
      ['MAIL-3417', 'Re: Level 2 MEP coordination', '14 Feb · MEP lead'],
      ['MAIL-3450', 'Spa fit-out: revised layout', '18 Feb · Operator'],
      ['MAIL-3466', 'Re: Lift shaft tolerances', '19 Feb · Site'],
      ['MAIL-3491', 'Urgent: pump room access', '21 Feb · Fire services'],
    ]},
    { key: 'rfi', label: 'RFI', items: [
      ['RFI-219', 'RFI – Spa sleeves, Level 2', '12 Feb · Open · no response', true],
      ['RFI-231', 'Chilled water riser clash', '15 Feb · Closed'],
      ['RFI-238', 'Kitchen exhaust route', '16 Feb · Open'],
      ['RFI-245', 'AHU-03 route, Level 3', '20 Feb · Closed'],
      ['RFI-252', 'Ceiling void depth, L4', '22 Feb · Open'],
      ['RFI-260', 'Pool plant drainage', '25 Feb · Closed'],
    ]},
    { key: 'dwg', label: 'DWG', items: [
      ['S-210', 'Slab L2 reinforcement, Rev D', '10 Feb · Structural'],
      ['A-301', 'Building sections, Rev C', '12 Feb · Architect'],
      ['M-402', 'HVAC layout L3, Rev A', '14 Feb · MEP'],
      ['P-118', 'Drainage schematic, Rev B', '17 Feb · MEP'],
      ['E-220', 'Lighting layout L2', '19 Feb · MEP'],
      ['FP-105', 'Sprinkler layout, Rev C', '23 Feb · Fire'],
    ]},
    { key: 'mom', label: 'MoM', items: [
      ['MM-097', 'MEP coordination meeting', '09 Feb · Weekly'],
      ['MM-101', 'Design review: spa', '13 Feb · Design'],
      ['MM-104', 'Site progress meeting', '16 Feb · Weekly'],
      ['MM-108', 'Spa package workshop', '20 Feb · Operator'],
      ['MM-112', 'Fire services coordination', '24 Feb · Weekly'],
      ['MM-115', 'Pour sequence planning', '27 Feb · Site'],
    ]},
    { key: 'sub', label: 'SUB', items: [
      ['SUB-044', 'Fire dampers', '08 Feb · Approved'],
      ['SUB-061', 'Chillers', '12 Feb · Under review'],
      ['SUB-077', 'Spa equipment', '15 Feb · Rev 1'],
      ['SUB-089', 'Waterproofing membrane', '18 Feb · Approved'],
      ['SUB-102', 'Lighting fixtures', '21 Feb · Rev 2'],
      ['SUB-118', 'Fire pump set', '26 Feb · Under review'],
    ]},
    { key: 'ncr', label: 'NCR', items: [
      ['NCR-012', 'Rebar cover, L1 slab', '07 Feb · Open'],
      ['TQ-018', 'Sleeve sizing, wet areas', '11 Feb · Answered'],
      ['NCR-019', 'Formwork alignment, L2', '14 Feb · Closed'],
      ['TQ-024', 'Duct insulation spec', '17 Feb · Open'],
      ['SI-033', 'Spa relocation', '20 Feb · Issued'],
      ['TQ-029', 'Slab penetrations', '24 Feb · Open'],
    ]},
  ];

  /* ---------- Document previews (opened from source chips) ---------- */
  function rfi(o) {
    return `
    <div class="doc paper">
      <div class="d-top">
        <div><div class="d-kind">REQUEST FOR INFORMATION</div><div class="d-no">${o.no}</div></div>
        <div class="d-meta">Oberoi – Wadi Safar<br>Raised ${o.date}<br>Responded ${o.resp}</div>
      </div>
      <dl class="d-grid">
        <dt>Subject</dt><dd>${o.subject}</dd>
        <dt>Discipline</dt><dd>${o.disc}</dd>
        <dt>Reference</dt><dd>${o.ref}</dd>
      </dl>
      <div class="d-sec">Question</div>
      <div class="box"><p>${o.q}</p></div>
      <div class="d-sec">Consultant response</div>
      <div class="box"><p>${o.a}</p></div>
      <div class="stamp">CLOSED</div>
    </div>`;
  }

  CW.DOCS = {
    rfi245: {
      type: 'RFI', title: 'RFI-245 · AHU-03 supply duct route, Level 3',
      html: rfi({
        no: 'RFI-245', date: '20 Feb 2026', resp: '24 Feb 2026',
        subject: 'AHU-03 supply duct route: clash with structure at Level 3',
        disc: 'Mechanical / Structural', ref: 'M-402 Rev A · S-310 Rev C',
        q: 'The 1200 × 600 supply duct from AHU-03 crosses transfer beam TB-3.07 on grid C, between grids 1 and 2, on Level 3. Please confirm an alternative route.',
        a: '<mark>The duct shall be rerouted around the end of transfer beam TB-3.07, below the beam soffit, to avoid the structural clash on Level 3.</mark> The contractor to reissue the MEP shop drawing showing the revised route (Rev B) for approval.',
      }),
    },
    sdrevb: {
      type: 'DWG', title: 'Shop Drawing MEP-SD-L3-021 · Rev B',
      html: `
      <div class="drawing">
        <svg viewBox="0 0 1180 780" font-family="IBM Plex Mono, monospace">
          <defs>
            <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(140,190,255,.08)"/></pattern>
            <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="rgba(200,220,255,.55)" stroke-width="2"/></pattern>
          </defs>
          <rect width="1180" height="780" fill="url(#bp-grid)"/>
          <g stroke="rgba(160,200,255,.35)" stroke-dasharray="14 6 3 6">
            <line x1="200" y1="60" x2="200" y2="620"/><line x1="420" y1="60" x2="420" y2="620"/><line x1="640" y1="60" x2="640" y2="620"/><line x1="860" y1="60" x2="860" y2="620"/><line x1="1080" y1="60" x2="1080" y2="620"/>
            <line x1="90" y1="150" x2="1130" y2="150"/><line x1="90" y1="330" x2="1130" y2="330"/><line x1="90" y1="510" x2="1130" y2="510"/>
          </g>
          <g fill="none" stroke="rgba(160,200,255,.6)"><circle cx="200" cy="38" r="16"/><circle cx="420" cy="38" r="16"/><circle cx="640" cy="38" r="16"/><circle cx="860" cy="38" r="16"/><circle cx="1080" cy="38" r="16"/><circle cx="64" cy="150" r="16"/><circle cx="64" cy="330" r="16"/><circle cx="64" cy="510" r="16"/></g>
          <g fill="rgba(200,225,255,.85)" font-size="15" text-anchor="middle"><text x="200" y="43">A</text><text x="420" y="43">B</text><text x="640" y="43">C</text><text x="860" y="43">D</text><text x="1080" y="43">E</text><text x="64" y="155">1</text><text x="64" y="335">2</text><text x="64" y="515">3</text></g>
          <rect x="622" y="120" width="36" height="300" fill="url(#hatch)" stroke="rgba(220,235,255,.8)" stroke-width="1.5"/>
          <text x="672" y="140" fill="rgba(220,235,255,.9)" font-size="14">TB-3.07 (transfer beam, 1200 deep)</text>
          <rect x="96" y="226" width="70" height="88" fill="rgba(59,232,255,.08)" stroke="#7ff1ff" stroke-width="1.5"/>
          <text x="131" y="276" fill="#7ff1ff" font-size="14" text-anchor="middle">AHU-03</text>
          <path d="M166 270 H1130" stroke="#ff4d5e" stroke-width="3" stroke-dasharray="12 9" fill="none" opacity=".85"/>
          <g transform="translate(640 270)"><circle r="26" fill="none" stroke="#ff4d5e" stroke-width="2.5"/><path d="M-12 -12 L12 12 M12 -12 L-12 12" stroke="#ff4d5e" stroke-width="3"/></g>
          <text x="700" y="250" fill="#ff8f9b" font-size="14">Rev A route · CLASH</text>
          <path d="M166 270 H560 Q580 270 580 290 V440 Q580 460 600 460 H690 Q710 460 710 440 V290 Q710 270 730 270 H1130" stroke="#3be8ff" stroke-width="7" fill="none" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(59,232,255,.8))"/>
          <text x="740" y="490" fill="#7ff1ff" font-size="15">Rev B route · below beam end, 1200 × 600</text>
          <path d="M540 420 q10 -30 40 -24 q16 -26 44 -10 q26 -20 50 4 q32 -8 40 22 q28 12 14 40 q14 28 -16 40 q-6 30 -40 24 q-20 26 -48 8 q-30 16 -48 -8 q-32 4 -36 -28 q-24 -20 0 -44 z" fill="none" stroke="#ffb547" stroke-width="2"/>
          <g transform="translate(548 400)"><path d="M0 -22 L20 12 L-20 12 Z" fill="#0a2440" stroke="#ffb547" stroke-width="2"/><text y="8" fill="#ffb547" font-size="16" text-anchor="middle" font-weight="600">B</text></g>
          <g transform="translate(700 640)">
            <rect width="450" height="118" fill="rgba(4,14,30,.85)" stroke="rgba(160,200,255,.6)"/>
            <line x1="0" y1="40" x2="450" y2="40" stroke="rgba(160,200,255,.4)"/><line x1="300" y1="40" x2="300" y2="118" stroke="rgba(160,200,255,.4)"/>
            <text x="16" y="27" fill="#e6f1ff" font-size="16" font-weight="600">MEP-SD-L3-021 · Rev B</text>
            <text x="16" y="66" fill="#b9cadf" font-size="13">AHU-03 supply duct route</text>
            <text x="16" y="88" fill="#b9cadf" font-size="13">Level 3 · Scale 1:50</text>
            <text x="16" y="108" fill="#ffb547" font-size="13">Rev B: rerouted per RFI-245</text>
            <text x="316" y="66" fill="#b9cadf" font-size="13">Oberoi –</text><text x="316" y="88" fill="#b9cadf" font-size="13">Wadi Safar</text>
          </g>
        </svg>
      </div>`,
    },
    rfi0847: {
      type: 'RFI', title: 'RFI-0847 · Fire pump room clear height',
      html: rfi({
        no: 'RFI-0847', date: '02 Mar 2026', resp: '06 Mar 2026',
        subject: 'Fire pump room (B1): clear ceiling height',
        disc: 'Fire protection / Architecture', ref: 'Consultant comment C-14 on FP-201 Rev A',
        q: 'Consultant comment C-14 notes insufficient clearance above the pump discharge header and for maintenance lifting in the fire pump room. Please confirm the required clear ceiling height.',
        a: '<mark>Increase the clear ceiling height of the fire pump room from 3.5 m to 4.0 m.</mark> Architect to revise sections A-305 and A-306; structure to confirm the B1 slab soffit level.',
      }),
    },
    mm112: {
      type: 'MoM', title: 'Meeting Minutes MM-112 · Page 3',
      html: `
      <div class="doc paper">
        <div class="d-top">
          <div><div class="d-kind">MINUTES OF MEETING</div><div class="d-no">MM-112</div></div>
          <div class="d-meta">Fire services coordination<br>24 Feb 2026 · Site office<br>Page 3 of 6</div>
        </div>
        <table>
          <thead><tr><th style="width:70px">Item</th><th>Discussion / decision</th><th style="width:130px">Action</th><th style="width:100px">Due</th></tr></thead>
          <tbody>
            <tr><td>3.1</td><td>Sprinkler zoning, podium levels: layout accepted subject to hydraulic calculation update.</td><td>MEP</td><td>03 Mar</td></tr>
            <tr><td>3.2</td><td>Fire alarm interface with BMS: protocol confirmed.</td><td>ELV</td><td>05 Mar</td></tr>
            <tr><td>3.3</td><td>Jockey pump location: no change.</td><td>—</td><td>—</td></tr>
            <tr class="hot"><td>3.4</td><td>Fire pump room (B1): following the consultant’s comment (RFI-0847), <mark>the clear ceiling height is revised from 3.5 m to 4.0 m.</mark> Architect to update sections; structure to confirm soffit.</td><td>Architect / Structure</td><td>10 Mar</td></tr>
            <tr><td>3.5</td><td>Fire pump submittal SUB-118 to be resubmitted with test curve.</td><td>Contractor</td><td>12 Mar</td></tr>
          </tbody>
        </table>
        <div class="pg">MM-112 · Page 3 of 6</div>
      </div>`,
    },
  };
})();
