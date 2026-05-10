// © 2026 Robbe Wulgaert - AI in de Klas

class LineBreakTransformer {
  constructor() {
    this.chunks = '';
  }

  transform(chunk, controller) {
    this.chunks += chunk;
    const lines = this.chunks.split('\n');
    this.chunks = lines.pop();
    lines.forEach((line) => controller.enqueue(line));
  }

  flush(controller) {
    controller.enqueue(this.chunks);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const els = {
    compatibilityNotice: $('compatibility-notice'),
    connectionStatus: $('connection-status'),
    workflowLinks: [...document.querySelectorAll('[data-step-link]')],
    setupChecklist: $('setup-checklist'),
    diagnosticSummary: $('diagnostic-summary'),
    diagnosticList: $('diagnostic-list'),
    serialPreview: $('serial-preview'),
    btnSchema: $('btn-schema'),
    btnCloseSchema: $('btn-close-schema'),
    overlaySchema: $('overlay-schema'),
    btnHelp: $('btn-help'),
    btnCloseHelp: $('btn-close-help'),
    overlayHelp: $('overlay-help'),
    btnConnect: $('btn-connect'),
    btnDemo: $('btn-demo'),
    btnNewTrial: $('btn-new-trial'),
    btnStart: $('btn-start'),
    btnStop: $('btn-stop'),
    btnCalibrate: $('btn-calibrate'),
    btnResetCalibration: $('btn-reset-calibration'),
    btnExportCsv: $('btn-export-csv'),
    btnReport: $('btn-report'),
    btnCancel: $('btn-cancel'),
    reportModal: $('report-modal'),
    reportForm: $('report-form'),
    inputCount: $('input-count'),
    inputNames: $('input-names'),
    inputQuestion: $('input-question'),
    inputHypothesis: $('input-hypothesis'),
    inputIndependent: $('input-independent'),
    inputDependent: $('input-dependent'),
    inputConclusion: $('input-conclusion'),
    inputReflection: $('input-reflection'),
    trialName: $('trial-name'),
    trialVariable: $('trial-variable'),
    trialValue: $('trial-value'),
    voltage: $('voltage'),
    current: $('current'),
    power: $('power'),
    energy: $('energy'),
    powerFormula: $('power-formula'),
    energyFormula: $('energy-formula'),
    batteryModel: $('battery-model'),
    batteryLevel: document.querySelector('.battery-level'),
    chargePercent: $('charge-percent'),
    timeRemaining: $('time-remaining'),
    voltageOffset: $('voltage-offset'),
    currentOffset: $('current-offset'),
    trialSummaryBody: $('trial-summary-body'),
    liveChartCanvas: $('live-chart'),
    comparisonChartCanvas: $('comparison-chart'),
  };

  const BATTERY_CAPACITY_MAH = 3361;
  const BATTERY_NOMINAL_V = 3.7;
  const BATTERY_WH = (BATTERY_CAPACITY_MAH / 1000) * BATTERY_NOMINAL_V;
  const BAUD_RATE = 115200;
  const MAX_LIVE_POINTS = 220;
  const CHART_COLORS = ['#5200FF', '#00A3A3', '#FFB000', '#D0006F', '#7A3CFF', '#008060', '#FF6B00', '#475569'];

  const state = {
    port: null,
    reader: null,
    serialLoopActive: false,
    isMeasuring: false,
    activeSource: null,
    demoTimer: null,
    demoMs: 0,
    droppedLines: 0,
    calibrated: false,
    calibration: { voltage: 0, current: 0 },
    latestRaw: null,
    latestPoint: null,
    trials: [],
    activeTrial: null,
  };

  let liveChart = null;
  let comparisonChart = null;

  initialize();

  function initialize() {
    updateCompatibilityNotice();
    createCharts();
    bindEvents();
    createNewTrial({ resetForm: true });
    updateCalibrationDisplay();
    updateBatteryModelText();
    updateDiagnostics('Nog geen data ontvangen.', [
      'Verwachte seriële regel: tijd_ms, spanning_V, stroom_A.',
      'Gebruik Chrome of Edge via HTTPS, GitHub Pages of localhost voor WebSerial.',
      'Geen hardware beschikbaar? Start de demomodus.',
    ]);
    updateWorkflowState();
    updateCalibrationControl();
  }

  function bindEvents() {
    els.btnSchema.addEventListener('click', () => openOverlay(els.overlaySchema));
    els.btnCloseSchema.addEventListener('click', () => closeOverlay(els.overlaySchema));
    els.btnHelp.addEventListener('click', () => openOverlay(els.overlayHelp));
    els.btnCloseHelp.addEventListener('click', () => closeOverlay(els.overlayHelp));
    els.btnCancel.addEventListener('click', () => closeOverlay(els.reportModal));

    els.btnConnect.addEventListener('click', connectSerial);
    els.btnDemo.addEventListener('click', () => {
      if (state.isMeasuring && state.activeSource === 'demo') {
        stopMeasurement();
      } else {
        startMeasurement('demo');
      }
    });
    els.btnNewTrial.addEventListener('click', () => createNewTrial({ resetForm: true }));
    els.btnStart.addEventListener('click', () => startMeasurement('serial'));
    els.btnStop.addEventListener('click', stopMeasurement);
    els.btnCalibrate.addEventListener('click', calibrateZero);
    els.btnResetCalibration.addEventListener('click', resetCalibration);
    els.btnExportCsv.addEventListener('click', exportCsv);
    els.btnReport.addEventListener('click', () => {
      if (!state.trials.some((trial) => trial.data.length)) {
        alert('Er zijn nog geen meetgegevens om te rapporteren.');
        return;
      }
      openOverlay(els.reportModal);
    });
    els.reportForm.addEventListener('submit', (event) => {
      event.preventDefault();
      generatePdfReport();
    });

    [els.trialName, els.trialVariable, els.trialValue].forEach((input) => {
      input.addEventListener('input', () => {
        updateActiveTrialFromForm();
        renderTrialSummaries();
        updateComparisonChart();
      });
    });

    [
      els.inputQuestion,
      els.inputHypothesis,
      els.inputIndependent,
      els.inputDependent,
      els.inputConclusion,
      els.inputReflection,
    ].forEach((input) => input.addEventListener('input', updateWorkflowState));

    els.setupChecklist.addEventListener('change', updateWorkflowState);

    els.workflowLinks.forEach((link) => {
      link.addEventListener('click', () => {
        setActiveWorkflowLink(link.dataset.stepLink);
      });
    });

    document.querySelectorAll('.overlay').forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          closeOverlay(overlay);
        }
      });
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActiveWorkflowLink(visible.target.id);
        }
      }, { threshold: 0.35 });
      document.querySelectorAll('.workflow-section').forEach((section) => observer.observe(section));
    }
  }

  function createCharts() {
    if (!window.Chart) {
      updateDiagnostics('Chart.js kon niet geladen worden.', [
        'Controleer of vendor/chart.umd.min.js aanwezig is.',
        'Metingen en exports blijven werken, maar grafieken worden niet getoond.',
      ]);
      return;
    }

    liveChart = new Chart(els.liveChartCanvas.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          makeDataset('Spanning (V)', '#5200FF', 'yVoltage'),
          makeDataset('Stroom (A)', '#00A3A3', 'yCurrent'),
          makeDataset('Vermogen (W)', '#FFB000', 'yPower'),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Tijd sinds start proef (s)' },
          },
          yVoltage: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Spanning (V)' },
          },
          yCurrent: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Stroom (A)' },
            grid: { drawOnChartArea: false },
          },
          yPower: {
            type: 'linear',
            position: 'right',
            display: false,
          },
        },
      },
    });

    comparisonChart = new Chart(els.comparisonChartCanvas.getContext('2d'), {
      type: 'line',
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Tijd sinds start proef (s)' },
          },
          y: {
            title: { display: true, text: 'Vermogen (W)' },
            beginAtZero: true,
          },
        },
      },
    });
  }

  function makeDataset(label, color, yAxisID) {
    return {
      label,
      data: [],
      borderColor: color,
      backgroundColor: color,
      yAxisID,
      tension: 0.22,
      borderWidth: 2,
      pointRadius: 0,
    };
  }

  function updateCompatibilityNotice() {
    const messages = [];
    if (!window.isSecureContext) {
      messages.push('WebSerial werkt alleen in een veilige context. Gebruik GitHub Pages, HTTPS of localhost.');
    }
    if (!('serial' in navigator)) {
      messages.push('Deze browser ondersteunt WebSerial niet. Gebruik Chrome of Edge, of werk met de demomodus.');
      els.btnConnect.disabled = true;
      els.btnStart.disabled = true;
    }
    if (!window.Chart || !window.jspdf) {
      messages.push('De lokale bibliotheken worden geladen vanuit de map vendor. Controleer die map als grafieken of PDF niet starten.');
    }

    if (messages.length) {
      els.compatibilityNotice.classList.remove('hidden');
      els.compatibilityNotice.innerHTML = messages.map((message) => `<p>${escapeHtml(message)}</p>`).join('');
    }
  }

  async function connectSerial() {
    if (!('serial' in navigator)) {
      alert('WebSerial is niet beschikbaar in deze browser. Gebruik Chrome of Edge, of start de demomodus.');
      return;
    }

    try {
      state.port = await navigator.serial.requestPort();
      await state.port.open({ baudRate: BAUD_RATE });
      state.reader = state.port.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TransformStream(new LineBreakTransformer()))
        .getReader();

      els.connectionStatus.textContent = `Verbonden (${BAUD_RATE} baud)`;
      els.btnConnect.disabled = true;
      els.btnStart.disabled = false;
      updateDiagnostics('Micro:bit verbonden. Start een meting wanneer de proef klaar staat.', [
        'De app gebruikt de tijdstempel uit de micro:bit voor dt en energie.',
        'Controleer of de seriële regel drie waarden bevat: tijd, spanning, stroom.',
      ]);
      startSerialLoop();
    } catch (err) {
      console.error('Verbindingsfout:', err);
      updateDiagnostics('Verbinding mislukt.', [String(err)]);
      alert(`Verbindingsfout: ${err}`);
    }
  }

  function startMeasurement(source) {
    if (state.isMeasuring) {
      return;
    }
    if (source === 'serial' && !state.reader) {
      alert('Verbind eerst met de micro:bit of gebruik de demomodus.');
      return;
    }

    if (state.activeTrial?.data.length) {
      createNewTrial({ resetForm: true });
    }

    const trial = ensureActiveTrial();
    updateActiveTrialFromForm();
    resetTrialData(trial);

    state.isMeasuring = true;
    state.activeSource = source;
    els.btnStart.disabled = true;
    els.btnStop.disabled = false;
    els.btnNewTrial.disabled = true;
    els.btnDemo.textContent = source === 'demo' ? 'Stop demomodus' : 'Start demomodus';
    els.connectionStatus.textContent = source === 'demo' ? 'Demomodus actief' : `Meten (${BAUD_RATE} baud)`;

    clearLiveChart();
    updateDiagnostics(`Meting gestart voor ${trial.name}.`, [
      source === 'demo'
        ? 'Demodata simuleert windstoten en meetruis. Gebruik dit om de lesflow te testen.'
        : 'Seriële data wordt nu gekoppeld aan de actieve proef.',
    ]);

    if (source === 'demo') {
      startDemoLoop();
    } else {
      startSerialLoop();
    }
    updateWorkflowState();
  }

  function stopMeasurement() {
    if (!state.isMeasuring) {
      return;
    }

    state.isMeasuring = false;
    const trial = ensureActiveTrial();
    trial.endedAt = new Date();
    trial.summary = summarizeTrial(trial);

    if (state.demoTimer) {
      window.clearInterval(state.demoTimer);
      state.demoTimer = null;
    }

    els.btnStop.disabled = true;
    els.btnStart.disabled = !state.reader;
    els.btnNewTrial.disabled = false;
    els.btnDemo.textContent = 'Start demomodus';
    els.connectionStatus.textContent = state.reader ? `Verbonden (${BAUD_RATE} baud)` : 'Niet verbonden';

    updateDiagnostics(`Meting gestopt voor ${trial.name}.`, [
      trial.data.length
        ? `${trial.data.length} meetpunten opgeslagen. Maak een nieuwe proef om te vergelijken.`
        : 'Er zijn geen geldige meetpunten ontvangen.',
    ]);
    renderTrialSummaries();
    updateComparisonChart();
    updateWorkflowState();
  }

  function startSerialLoop() {
    if (state.serialLoopActive || !state.reader) {
      return;
    }
    state.serialLoopActive = true;
    readSerialLoop();
  }

  async function readSerialLoop() {
    while (state.reader) {
      try {
        const { value, done } = await state.reader.read();
        if (done) {
          break;
        }
        if (typeof value === 'string') {
          parseSerialLine(value);
        }
      } catch (err) {
        console.error('Leesfout:', err);
        updateDiagnostics('Leesfout op de seriële verbinding.', [String(err)]);
        break;
      }
    }
    state.serialLoopActive = false;
  }

  function parseSerialLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    state.lastLine = trimmed;
    if (els.serialPreview) {
      els.serialPreview.textContent = `Laatste regel: ${trimmed}`;
    }

    const parts = trimmed.split(',').map((part) => part.trim());
    if (parts.length < 3) {
      state.droppedLines += 1;
      updateDiagnostics('Seriële regel overgeslagen.', [
        `Verwacht 3 velden, kreeg ${parts.length}.`,
        'Controleer de micro:bit code: tijd_ms, spanning_V, stroom_A.',
      ]);
      return;
    }

    const deviceMs = Number(parts[0]);
    const rawVoltage = Number(parts[1].replace(',', '.'));
    const rawCurrent = Number(parts[2].replace(',', '.'));

    if (![deviceMs, rawVoltage, rawCurrent].every(Number.isFinite)) {
      state.droppedLines += 1;
      updateDiagnostics('Seriële regel bevat geen geldige getallen.', [
        `Ontvangen: ${trimmed}`,
        'Gebruik punten als decimaalteken in de micro:bit CSV.',
      ]);
      return;
    }

    const reading = { deviceMs, rawVoltage, rawCurrent, source: 'serial' };
    const hadLatestRaw = Boolean(state.latestRaw);
    state.latestRaw = reading;
    updateCalibrationControl();

    if (!state.isMeasuring) {
      if (!hadLatestRaw) {
        updateDiagnostics('Micro:bit stuurt data. Je kunt nu het nulpunt vastleggen.', [
          'Laat de generator stilstaan voordat je kalibreert.',
        ]);
      }
      return;
    }

    processReading(reading);
  }

  function startDemoLoop() {
    state.demoMs = 0;
    processReading(makeDemoReading());
    state.demoTimer = window.setInterval(() => {
      processReading(makeDemoReading());
    }, 250);
  }

  function makeDemoReading() {
    const trial = ensureActiveTrial();
    state.demoMs += 250;
    const seconds = state.demoMs / 1000;
    const variable = trial.variableType;
    const valueNumber = parseFloat(String(trial.variableValue).replace(',', '.'));

    let factor = 1;
    if (variable === 'Ventilatorafstand' && Number.isFinite(valueNumber)) {
      factor = clamp(1.35 - valueNumber / 120, 0.35, 1.25);
    } else if (variable === 'Kracht ventilator' && Number.isFinite(valueNumber)) {
      factor = clamp(0.55 + valueNumber * 0.22, 0.45, 1.35);
    } else if (variable === 'Bladhoek' && Number.isFinite(valueNumber)) {
      factor = clamp(1.15 - Math.abs(valueNumber - 25) / 60, 0.35, 1.2);
    } else if (variable === 'Belastingsweerstand' && Number.isFinite(valueNumber)) {
      factor = clamp(100 / Math.max(valueNumber, 20), 0.45, 1.35);
    }

    const gust = 0.65 + 0.25 * Math.sin(seconds * 0.9) + 0.12 * Math.sin(seconds * 2.6);
    const noise = (Math.random() - 0.5) * 0.04;
    const rawVoltage = clamp((1.2 + gust + noise) * factor, 0, 3.1);
    const loadResistance = variable === 'Belastingsweerstand' && Number.isFinite(valueNumber) ? Math.max(valueNumber, 20) : 100;
    const rawCurrent = clamp(rawVoltage / loadResistance + 0.006 * Math.sin(seconds * 1.7), 0, 0.09);

    return { deviceMs: state.demoMs, rawVoltage, rawCurrent, source: 'demo' };
  }

  function processReading(reading) {
    const trial = ensureActiveTrial();
    state.latestRaw = reading;
    updateCalibrationControl();

    const voltage = clamp(reading.rawVoltage - state.calibration.voltage, 0, 20);
    const current = clamp(reading.rawCurrent - state.calibration.current, 0, 5);
    const power = voltage * current;

    if (trial.startDeviceMs === null) {
      trial.startDeviceMs = reading.deviceMs;
      trial.lastDeviceMs = reading.deviceMs;
      trial.startedAt = new Date();
    }

    let dtMs = reading.deviceMs - trial.lastDeviceMs;
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      dtMs = 0;
      trial.startDeviceMs = reading.deviceMs;
      updateDiagnostics('Tijdstempel reset gedetecteerd.', [
        'De tijdstempel van de micro:bit sprong terug. De proef wordt vanaf dit punt opnieuw getimed.',
      ]);
    } else if (dtMs > 5000) {
      updateDiagnostics('Grote tijdstap gedetecteerd.', [
        `dt = ${(dtMs / 1000).toFixed(1)} s. Controleer of de micro:bit tijdelijk stopte met zenden.`,
      ]);
    }

    trial.energyWh += power * (dtMs / 3600000);
    trial.lastDeviceMs = reading.deviceMs;
    trial.endDeviceMs = reading.deviceMs;

    const point = {
      deviceMs: reading.deviceMs,
      elapsedMs: Math.max(0, reading.deviceMs - trial.startDeviceMs),
      receivedAt: Date.now(),
      rawVoltage: reading.rawVoltage,
      rawCurrent: reading.rawCurrent,
      voltage,
      current,
      power,
      energyWh: trial.energyWh,
      dtMs,
      source: reading.source,
    };

    trial.data.push(point);
    state.latestPoint = point;
    trial.summary = summarizeTrial(trial);

    updateLiveDisplay(point);
    updateLiveChart(point);
    updateComparisonChart();
    renderTrialSummaries();
    runReadingDiagnostics(trial, point);
    updateWorkflowState();
  }

  function calibrateZero() {
    if (!state.latestRaw) {
      alert('Er is nog geen meetwaarde. Start kort de demo of verbind de micro:bit om het nulpunt vast te leggen.');
      return;
    }
    state.calibration.voltage = Math.max(0, state.latestRaw.rawVoltage);
    state.calibration.current = Math.max(0, state.latestRaw.rawCurrent);
    state.calibrated = true;
    updateCalibrationDisplay();
    updateDiagnostics('Nulpunt vastgelegd.', [
      `Spanning offset: ${state.calibration.voltage.toFixed(3)} V`,
      `Stroom offset: ${state.calibration.current.toFixed(4)} A`,
    ]);
    updateWorkflowState();
  }

  function resetCalibration() {
    state.calibration = { voltage: 0, current: 0 };
    state.calibrated = false;
    updateCalibrationDisplay();
    updateDiagnostics('Kalibratie gewist.', ['Nieuwe metingen worden zonder offsetcorrectie verwerkt.']);
    updateWorkflowState();
  }

  function updateCalibrationDisplay() {
    els.voltageOffset.textContent = `${state.calibration.voltage.toFixed(3)} V`;
    els.currentOffset.textContent = `${state.calibration.current.toFixed(4)} A`;
  }

  function updateCalibrationControl() {
    els.btnCalibrate.disabled = !state.latestRaw;
    els.btnCalibrate.title = state.latestRaw
      ? ''
      : 'Verbind de micro:bit of start de demomodus voordat je het nulpunt vastlegt.';
  }

  function updateBatteryModelText() {
    els.batteryModel.textContent = `${formatNumber(BATTERY_CAPACITY_MAH, 0)} mAh batterij aan ${BATTERY_NOMINAL_V.toFixed(1)} V = ${BATTERY_WH.toFixed(2)} Wh, vergelijkbaar met een iPhone.`;
  }

  function updateLiveDisplay(point) {
    els.voltage.textContent = point.voltage.toFixed(2);
    els.current.textContent = point.current.toFixed(3);
    els.power.textContent = point.power.toFixed(3);
    els.energy.textContent = point.energyWh.toFixed(5);

    els.powerFormula.textContent = `We meten spanning en stroom. Vermogen is energie per seconde: ${point.voltage.toFixed(2)} V * ${point.current.toFixed(3)} A = ${point.power.toFixed(3)} W.`;
    els.energyFormula.textContent = `Energie telt elk stukje vermogen op over de tijd: ${point.energyWh.toFixed(5)} Wh na ${(point.elapsedMs / 1000).toFixed(1)} s; laatste dt = ${(point.dtMs / 1000).toFixed(2)} s.`;

    const percent = clamp((point.energyWh / BATTERY_WH) * 100, 0, 100);
    els.batteryLevel.style.height = `${percent}%`;
    els.chargePercent.textContent = `${percent.toFixed(2)}%`;

    const elapsedHr = point.elapsedMs / 3600000;
    const avgPower = elapsedHr > 0 ? point.energyWh / elapsedHr : 0;
    if (percent >= 100) {
      els.timeRemaining.textContent = 'Volledig geladen';
    } else if (avgPower > 0) {
      els.timeRemaining.textContent = `${((BATTERY_WH - point.energyWh) / avgPower).toFixed(2)} uur resterend`;
    } else {
      els.timeRemaining.textContent = '-- uur resterend';
    }
  }

  function updateLiveChart(point) {
    if (!liveChart) {
      return;
    }
    const x = point.elapsedMs / 1000;
    const datasets = liveChart.data.datasets;
    datasets[0].data.push({ x, y: point.voltage });
    datasets[1].data.push({ x, y: point.current });
    datasets[2].data.push({ x, y: point.power });
    datasets.forEach((dataset) => {
      while (dataset.data.length > MAX_LIVE_POINTS) {
        dataset.data.shift();
      }
    });
    liveChart.update('none');
  }

  function clearLiveChart() {
    if (!liveChart) {
      return;
    }
    liveChart.data.datasets.forEach((dataset) => {
      dataset.data = [];
    });
    liveChart.update('none');
  }

  function updateComparisonChart() {
    if (!comparisonChart) {
      return;
    }
    comparisonChart.data.datasets = state.trials
      .filter((trial) => trial.data.length)
      .map((trial, index) => ({
        label: makeTrialLabel(trial),
        data: trial.data.map((point) => ({ x: point.elapsedMs / 1000, y: point.power })),
        borderColor: CHART_COLORS[index % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.22,
      }));
    comparisonChart.update('none');
  }

  function createNewTrial({ resetForm }) {
    if (state.isMeasuring) {
      stopMeasurement();
    }
    const index = state.trials.length + 1;
    const trial = {
      id: `trial-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      index,
      name: `Proef ${index}`,
      variableType: resetForm ? defaultVariableForIndex(index) : els.trialVariable.value,
      variableValue: '',
      data: [],
      energyWh: 0,
      startDeviceMs: null,
      endDeviceMs: null,
      lastDeviceMs: null,
      startedAt: null,
      endedAt: null,
      summary: null,
    };
    state.trials.push(trial);
    state.activeTrial = trial;
    els.trialName.value = trial.name;
    els.trialVariable.value = trial.variableType;
    els.trialValue.value = trial.variableValue;
    clearLiveChart();
    updateLiveDisplayEmpty();
    renderTrialSummaries();
    updateComparisonChart();
    updateWorkflowState();
  }

  function defaultVariableForIndex(index) {
    if (index === 1) {
      return 'Ventilatorafstand';
    }
    if (index === 2) {
      return 'Kracht ventilator';
    }
    if (index === 3) {
      return 'Bladhoek';
    }
    if (index === 4) {
      return 'Belastingsweerstand';
    }
    return 'Andere variabele';
  }

  function ensureActiveTrial() {
    if (!state.activeTrial) {
      createNewTrial({ resetForm: true });
    }
    return state.activeTrial;
  }

  function resetTrialData(trial) {
    trial.data = [];
    trial.energyWh = 0;
    trial.startDeviceMs = null;
    trial.endDeviceMs = null;
    trial.lastDeviceMs = null;
    trial.startedAt = null;
    trial.endedAt = null;
    trial.summary = null;
    updateLiveDisplayEmpty();
  }

  function updateActiveTrialFromForm() {
    const trial = ensureActiveTrial();
    trial.name = els.trialName.value.trim() || `Proef ${trial.index}`;
    trial.variableType = els.trialVariable.value;
    trial.variableValue = els.trialValue.value.trim();
  }

  function updateLiveDisplayEmpty() {
    els.voltage.textContent = '--';
    els.current.textContent = '--';
    els.power.textContent = '--';
    els.energy.textContent = '--';
    els.powerFormula.textContent = 'Spanning (V) is de elektrische duwkracht. Stroom (A) is hoeveel elektrische lading er loopt. Vermogen (W) vertelt hoeveel energie per seconde wordt opgewekt.';
    els.energyFormula.textContent = 'Energie (Wh) is al het vermogen samengeteld over de meettijd. De tijdstap komt uit de micro:bit.';
    els.batteryLevel.style.height = '0%';
    els.chargePercent.textContent = '0.00%';
    els.timeRemaining.textContent = '-- uur resterend';
  }

  function renderTrialSummaries() {
    const rows = state.trials.filter((trial) => trial.data.length);
    if (!rows.length) {
      els.trialSummaryBody.innerHTML = '<tr><td colspan="7">Nog geen proeven opgeslagen.</td></tr>';
      return;
    }

    els.trialSummaryBody.innerHTML = rows.map((trial) => {
      const summary = summarizeTrial(trial);
      return `
        <tr>
          <td>${escapeHtml(trial.name)}</td>
          <td>${escapeHtml(trial.variableType)}</td>
          <td>${escapeHtml(trial.variableValue || '-')}</td>
          <td>${summary.durationS.toFixed(1)} s</td>
          <td>${summary.avgPower.toFixed(3)} W</td>
          <td>${summary.maxPower.toFixed(3)} W</td>
          <td>${summary.totalEnergyWh.toFixed(5)} Wh</td>
        </tr>
      `;
    }).join('');
  }

  function summarizeTrial(trial) {
    if (!trial.data.length) {
      return {
        samples: 0,
        durationS: 0,
        avgVoltage: 0,
        avgCurrent: 0,
        avgPower: 0,
        maxPower: 0,
        totalEnergyWh: 0,
      };
    }

    const last = trial.data[trial.data.length - 1];
    const durationS = last.elapsedMs / 1000;
    const avgPowerFromEnergy = durationS > 0 ? last.energyWh / (durationS / 3600) : avg(trial.data.map((point) => point.power));
    return {
      samples: trial.data.length,
      durationS,
      avgVoltage: avg(trial.data.map((point) => point.voltage)),
      avgCurrent: avg(trial.data.map((point) => point.current)),
      avgPower: avgPowerFromEnergy,
      maxPower: Math.max(...trial.data.map((point) => point.power)),
      totalEnergyWh: last.energyWh,
    };
  }

  function runReadingDiagnostics(trial, point) {
    const recent = trial.data.slice(-12);
    const issues = [];
    if (state.droppedLines > 0) {
      issues.push(`${state.droppedLines} seriële regels werden overgeslagen omdat ze geen geldige CSV waren.`);
    }
    if (point.rawVoltage < 0 || point.rawCurrent < 0) {
      issues.push('Negatieve ruwe meetwaarde ontvangen. Controleer de micro:bit berekening en bedrading.');
    }
    if (point.voltage > 0.12 && point.current < 0.001) {
      issues.push('Spanning zichtbaar maar bijna geen stroom: controleer P1, GND en de 100 Ohm meetweerstand.');
    }
    if (recent.length >= 10 && recent.every((sample) => sample.voltage < 0.02 && sample.current < 0.001)) {
      issues.push('De laatste meetpunten blijven rond nul: controleer P0/GND of laat de rotor sneller draaien.');
    }
    if (point.voltage > 3.3) {
      issues.push('Spanning boven 3.3 V gemeten. Gebruik een veilige spanningsdeler voordat de micro:bit-pin overbelast raakt.');
    }

    updateDiagnostics(`Data ontvangen via ${point.source}. ${trial.data.length} meetpunten in ${trial.name}.`, issues.length ? issues : [
      'CSV, timing en basiswaarden zien er bruikbaar uit.',
    ]);
  }

  function updateDiagnostics(summary, items) {
    if (!els.diagnosticSummary || !els.diagnosticList) {
      return;
    }
    els.diagnosticSummary.textContent = summary;
    els.diagnosticList.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  function exportCsv() {
    const measuredTrials = state.trials.filter((trial) => trial.data.length);
    if (!measuredTrials.length) {
      alert('Er zijn nog geen meetgegevens om te exporteren.');
      return;
    }

    const lines = [
      'trial,variable,value,samples,duration_s,avg_voltage_v,avg_current_a,avg_power_w,max_power_w,total_energy_wh',
      ...measuredTrials.map((trial) => {
        const summary = summarizeTrial(trial);
        return [
          csvCell(trial.name),
          csvCell(trial.variableType),
          csvCell(trial.variableValue),
          summary.samples,
          summary.durationS.toFixed(3),
          summary.avgVoltage.toFixed(4),
          summary.avgCurrent.toFixed(5),
          summary.avgPower.toFixed(5),
          summary.maxPower.toFixed(5),
          summary.totalEnergyWh.toFixed(7),
        ].join(',');
      }),
      '',
      'trial,elapsed_s,device_ms,voltage_v,current_a,power_w,energy_wh,raw_voltage_v,raw_current_a',
    ];

    measuredTrials.forEach((trial) => {
      trial.data.forEach((point) => {
        lines.push([
          csvCell(trial.name),
          (point.elapsedMs / 1000).toFixed(3),
          point.deviceMs.toFixed(0),
          point.voltage.toFixed(4),
          point.current.toFixed(5),
          point.power.toFixed(5),
          point.energyWh.toFixed(7),
          point.rawVoltage.toFixed(4),
          point.rawCurrent.toFixed(5),
        ].join(','));
      });
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'windmolengenerator_proeven.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function generatePdfReport() {
    if (!window.jspdf?.jsPDF) {
      alert('jsPDF kon niet geladen worden. Controleer vendor/jspdf.umd.min.js.');
      return;
    }

    const measuredTrials = state.trials.filter((trial) => trial.data.length);
    if (!measuredTrials.length) {
      alert('Er zijn nog geen meetgegevens om te rapporteren.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 14;
    let y = 18;

    doc.setFontSize(18);
    doc.text('Rapport Onderzoekopdracht IW', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, margin, y);
    y += 5;
    doc.text(`Studenten (${parseInt(els.inputCount.value, 10) || 1}): ${els.inputNames.value.trim() || '-'}`, margin, y);
    y += 8;

    y = addTextBlock(doc, y, 'Onderzoeksvraag', els.inputQuestion.value);
    y = addTextBlock(doc, y, 'Hypothese', els.inputHypothesis.value);
    y = addTextBlock(doc, y, 'Variabelen', [
      `Onafhankelijke variabele: ${els.inputIndependent.value || '-'}`,
      `Afhankelijke variabele: ${els.inputDependent.value || '-'}`,
    ].join('\n'));

    doc.setFontSize(12);
    doc.text('Samenvatting per proef', margin, y);
    y += 4;

    const summaryRows = measuredTrials.map((trial) => {
      const summary = summarizeTrial(trial);
      return [
        trial.name,
        trial.variableType,
        trial.variableValue || '-',
        `${summary.durationS.toFixed(1)} s`,
        `${summary.avgPower.toFixed(3)} W`,
        `${summary.maxPower.toFixed(3)} W`,
        `${summary.totalEnergyWh.toFixed(5)} Wh`,
      ];
    });

    if (doc.autoTable) {
      doc.autoTable({
        head: [['Proef', 'Variabele', 'Waarde', 'Duur', 'Gem. P', 'Max. P', 'Energie']],
        body: summaryRows,
        startY: y,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [82, 0, 255] },
      });
      y = doc.lastAutoTable.finalY + 8;
    } else {
      summaryRows.forEach((row) => {
        y = ensurePdfSpace(doc, y, 8);
        doc.text(row.join(' | '), margin, y);
        y += 5;
      });
    }

    if (comparisonChart) {
      y = ensurePdfSpace(doc, y, 92);
      doc.setFontSize(12);
      doc.text('Overlaygrafiek vermogen', margin, y);
      y += 4;
      try {
        doc.addImage(comparisonChart.toBase64Image('image/png', 1), 'PNG', margin, y, 180, 82);
        y += 90;
      } catch (err) {
        console.warn('Kon grafiek niet in PDF plaatsen:', err);
      }
    }

    y = addTextBlock(doc, y, 'Besluit', els.inputConclusion.value);
    y = addTextBlock(doc, y, 'Reflectie', els.inputReflection.value || 'Wat zou je aanpassen aan jouw fysieke windmolen?');
    y = addTextBlock(doc, y, 'Batterijmodel', `${formatNumber(BATTERY_CAPACITY_MAH, 0)} mAh batterij aan ${BATTERY_NOMINAL_V.toFixed(1)} V = ${BATTERY_WH.toFixed(2)} Wh, vergelijkbaar met een iPhone. Omzettingsverliezen en laadverliezen zijn niet meegerekend.`);

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Meetdata per seconde', margin, 18);
    const rawRows = [];
    measuredTrials.forEach((trial) => {
      downsampleBySecond(trial.data).forEach((point) => {
        rawRows.push([
          trial.name,
          (point.elapsedMs / 1000).toFixed(0),
          point.voltage.toFixed(2),
          point.current.toFixed(3),
          point.power.toFixed(3),
          point.energyWh.toFixed(5),
        ]);
      });
    });

    if (doc.autoTable) {
      doc.autoTable({
        head: [['Proef', 't (s)', 'V', 'A', 'W', 'Wh']],
        body: rawRows,
        startY: 24,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 0, 51] },
      });
    }

    doc.save('Rapport_Onderzoekopdracht_IW.pdf');
    closeOverlay(els.reportModal);
  }

  function addTextBlock(doc, y, title, text) {
    const cleanText = text?.trim() || '-';
    y = ensurePdfSpace(doc, y, 24);
    doc.setFontSize(12);
    doc.text(title, 14, y);
    y += 5;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(cleanText, 180);
    doc.text(lines, 14, y);
    return y + lines.length * 5 + 4;
  }

  function ensurePdfSpace(doc, y, needed) {
    if (y + needed > 285) {
      doc.addPage();
      return 18;
    }
    return y;
  }

  function downsampleBySecond(data) {
    const result = [];
    let lastSecond = null;
    data.forEach((point) => {
      const second = Math.floor(point.elapsedMs / 1000);
      if (second !== lastSecond) {
        result.push(point);
        lastSecond = second;
      }
    });
    return result;
  }

  function updateWorkflowState() {
    const setupInputs = [...els.setupChecklist.querySelectorAll('input[type="checkbox"]')];
    const completed = {
      prediction: Boolean(els.inputQuestion.value.trim() && els.inputHypothesis.value.trim()),
      setup: setupInputs.length > 0 && setupInputs.every((input) => input.checked),
      calibration: state.calibrated,
      measurement: state.trials.some((trial) => trial.data.length),
      comparison: state.trials.filter((trial) => trial.data.length).length >= 2,
      conclusion: Boolean(els.inputConclusion.value.trim()),
    };

    els.workflowLinks.forEach((link) => {
      link.classList.toggle('is-complete', Boolean(completed[link.dataset.stepLink]));
    });
  }

  function setActiveWorkflowLink(stepId) {
    els.workflowLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.stepLink === stepId);
    });
  }

  function openOverlay(overlay) {
    overlay.classList.remove('hidden');
  }

  function closeOverlay(overlay) {
    overlay.classList.add('hidden');
  }

  function makeTrialLabel(trial) {
    const value = trial.variableValue ? ` - ${trial.variableValue}` : '';
    return `${trial.name}: ${trial.variableType}${value}`;
  }

  function avg(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat('nl-BE', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);
  }
});
