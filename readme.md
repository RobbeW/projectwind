# Onderzoekopdracht IW - windmolengenerator

Auteur: Robbe Wulgaert · AI in de Klas · robbewulgaert.be  
© 2026 Robbe Wulgaert. Alle rechten voorbehouden.

## Korte uitleg

Dit project is bedoeld voor een les waarin leerlingen hun zelfgebouwde windmolen echt meten. Niet alleen een grafiek bekijken, maar een onderzoek afwerken: voorspellen, opbouwen, nulpunt kiezen, meten, vergelijken en besluiten.

De website neemt de volgorde van het onderzoek op zich. Daardoor kunnen leerlingen zich richten op hun opstelling, hun meetwaarden en hun uitleg.

## Wat leerlingen doen

Leerlingen:

- voorspellen welke opstelling het meeste elektrische vermogen zal leveren;
- kiezen één variabele om te testen, bijvoorbeeld ventilatorafstand, bladhoek, belasting of kracht van de ventilator;
- controleren de opstelling met een korte checklist;
- leggen een nulpunt vast terwijl de generator stilstaat;
- voeren meerdere proeven uit;
- vergelijken proeven in één grafiek;
- schrijven een besluit en een korte reflectie;
- downloaden een PDF-rapport en eventueel een CSV-bestand met meetdata.

## Wat leerlingen oefenen

De opdracht maakt deze leerinhouden concreet:

- spanning, stroom, vermogen en energie;
- `P = V * I`;
- `E = som(P * dt)`;
- waarom een nulpunt nodig is bij metingen;
- waarom je een proef herhaalt;
- hoe je een grafiek gebruikt om een besluit te onderbouwen;
- het verschil tussen een meting en een schatting.

## Lesverloop

1. Open `index.html` als startpagina.
2. Ga naar `platform.html`.
3. Laat leerlingen hun voorspelling en hypothese invullen.
4. Controleer samen de opstelling.
5. Verbind de micro:bit of start de demomodus.
6. Kalibreer het nulpunt.
7. Meet proef 1.
8. Maak een nieuwe proef voor een andere waarde van dezelfde variabele.
9. Vergelijk de proeven.
10. Laat leerlingen hun besluit en reflectie invullen.
11. Genereer het PDF-rapport.

## Benodigdheden

- zelfgebouwde windmolen met DC-motor als generator;
- micro:bit met de juiste code;
- meetweerstand van 100 Ohm;
- gemeenschappelijke GND;
- USB-kabel die data doorgeeft;
- ventilator;
- Chrome of Edge voor WebSerial.

## Seriële data

De website verwacht data van de micro:bit op 115200 baud:

```text
tijd_ms,spanning_V,stroom_A
```

De app gebruikt `tijd_ms` uit de micro:bit voor de tijdstap `dt`. Vermogen en energie worden dus berekend met de timing van het meettoestel, niet met de klok van de browser.

WebSerial werkt het best via GitHub Pages, HTTPS of `localhost`. Als er geen hardware beschikbaar is, kan de demomodus gebruikt worden om het lesverloop te oefenen.

## Batterijmodel

De batterijvisualisatie is een schatting voor de klas, geen echte laadvoorspelling.

```text
3.361 mAh batterij aan 3.7 V = 12.44 Wh, vergelijkbaar met een iPhone.
```

Omzettingsverliezen, laadverliezen, motorefficiëntie en elektronica worden niet meegerekend. Gebruik dit deel dus om orde van grootte te bespreken.

## Bestandsstructuur

```text
Website/
|-- index.html              landingspagina
|-- platform.html           onderzoeksplatform
|-- style.css               vormgeving
|-- script.js               metingen, grafieken en rapportage
|-- readme.md
|-- media/
|   |-- landing_page_photo.jpg
|   |-- schema_tinkercad.png
|-- vendor/
|   |-- chart.umd.min.js
|   |-- jspdf.umd.min.js
|   |-- jspdf.plugin.autotable.min.js
```

In de projectmap staat ook `microbit_wind_turbine.2.0.0.hex`. Voor klasgebruik is het handig om daarnaast de bewerkbare micro:bit-code te bewaren.

## Privacy en opslag

De website gebruikt geen server en geen leerlingenaccounts. Het platform bewaart ingevulde antwoorden en meetreeksen automatisch in `localStorage` van dezelfde browser, zodat een verversing of gesloten tabblad niet meteen alle klasmetingen wist. Alleen wanneer een leerling zelf een CSV of PDF downloadt, wordt er een los bestand op het toestel bewaard.

## Voor publicatie op GitHub Pages

Plaats de inhoud van de map `Website/` in de gepubliceerde map of branch. Controleer na publicatie:

- `index.html` opent als startpagina;
- `platform.html` laadt zonder ontbrekende bestanden;
- de bestanden in `vendor/` staan mee online;
- WebSerial werkt in Chrome of Edge;
- de demomodus start ook zonder hardware.
