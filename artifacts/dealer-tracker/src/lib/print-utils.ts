interface PrintInspectionItem {
  category: string;
  item: string;
  status: string;
  notes?: string;
}

export function printInspection(title: string, items: PrintInspectionItem[], categories: string[]) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) { alert("Please allow popups to use the print feature."); return; }

  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const statusStyle: Record<string, string> = {
    pass:     "background:#16a34a;color:#fff;",
    fail:     "background:#dc2626;color:#fff;",
    advisory: "background:#f97316;color:#fff;",
    na:       "background:#d1d5db;color:#6b7280;",
    pending:  "background:#fef08a;color:#78716c;",
  };
  const statusLabel: Record<string, string> = {
    pass: "PASS", fail: "FAIL", advisory: "ADVISORY", na: "N/A", pending: "PENDING",
  };

  const categoryBlocks = categories.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    if (catItems.length === 0) return "";

    const hasFail = catItems.some(i => i.status === "fail");
    const hasAdvisory = catItems.some(i => i.status === "advisory");
    const catColor = hasFail ? "#dc2626" : hasAdvisory ? "#f97316" : "#111";

    const itemCards = catItems.map(i => {
      const needsNotes = i.status === "fail" || i.status === "advisory";
      const ss = statusStyle[i.status] || statusStyle.pending;
      const sl = statusLabel[i.status] || i.status.toUpperCase();
      const bg = i.status === "fail" ? "#fef2f2" : i.status === "advisory" ? "#fff7ed" : i.status === "pass" ? "#f0fdf4" : "#fff";

      const notesRow = needsNotes
        ? `<div style="margin-top:4px;font-size:10px;color:#374151;min-height:28px;border-top:1px solid #e5e7eb;padding-top:4px;">${i.notes ? i.notes : "<span style='color:#9ca3af;font-style:italic;'>No notes</span>"}</div>`
        : "";

      return `<div style="background:${bg};border:2px solid ${catColor};border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;min-height:${needsNotes ? "70px" : "36px"}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:4px;">
          <span style="font-size:10px;font-weight:700;line-height:1.3;flex:1;">${i.item}</span>
          <span style="font-size:9px;font-weight:900;padding:2px 5px;border-radius:4px;white-space:nowrap;flex-shrink:0;${ss}">${sl}</span>
        </div>
        ${notesRow}
      </div>`;
    }).join("");

    const passCnt = catItems.filter(i => i.status === "pass").length;
    const failCnt = catItems.filter(i => i.status === "fail").length;
    const advCnt  = catItems.filter(i => i.status === "advisory").length;
    const pendCnt = catItems.filter(i => i.status === "pending").length;

    const badges = [
      failCnt  ? `<span style="background:#dc2626;color:#fff;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;">${failCnt} FAIL</span>` : "",
      advCnt   ? `<span style="background:#f97316;color:#fff;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;">${advCnt} ADV</span>` : "",
      passCnt  ? `<span style="background:#16a34a;color:#fff;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;">${passCnt} PASS</span>` : "",
      pendCnt  ? `<span style="background:#fef08a;color:#78716c;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;">${pendCnt} PENDING</span>` : "",
    ].filter(Boolean).join(" ");

    return `
      <div style="margin-bottom:14px;break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-bottom:4px;border-bottom:3px solid ${catColor};">
          <span style="font-size:13px;font-weight:900;text-transform:uppercase;color:${catColor};">${cat}</span>
          <span style="display:flex;gap:4px;flex-wrap:wrap;">${badges}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;">
          ${itemCards}
        </div>
      </div>`;
  }).join("");

  win.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 18px; background: #fff; color: #111; font-size: 11px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 8px; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:8px;border-bottom:4px solid #111;">
    <div>
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;">${title}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">Printed ${date}</div>
    </div>
    <div style="font-size:10px;color:#9ca3af;font-family:monospace;">Maintenance Tracker</div>
  </div>
  ${categoryBlocks}
  <script>
    window.addEventListener("load", function() { setTimeout(function(){ window.print(); }, 200); });
  <\/script>
</body></html>`);
  win.document.close();
}

export function printSection(title: string, el: HTMLElement) {
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) {
    alert("Please allow popups to use the print feature.");
    return;
  }

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    button, [role="button"] { display: none !important; }
    input[type="text"], input[type="number"], input[type="date"] {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
    }
    textarea { border: none !important; background: transparent !important; resize: none !important; }
    select { display: none !important; }
    dialog, [role="dialog"] { display: none !important; }
  </style>
</head>
<body class="bg-white text-black p-8 font-sans max-w-4xl mx-auto">
  <div class="mb-8 pb-4 border-b-4 border-black flex justify-between items-end">
    <div>
      <div class="text-xl font-black uppercase tracking-wide">${title}</div>
      <div class="text-sm text-gray-500 mt-1">Printed ${date}</div>
    </div>
    <div class="text-xs text-gray-400 font-mono">Maintenance Tracker</div>
  </div>
  ${el.innerHTML}
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 600);
    });
  <\/script>
</body>
</html>`);
  win.document.close();
}
