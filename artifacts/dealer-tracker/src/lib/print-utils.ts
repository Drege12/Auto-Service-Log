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
    <div class="text-xs text-gray-400 font-mono">Dealer Car Tracker</div>
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
