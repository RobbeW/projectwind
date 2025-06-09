
# Monitor Windmolengenerator

**© 2025 Robbe Wulgaert · AI in de Klas**

Deze webapplicatie stelt leerlingen (13–14 jaar) in staat om op een interactieve manier de spanning, stroom en geproduceerde energie van een zelfgebouwde windmolengenerator te meten en analyseren met behulp van een BBC micro:bit.

---

## Inhoud
1. [Overzicht](#overzicht)
2. [Hardware-opstelling](#hardware-opstelling)
3. [Software-architectuur](#software-architectuur)
4. [Installatie en gebruik](#installatie-en-gebruik)
5. [Structuur van de bestanden](#structuur-van-de-bestanden)
6. [Licentie](#licentie)

---

## Overzicht
De Monitor Windmolengenerator bestaat uit:

- **Micro:bit Python-script** (`wind_turbine.py`) dat:
  - Analoge pin P0 uitleest om de spanning (in volt) te berekenen.
  - Analoge pin P1 gebruikt met een 100 Ω weerstand om de stroom (in ampère) via de Wet van Ohm te berekenen.
  - De waarden met een timestamp (ms sinds boot) in CSV-formaat naar de seriële poort stuurt (115200 baud).
  - Steekproefsgewijze averaging gebruikt voor stabiele metingen.

- **Webinterface**:
  - **HTML/CSS/JS** met Tailwind CSS en Chart.js voor real-time plotting van spanning en stroom.
  - Een geanimeerde iPhone-mockup (uit eerder project) die visueel laat zien hoe snel een iPhone-batterij (3 361 mAh) geladen zou worden.
  - Overlays voor het tonen van het circuitschema en duidelijke instructies.
  - PDF-rapportage (jsPDF & AutoTable) met 1 meetpunt per seconde en samenvattingen.


## Hardware-opstelling
1. Sluit de DC-motor (windmolengenerator) aan op pin P0 en GND van de micro:bit.  
2. Verbind een 100 Ω weerstand tussen pin P1 en GND.  
3. Zet de micro:bit via USB op de computer.


## Software-architectuur

### Micro:bit-code (`wind_turbine.py`)
- `uart.init(baudrate=115200)`
- `read_average(pin, count)` voor ADC-averaging.
- Berekening van **volts** en **amps**.
- Verzending: `timestamp,volts,amps\n`.
- Loop-interval met `running_time()` voor consistente sample-rate (100 ms).

### Webapp
- **HTML**: knoppen voor verbinden, starten, stoppen, rapport genereren en schema tonen.
- **CSS**:
  - Tailwind voor lay-out en modals.
  - Aangepaste iPhone- en batterij-styling voor animatie.
- **JavaScript** (`script.js`):
  - WebSerial API voor live data.
  - `LineBreakTransformer` voor regel-gebaseerde parsing.
  - Chart.js zonder animaties (`animation.duration = 0`) voor realtime plotting.
  - Batterij-volgorde: Wh-accumulatie en % berekening.
  - Rapportfunctie met 1 datapunt per seconde.
  - Overlays (schema + instructies).


## Installatie en gebruik
1. **Clone** de repository: ```git clone https://github.com/RobbeW/projectwind.git```
2. **Plaats** `wind_turbine.py` op de micro\:bit (bijv. via Mu-editor).
3. **Open** `index.html` in een moderne Chrome- of Edge-browser (HTTPS of `localhost`). Of klik [hier](https://robbew.github.io/projectwind)
4. Klik op **Verbind met micro\:bit**, **Start meting**, en bekijk de live grafiek en batterijanimatie.
5. Klik op **Genereer PDF** voor een uitgebreid rapport.

## Structuur van de bestanden

```
/ (root)
├─ index.html             # Webinterface
├─ style.css              # Custom styling (iPhone, batterij, overlays)
├─ script.js              # JavaScript voor data, chart en rapport
├─ media/
│   └─ schema_tinkercad.png  # Circuit schema
└─ microbit/
    └─ wind_turbine.py    # Python script voor micro:bit
```

## Licentie

Dit project valt onder de **MIT License**. 

---

*Voor onderwijsdoeleinden ontwikkeld door Robbe Wulgaert - AI in de Klas (Sint‑Lievenscollege Gent, Universiteit Antwerpen). Neem bij vragen contact op via [robbe.wulgaert@sintlievenscollege.be](mailto:robbe.wulgaert@sintlievenscollege.be).*


