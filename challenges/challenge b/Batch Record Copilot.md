# Challenge B — Batch Record Copilot (Notizen + Sensorik)

## Story / Kontext
In echten Anlagen sind Sensorzeitreihen selten selbsterklärend. Die wichtigsten Hinweise stehen häufig in **Schichtnotizen / Batch-Record-Freitexten** (z. B. "Filter gewechselt", "pH korrigiert", "Probe verspätet"). 

Eure Aufgabe: Baut einen Copilot, der Notizen **strukturiert**, mit Prozessdaten **verknüpft**, und daraus eine **Timeline-Erklärung** für Abweichungen vom Golden Batch ableitet.

## Aufgabenstellung
Entwickelt einen Prototypen, der:
1. Freitext-Notizen in **strukturierte Events** umwandelt (Kategorie, Zeitpunkt/Phase, betroffene Einheit).
2. Events mit Zeitreihen/Phasen **aligned** (Wo im Prozess ist das passiert?).
3. Für abweichende Batches automatisch eine **RCA-Hypothese** + offene Fragen generiert.

## Input-Daten (Dummy)
- `caseB_timeseries.csv`: Zeitreihen wie in Challenge A
- `caseB_events.csv`: synthetisches Event-Log (event_time, actor_role, event_text)
- `caseB_notes.csv`: Schichtnotizen (ein Feld pro Batch)
- `caseB_batches.csv`: Metadaten und Outcomes

## Optional: Öffentlicher Download-Datensatz (größer)
Für eine größere Übungsdatenbasis eignet sich die **IndPenSim**-Benchmark-Datenbasis (biopharma fermentation) als öffentlicher Download. Sie wird u.a. auf der offiziellen Seite und in Kaggle bereitgestellt.

Links:
- http://www.industrialpenicillinsimulation.com/
- https://www.kaggle.com/datasets/stephengoldie/big-databiopharmaceutical-manufacturing
