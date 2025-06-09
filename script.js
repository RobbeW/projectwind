// script.js
// © 2025 Robbe Wulgaert · AI in de Klas

// Splitst inkomende seriële data in regels
class LineBreakTransformer {
  constructor() {
    this.chunks = '';
  }
  transform(chunk, controller) {
    this.chunks += chunk;
    const lines = this.chunks.split('\n');
    this.chunks = lines.pop();
    lines.forEach(line => controller.enqueue(line));
  }
  flush(controller) {
    controller.enqueue(this.chunks);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // HTML-elementen
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

  // Toestand en instellingen
  let port, reader;
  let keepReading = false;
  let startTime, endTime;
  let lastTimestamp;
  let deliveredEnergyWh = 0;
  const measurementData     = [];
  const batteryCapacity_mAh = 3561;
  const batteryWh           = (batteryCapacity_mAh / 1000) * 3.7;
  const maxDataPoints       = 50;

  // Chart.js configuratie met twee Y-assen, zonder animaties
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Spanning (V)', data: [], borderColor: 'rgba(59,130,246,1)', yAxisID: 'y', tension: 0.2 },
        { label: 'Stroom (A)',     data: [], borderColor: 'rgba(16,185,129,1)', yAxisID: 'y1', tension: 0.2 }
      ]
    },
    options: {
      animation: { duration: 0 },
      scales: {
        x:  { title: { display: true, text: 'Tijd' } },
        y:  { type: 'linear', position: 'left',  title: { display: true, text: 'Spanning (V)' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'Stroom (A)' }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // Overlay-knoppen
  btnSchema?.addEventListener('click',   () => overlaySchema.classList.remove('hidden'));
  btnCloseSchema?.addEventListener('click', () => overlaySchema.classList.add('hidden'));
  btnHelp?.addEventListener('click',     () => overlayHelp.classList.remove('hidden'));
  btnCloseHelp?.addEventListener('click',   () => overlayHelp.classList.add('hidden'));

  // Verbind met micro:bit
  btnConnect.addEventListener('click', async () => {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      reader = port.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TransformStream(new LineBreakTransformer()))
        .getReader();
      btnConnect.disabled = true;
      btnConnect.classList.add('opacity-50', 'cursor-not-allowed');
    } catch (err) {
      console.error('Verbindingsfout:', err);
      alert('Verbindingsfout: ' + err);
    }
  });

  // Start meten
  btnStart.addEventListener('click', () => {
    if (!reader) { alert('Verbind eerst met de micro:bit.'); return; }
    keepReading = true;
    startTime = Date.now();
    lastTimestamp = startTime;
    deliveredEnergyWh = 0;
    btnStart.disabled = true;
    btnStart.classList.add('opacity-50', 'cursor-not-allowed');
    btnStop.disabled  = false;
    btnStop.classList.remove('opacity-50', 'cursor-not-allowed');
    readLoop();
  });

  // Lees-loop
  async function readLoop() {
    while (keepReading) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        const line = value.trim();
        if (!line) continue;
        // CSV: timestamp, spanning (V), stroom (A)
        const parts = line.split(',');
        if (parts.length < 3) continue;
        const voltage = parseFloat(parts[1]);
        const current = parseFloat(parts[2]);
        if (isNaN(voltage) || isNaN(current)) continue;
        const now = Date.now();
        const power = voltage * current;

        // Energie berekenen
        const dtHr = (now - lastTimestamp) / 3600000;
        deliveredEnergyWh += power * dtHr;
        lastTimestamp = now;

        measurementData.push({ timestamp: now, voltage, current, power });

        // UI updates
        displayVoltage.textContent = voltage.toFixed(2);
        displayCurrent.textContent = current.toFixed(3);
        const percent = Math.min((deliveredEnergyWh / batteryWh) * 100, 100);
        batteryLevel.style.height = `${percent}%`;
        chargePercent.textContent = `${percent.toFixed(1)}%`;
        const elapsedHr = (now - startTime) / 3600000;
        const avgPower = deliveredEnergyWh / elapsedHr;
        const remaining = percent >= 100
          ? 'Volledig geladen'
          : avgPower > 0
            ? `${((batteryWh - deliveredEnergyWh) / avgPower).toFixed(2)} uur resterend`
            : '-- uur resterend';
        timeRemaining.textContent = remaining;

        // Grafiek update
        const timeLabel = new Date(now).toLocaleTimeString();
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(voltage);
        chart.data.datasets[1].data.push(current);
        if (chart.data.labels.length > maxDataPoints) {
          chart.data.labels.shift();
          chart.data.datasets.forEach(ds => ds.data.shift());
        }
        chart.update();
      } catch (err) {
        console.error('Leesfout:', err);
        break;
      }
    }
  }

  // Stop meten
  btnStop.addEventListener('click', () => {
    keepReading = false;
    endTime = Date.now();
    btnStop.disabled = true;
    btnStop.classList.add('opacity-50', 'cursor-not-allowed');
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
  });

  // Rapportgeneratie met 1 datapunt per seconde
  btnReport.addEventListener('click', () => reportModal.classList.replace('hidden', 'flex'));
  btnCancel.addEventListener('click', () => reportModal.classList.replace('flex', 'hidden'));
  reportForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!measurementData.length) { alert('Geen data om te rapporteren.'); return; }
    const count    = parseInt(inputCount.value, 10) || measurementData.length;
    const names    = inputNames.value.trim();
    const question = inputQuestion.value.trim();
    const duration = Math.round((endTime - startTime) / 60000);
    // Downsample per seconde
    const filteredData = [];
    let lastSec = null;
    measurementData.forEach(d => {
      const sec = Math.floor(d.timestamp / 1000);
      if (sec !== lastSec) { filteredData.push(d); lastSec = sec; }
    });
    const avg = arr => arr.reduce((s, x) => s + x, 0) / arr.length;
    const avgV = avg(filteredData.map(d => d.voltage)).toFixed(2);
    const avgI = avg(filteredData.map(d => d.current)).toFixed(3);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Rapport Windmolengenerator', 14, 20);
    doc.setFontSize(12);
    doc.text(`Datum: ${new Date(startTime).toLocaleDateString('nl-NL')}`, 14, 30);
    doc.text(`Duur (min): ${duration}`, 14, 36);
    doc.text(`Aantal studenten: ${count}`, 14, 42);
    doc.text(`Studenten: ${names}`, 14, 48);
    if (question) {
      doc.text('Onderzoeksvraag:', 14, 58);
      doc.text(doc.splitTextToSize(question, 180), 14, 64);
    }
    let y = question ? 64 + doc.splitTextToSize(question, 180).length * 7 + 10 : 58;
    doc.text('Gemiddelden:', 14, y);
    y += 6;
    [`• Spanning: ${avgV} V`, `• Stroom: ${avgI} A`].forEach(line => { y += 6; doc.text(line, 18, y); });
    doc.addPage();
    doc.text('Ruwe data', 14, 20);
    doc.autoTable({ head: [['Tijd', 'Spanning (V)', 'Stroom (A)', 'Vermogen (W)']], startY: 26, body: filteredData.map(d => [new Date(d.timestamp).toLocaleTimeString('nl-NL'), d.voltage.toFixed(2), d.current.toFixed(3), d.power.toFixed(3)]), styles: { fontSize: 9 } });
    doc.save('Rapport_Windmolengenerator.pdf');
    reportModal.classList.replace('flex', 'hidden');
  });
});
