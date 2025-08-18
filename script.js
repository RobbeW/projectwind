// script.js
// © 2025 Robbe Wulgaert · AI in de Klas

// ===== Seriële ondersteuning check =====
if (!('serial' in navigator)) {
  alert('WebSerial niet ondersteund – gebruik Chrome/Edge via https of localhost.');
}

// Splitst inkomende seriële data in regels
class LineBreakTransformer {
  constructor() { this.chunks = ''; }
  transform(chunk, controller) {
    this.chunks += chunk;
    const lines = this.chunks.split('\n');
    this.chunks = lines.pop();
    lines.forEach(line => controller.enqueue(line));
  }
  flush(controller) { controller.enqueue(this.chunks); }
}

window.addEventListener('DOMContentLoaded', () => {
  // ===== HTML-elementen =====
  const btnConnect     = document.getElementById('btn-connect');
  const btnStart       = document.getElementById('btn-start');
  const btnStop        = document.getElementById('btn-stop');
  const btnReport      = document.getElementById('btn-report');
  const reportModal    = document.getElementById('report-modal');
  const reportForm     = document.getElementById('report-form');
  const btnCancel      = document.getElementById('btn-cancel');
  const inputCount     = document.getElementById('input-count');
  const inputNames     = document.getElementById('input-names');
  const inputQuestion  = document.getElementById('input-question');
  const displayVoltage = document.getElementById('voltage');
  const displayCurrent = document.getElementById('current');
  const chargePercent  = document.getElementById('charge-percent');
  const timeRemaining  = document.getElementById('time-remaining');
  const batteryLevel   = document.querySelector('.battery-level');
  const btnSchema      = document.getElementById('btn-schema');
  const overlaySchema  = document.getElementById('overlay-schema');
  const btnCloseSchema = document.getElementById('btn-close-schema');
  const btnHelp        = document.getElementById('btn-help');
  const overlayHelp    = document.getElementById('overlay-help');
  const btnCloseHelp   = document.getElementById('btn-close-help');
  const ctx            = document.getElementById('chart').getContext('2d');

  // ===== Toestand en instellingen =====
  let port = null;
  let reader = null;
  let keepReading = false;
  let startTime = null;
  let endTime = null;
  let lastTimestamp = null;
  let deliveredEnergyWh = 0;

  const measurementData     = [];
  const batteryCapacity_mAh = 3561;
  const batteryWh           = (batteryCapacity_mAh / 1000) * 3.7;
  const maxDataPoints       = 50;

  // ===== Chart.js configuratie (kleur uit CSS-variabelen) =====
  const cs   = getComputedStyle(document.body);
  const GRID = (cs.getPropertyValue('--chart-grid')  || '#d1d5db').trim();
  const LABL = (cs.getPropertyValue('--chart-label') || '#111827').trim();

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Spanning (V)', data: [], borderColor: 'rgba(59,130,246,1)',  yAxisID: 'y',  tension: 0.2 },
        { label: 'Stroom (A)',   data: [], borderColor: 'rgba(16,185,129,1)',  yAxisID: 'y1', tension: 0.2 }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x:  { title: { display: true, text: 'Tijd' }, grid: { color: GRID }, ticks: { color: LABL } },
        y:  { type: 'linear', position: 'left',  title: { display: true, text: 'Spanning (V)' }, grid: { color: GRID }, ticks: { color: LABL } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'Stroom (A)'   }, grid: { drawOnChartArea: false, color: GRID }, ticks: { color: LABL } }
      },
      plugins: {
        legend: { labels: { color: LABL } }
      }
    }
  });

  // NL: koppel grafiek aan thematoggle (die vervangt opties veilig)
  window.__setChartRef && window.__setChartRef(chart);

  // ===== Overlays =====
  btnSchema?.addEventListener('click',      () => overlaySchema.classList.remove('hidden'));
  btnCloseSchema?.addEventListener('click', () => overlaySchema.classList.add('hidden'));
  btnHelp?.addEventListener('click',        () => overlayHelp.classList.remove('hidden'));
  btnCloseHelp?.addEventListener('click',   () => overlayHelp.classList.add('hidden'));

  // ===== Verbinden =====
  btnConnect.addEventListener('click', async () => {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      btnConnect.disabled = true;
      btnConnect.classList.add('opacity-50', 'cursor-not-allowed');

      // Kabel uit? Herstel UI
      navigator.serial.addEventListener('disconnect', () => {
        console.warn('📴 (Serieel) Verbinding verbroken.');
        try { reader?.cancel(); } catch {}
        reader = null;
        keepReading = false;
        port = null;

        btnStart.disabled = false;
        btnStart.classList.remove('opacity-50', 'cursor-not-allowed');

        btnStop.disabled = true;
        btnStop.classList.add('opacity-50', 'cursor-not-allowed');

        btnConnect.disabled = false;
        btnConnect.classList.remove('opacity-50', 'cursor-not-allowed');
      });
    } catch (err) {
      console.error('Verbindingsfout:', err);
      alert('Verbindingsfout: ' + err);
    }
  });

  // ===== Start meten =====
  btnStart.addEventListener('click', async () => {
    if (!port) { alert('Verbind eerst met de micro:bit.'); return; }
    if (keepReading) return;

    keepReading = true;
    startTime = Date.now();
    endTime = null;
    lastTimestamp = startTime;
    deliveredEnergyWh = 0;

    btnStart.disabled = true;
    btnStart.classList.add('opacity-50', 'cursor-not-allowed');
    btnStop.disabled  = false;
    btnStop.classList.remove('opacity-50', 'cursor-not-allowed');

    // Verse reader per sessie
    reader = port.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TransformStream(new LineBreakTransformer()))
      .getReader();

    readLoop();
  });

  // ===== Lees-loop =====
  async function readLoop() {
    while (keepReading) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        const line = (value || '').trim();
        if (!line) continue;

        // CSV: timestamp, spanning (V), stroom (A)
        const parts = line.split(',');
        if (parts.length < 3) continue;

        const voltage = parseFloat(parts[1]);
        const current = parseFloat(parts[2]);
        if (isNaN(voltage) || isNaN(current)) continue;

        const now   = Date.now();
        const power = voltage * current;

        // Energie (Wh)
        const dtHr = (now - lastTimestamp) / 3600000;
        deliveredEnergyWh += power * dtHr;
        lastTimestamp = now;

        measurementData.push({ timestamp: now, voltage, current, power });

        // UI
        displayVoltage.textContent = voltage.toFixed(2);
        displayCurrent.textContent = current.toFixed(3);

        const percent = Math.min((deliveredEnergyWh / batteryWh) * 100, 100);
        batteryLevel.style.height = `${percent}%`;
        chargePercent.textContent = `${percent.toFixed(1)}%`;

        const elapsedHr = (now - startTime) / 3600000;
        let remainingText = '-- uur resterend';
        if (percent >= 100) {
          remainingText = 'Volledig geladen';
        } else if (elapsedHr > 1e-6) {
          const avgPower = deliveredEnergyWh / elapsedHr; // W
          if (avgPower > 0) {
            const hrs = (batteryWh - deliveredEnergyWh) / avgPower;
            remainingText = `${Math.max(0, hrs).toFixed(2)} uur resterend`;
          }
        }
        timeRemaining.textContent = remainingText;

        // Grafiek
        const timeLabel = new Date(now).toLocaleTimeString('nl-NL');
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(voltage);
        chart.data.datasets[1].data.push(current);
        if (chart.data.labels.length > maxDataPoints) {
          chart.data.labels.shift();
          chart.data.datasets.forEach(ds => ds.data.shift());
        }
        chart.update('none');

      } catch (err) {
        console.error('Leesfout:', err);
        break;
      }
    }

    try { reader?.releaseLock(); } catch {}
  }

  // ===== Stop =====
  btnStop.addEventListener('click', async () => {
    keepReading = false;
    endTime = Date.now();
    try { await reader?.cancel(); } catch {}
    try { reader?.releaseLock(); } catch {}
    reader = null;

    btnStop.disabled  = true;
    btnStop.classList.add('opacity-50', 'cursor-not-allowed');
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
  });

  // ===== Rapport =====
  btnReport.addEventListener('click', () => reportModal.classList.replace('hidden', 'flex'));
  btnCancel.addEventListener('click', () => reportModal.classList.replace('flex', 'hidden'));

  reportForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!measurementData.length) { alert('Geen data om te rapporteren.'); return; }

    const effectiveEnd = endTime ?? Date.now();
    const duration = Math.max(0, Math.round((effectiveEnd - (startTime ?? effectiveEnd)) / 60000));

    const count    = parseInt(inputCount.value, 10) || 1;
    const names    = inputNames.value.trim();
    const question = inputQuestion.value.trim();

    // Downsample: 1 punt/s
    let filteredData = [];
    let lastSec = null;
    measurementData.forEach(d => {
      const sec = Math.floor(d.timestamp / 1000);
      if (sec !== lastSec) { filteredData.push(d); lastSec = sec; }
    });
    if (!filteredData.length) filteredData = measurementData.slice();

    const avg = arr => arr.length ? (arr.reduce((s, x) => s + x, 0) / arr.length) : 0;
    const avgV = avg(filteredData.map(d => d.voltage)).toFixed(2);
    const avgI = avg(filteredData.map(d => d.current)).toFixed(3);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Rapport Windmolengenerator', 14, 20);
    doc.setFontSize(12);
    doc.text(`Datum: ${new Date(startTime ?? Date.now()).toLocaleDateString('nl-NL')}`, 14, 30);
    doc.text(`Duur (min): ${duration}`, 14, 36);
    doc.text(`Aantal studenten: ${count}`, 14, 42);
    doc.text(`Studenten: ${names}`, 14, 48);

    let y = 58;
    if (question) {
      doc.text('Onderzoeksvraag:', 14, y);
      const vraag = doc.splitTextToSize(question, 180);
      y += 6;
      doc.text(vraag, 14, y);
      y += vraag.length * 7 + 4;
    }

    doc.text('Gemiddelden:', 14, y); y += 6;
    [`• Spanning: ${avgV} V`, `• Stroom: ${avgI} A`].forEach(line => { y += 6; doc.text(line, 18, y); });

    doc.addPage();
    doc.text('Ruwe data', 14, 20);
    doc.autoTable({
      head: [['Tijd', 'Spanning (V)', 'Stroom (A)', 'Vermogen (W)']],
      startY: 26,
      body: filteredData.map(d => [
        new Date(d.timestamp).toLocaleTimeString('nl-NL'),
        d.voltage.toFixed(2),
        d.current.toFixed(3),
        d.power.toFixed(3)
      ]),
      styles: { fontSize: 9 }
    });

    doc.save('Rapport_Windmolengenerator.pdf');
    reportModal.classList.replace('flex', 'hidden');
  });
});
