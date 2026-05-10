# Onderzoekopdracht IW

Auteur: Robbe Wulgaert · AI in de Klas · robbewulgaert.be  
© 2026 Robbe Wulgaert. Alle rechten voorbehouden.

Deze webapplicatie ondersteunt leerlingen bij een volledig onderzoek naar een zelfgebouwde windmolengenerator. De app is niet alleen een live monitor: ze begeleidt leerlingen door voorspellen, opbouwen, kalibreren, meten, vergelijken en besluiten.

## Wat leerlingen doen

Leerlingen:

- formuleren een onderzoeksvraag en hypothese;
- kiezen een onafhankelijke variabele, bijvoorbeeld ventilatorafstand, bladhoek of belastingsweerstand;
- controleren de hardware-opstelling met een checklist;
- leggen een nulpunt vast voor spanning en stroom;
- verzamelen meerdere proeven met dezelfde meetlogica;
- vergelijken proeven via overlaygrafieken en samenvattende waarden;
- exporteren een CSV en een PDF-rapport met conclusie en reflectie.

## Wat leerlingen leren

De les focust op:

- analoge metingen met de micro:bit;
- spanning, stroom, vermogen en energie;
- de formules `P = V * I` en `E = som(P * dt)`;
- experimentele variabelen;
- grafieken interpreteren;
- herhaalde metingen gebruiken om een conclusie sterker te maken.

## Hardware-opstelling

1. Sluit de DC-motor/generator aan op pin P0 en GND van de micro:bit.
2. Sluit een meetweerstand van 100 Ohm aan tussen pin P1 en GND.
3. Gebruik een gemeenschappelijke GND voor de volledige opstelling.
4. Verbind de micro:bit via USB met de computer.
5. Flash de micro:bit met de windturbine-code.

De webapp verwacht seriële data op 115200 baud in dit CSV-formaat:

```text
tijd_ms,spanning_V,stroom_A
```

De app gebruikt `tijd_ms` uit de micro:bit voor de tijdstap `dt`. Daardoor worden vermogen en energie berekend op basis van de timing van het meettoestel, niet op basis van de timing van de browser.

## Batterijmodel

De batterijvisualisatie is een klasmodel, geen realistische laadvoorspelling. De app vergelijkt de opgewekte energie met een batterij zoals je die in een iPhone kunt tegenkomen:

```text
3.361 mAh batterij aan 3.7 V = 12.44 Wh, vergelijkbaar met een iPhone.
```

Omzettingsverliezen, laadverliezen, motorefficientie en elektronica worden niet meegerekend. Gebruik de batterij dus om orde van grootte en energiebegrip te bespreken, niet als echte laadtijdvoorspelling.

## Klasbestendigheid

De app heeft lokale browserbibliotheken in `vendor/`:

- `chart.umd.min.js`
- `jspdf.umd.min.js`
- `jspdf.plugin.autotable.min.js`

Daardoor werken grafieken en PDF-export zonder CDN-toegang. Tailwind en Google Fonts zijn verwijderd; alle styling zit lokaal in `style.css`.

Als WebSerial niet beschikbaar is, kunnen leerlingen de demomodus gebruiken. De demomodus simuleert windstoten, meetruis en verschillende variabelen zodat de onderzoeksflow ook zonder hardware geoefend kan worden.

## Bestandsstructuur

```text
Website/
├─ index.html              # landingspagina
├─ platform.html           # onderzoeksplatform
├─ style.css
├─ script.js
├─ readme.md
├─ media/
│  └─ schema_tinkercad.png
└─ vendor/
   ├─ chart.umd.min.js
   ├─ jspdf.umd.min.js
   └─ jspdf.plugin.autotable.min.js
```

In de projectroot staat ook `microbit_wind_turbine.2.0.0.hex`. Voor klasgebruik is het sterk aanbevolen om daarnaast de bewerkbare micro:bit broncode op te nemen, zodat leerlingen en docenten kunnen zien hoe tijdstempel, spanning en stroom worden berekend.

## Gebruik

1. Open `index.html` als startpagina of ga rechtstreeks naar `platform.html`.
2. Gebruik bij voorkeur GitHub Pages, HTTPS of localhost. WebSerial werkt niet betrouwbaar vanuit elke gewone `file://` context.
3. Vul onderzoeksvraag, hypothese en variabelen in.
4. Controleer de opstelling met de checklist.
5. Verbind de micro:bit of start de demomodus.
6. Kalibreer met stilstaande generator.
7. Meet proef 1.
8. Maak een nieuwe proef voor een andere waarde van de variabele.
9. Vergelijk de proeven en exporteer CSV/PDF.

## Privacy

De website werkt zonder installatie en zonder leerlingenaccounts. Meetgegevens blijven in de browser en worden alleen opgeslagen wanneer een leerling zelf een CSV of PDF downloadt.
