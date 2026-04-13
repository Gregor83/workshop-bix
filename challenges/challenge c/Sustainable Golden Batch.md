# Challenge C — Sustainable Golden Batch (Qualität + Energie)

## Story / Kontext
Produktion bedeutet nicht nur "Qualität schaffen", sondern auch **Energie und CO₂** im Griff zu haben. Zwei Batches können beide "pass" sein, aber einer verbraucht deutlich mehr Energie (z. B. längere Heizphasen, zu hohe Rührleistung, ungünstige Rampen). 

Eure Aufgabe: Definiert einen "Sustainable Golden Batch" als Benchmark, der **Qualität hält** und gleichzeitig **Energieverbrauch minimiert**.

## Aufgabenstellung
Entwickelt einen Prototypen, der:
1. Batches hinsichtlich **Energieeffizienz** clustert oder scored.
2. Ein Golden-Profil für **power_kW / energy_kWh** (über Phasen) ableitet.
3. Für ineffiziente Batches die **Top-Hebel** identifiziert (Welche Phase/Variable treibt Mehrverbrauch?).
4. Einen **Management-Summary** (max. 8 Sätze) erzeugt.

## Input-Daten (Dummy)
- `caseC_timeseries.csv`: Zeitreihen inkl. `power_kW`
- `caseC_batches.csv`: Energie (energy_kWh), Qualität (quality_pass), Yield
