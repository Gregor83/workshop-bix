# Challenge A: Golden Batch Detective (Teams 1 + 2)

## Worum es geht

In der Biopharma-Produktion ist jede Charge ("Batch") ein komplexes, mehrtägiges Zusammenspiel hunderter Variablen. Erfahrene Anlagenfahrer erkennen oft intuitiv, wenn _"etwas komisch läuft"_, aber diese Intuition lässt sich nicht skalieren und nicht auf Nachtschichten oder neue Mitarbeiter oder andere Standorte _übertragen_. Gleichzeitig wird eine Abweichung oft erst dann offensichtlich, wenn es zu spät ist, um gegenzusteuern.
Die Idee hinter dem _"Golden Batch Detective"_: Wenn wir aus historischen, erfolgreichen Chargen das _typische Profil lernen_ ("welche Werte laufen wann in welchen Bereichen") dann können wir neue Chargen live gegen dieses Profil halten und _Abweichungen erkennen, lange bevor sie kritisch werden_. Und mehr noch: Wir können sagen, _welche Variablen und welche Phasen_ die Abweichung treiben.

## Was Ihr Prototyp leisten soll:

_Golden-Batch-Profil lernen_: Aus historischen Batch-Zeitreihen ein _statistisches Referenzprofil ableiten_ (z. B. Mittelwert- und Streuungsbänder pro Phase und Variable, oder ein ausgefeilteres Repräsentationsmodell).
_Deviation Detection_: Für eine neue (laufende oder abgeschlossene) _Charge frühzeitig erkennen, an welchen Stellen sie vom Profil abweicht_.
_Driver-Analyse_: Nicht nur dass etwas abweicht, sondern _was die Abweichung treibt_: welche Variablen, welche Phasen, welcher Zeitpunkt.
_Operator-Report_: Ein kurzer, handlungsorientierter _Bericht (2-6 Sätze)_ für den Anlagenfahrer. Zielgruppe ist eine _Person am Produktionsmonitor_, keine Data-Science-Abteilung.

## Zielbild

Eine Art _Frühwarnsystem_, das einer Produktionsleitung sagen kann: "In Charge 042 läuft seit 14 Stunden der Sauerstoffeintrag am unteren Rand des Normalbandes; In Phase 3 war das historisch ein Vorbote verringerter Ausbeute. _Empfehlung_: Rührerdrehzahl prüfen."

## Methodische Stichworte zum Einarbeiten

Time-Series Analysis, Statistical Process Control (SPC), Anomaly Detection, multivariate Distanzmaße (z. B. Mahalanobis), Phase Segmentation, Feature Attribution. Für den Report-Teil: strukturiertes Prompting, Tool-Use, ggf. Agentic-AI-Patterns.

## Für wen das interessant ist

Wer gerne mit Zeitreihen arbeitet, Freude an statistischer Modellierung hat und die Verbindung von Analytik und Natural-Language-Output reizvoll findet. Gute Challenge, wenn Sie solide Data-Science-Grundlagen vertiefen und mit Agentic-AI-Konzepten verbinden möchten.

_Zur Erinnerung: Im Quickstarter sind nur Abschnitte 1-3 Setup. Abschnitte 4-9 sind Arbeitsmaterial für den Hackathon._

# TEIL 1: DIE ERSTEN 60 MINUTEN IM TEAM

## Los geht's: Verstehen, was die Starter-App tut

Ihr _Startpunkt_ ist die App unter _apps/streamlit-agent/_. Die hat Brabandt,Christoph (BI X) BIX-DE-I als funktionierenden Mini-Agenten vorbereitet. Die Architektur ist bewusst einfach: zwei Schritte:
_Planner_: Nimmt Ihre Frage, erstellt einen kurzen Aktionsplan (2-4 Bullets)
_Actor_: Führt den Plan aus, kann dabei Werkzeuge (Tools) aufrufen: aktuell nur einen Taschenrechner

Die _zentrale Datei ist apps/streamlit-agent/agent/graph.py_. Öffnen Sie diese Datei in _Cursor_ und nutzen Sie den Cursor-Chat (Strg+L bzw. Cmd+L):
**„Erkläre mir den Code in @graph.py Schritt für Schritt. Was passiert, wenn ein User eine Frage stellt? Was macht der Planner, was macht der Actor?"**
Cursor kennt den Code und wird Ihnen eine verständliche Erklärung liefern. Das ist kein Schummeln, genau so ist der Workshop konzipiert.
Zweite wichtige Datei: _apps/streamlit-agent/agent/tools.py_ : dort sind die _verfügbaren Werkzeuge definiert_. Aktuell nur der Calculator. Im Laufe des Hackathons werden Sie hier _eigene Tools_ hinzufügen.

## Weiter geht's: API-Key eintragen und erste Interaktion

Sobald Sie Ihren Team-API-Key von BI X erhalten haben:
_.env-Datei öffnen_
**OPENROUTER_API_KEY=** mit dem _echten Key_ ausfüllen
Im Terminal (_mit aktiviertem .venv_): **streamlit run apps/streamlit-agent/app.py**
Im _Browser_ testen: **„Berechne (12 \* 8) + 5 und erkläre die Schritte."**
Wenn eine Antwort kommt, lebt Ihr Agent.

## Daten sichten und Rollen klären

Im Ordner _challenges/ liegen die Datensätze_ für Ihre Challenge. Alle Challenges arbeiten mit der gleichen Grundstruktur:
Eine _Batches-CSV mit Metadaten pro Charge_ (batch*id, Produkt, Schicht, Dauer, Qualität, Yield, ob anomal und warum)
Eine \_Timeseries-CSV mit Zeitreihen*: Zeitstempel, normierter Prozessfortschritt (t*pct, 0-100%), Prozessphase und 6-7 Sensorvariablen
Alle Batches durchlaufen \_7 Phasen*: Charge > HeatUp > React > Hold > CoolDown > Transfer > CIP

### Klären Sie im Team drei Fragen:

_Was genau soll am Ende stehen?_ (Nochmal das Challenge-Briefing lesen, die Bullet-Points unter _„Was Ihr Prototyp leisten soll"_ sind Ihre Spezifikation.) - _Framing und Scope_
_Wer macht was?_ Nicht jeder muss coden. Sinnvolle Rollen: Agent-Entwicklung, Datenanalyse, Prompt-Design und Output-Qualität, Präsentation, Projektsteuerung und Zeitmanagement. - _Aufgabenverteilung_
_Was ist Ihr MVP?_ Was muss am Samstag um 12:00 mindestens stehen, damit Sie etwas Vorzeigbares haben? Alles darüber hinaus ist Bonus. - _Priorisierung_

## Das Grundprinzip: Iterativ arbeiten.

Kleinsten funktionierenden Schritt identifizieren
Implementieren (Cursor-Chat nutzen!)
Testen: läuft es? Gibt die Ausgabe Sinn?
Nächsten Schritt
Beschreiben Sie im Cursor-Chat, was Sie brauchen. _Referenzieren Sie Dateien mit @-Mention (@graph.py, @tools.py)_. Cursor kann Code schreiben, erklären, debuggen und refactoren.

# TEIL 2: CHALLENGE A: GOLDEN BATCH DETECTIVE

_Die Daten_:
_caseA_timeseries.csv_ : 22.400 Zeilen, 160 Batches, Spalten: batch*id, timestamp, t_pct, phase, temp_C, pressure_bar, pH, agitator_rpm, feed_A_Lph, feed_B_Lph
\_caseA_batches.csv* : 160 Zeilen, Spalten u. a.: is*anomalous (0/1), anomaly_type (z. B. heatup_slow, ph_drift, pressure_spike, rpm_high, feed_low), root_cause_label, quality_pass, yield_kg
\_121 Batches sind normal, 39 sind anomal*, das _Label is_anomalous_ sagt Ihnen, welche welche sind. Ihre Aufgabe ist es, dieses **Wissen in einen Agenten zu überführen, der das ohne Label erkennt**.

## Mini-Beispiel für die erste Stunde:

_Ziel_: Einen Batch als Zeitreihe laden, visualisieren und gegen die "guten" Batches vergleichen.
_Cursor-Prompt 1_: Daten laden:
**„Lade challenges/caseA_batches.csv in ein pandas DataFrame. Zeige mir: wie viele Batches gibt es, wie viele sind anomal (is_anomalous), welche anomaly_type-Werte kommen vor?"**
_Cursor-Prompt 2_: Einen Batch plotten:
**„Lade challenges/caseA_timeseries.csv. Erstelle einen Streamlit-Plot, der für Batch A_B001 den Verlauf von temp_C über t_pct zeigt. Färbe die Hintergrundabschnitte nach der Spalte phase ein."**
_Cursor-Prompt 3_: Normal vs. anomal vergleichen:
**„Plotte den Mittelwert und die Standardabweichung von temp_C über t_pct für alle normalen Batches (is_anomalous == 0) als Band. Lege den Verlauf von Batch A_B003 (anomal, Typ heatup_slow) darüber. Wo weicht er ab?"**
Das ist noch kein Golden-Batch-Profil, aber nach 30 Minuten sehen Sie die Daten, verstehen die Phasen und haben ein _erstes Gefühl für "normal vs. abweichend"_.

## Roter Faden:

Daten _verstehen_ > _Referenzprofil_ aus normalen Batches bauen (Mittelwert/Streuung pro Phase und Variable) > Neuen Batch dagegen _prüfen_ > _Abweichungs-Treiber_ identifizieren (welche Variable, welche Phase?) > _Agent orchestriert_ den Flow > _Operator-Report_ als LLM-Output (2-6 Sätze)

# TEIL 3: TIPPS FÜR ALLE TEAMS

## Cursor richtig nutzen

Cursor ist nicht nur Texteditor, es ist Ihr _KI-Teammitglied_ (und benötigt dann natürlich auch einen Namen ). Nutzen Sie den Chat (Strg+L / Cmd+L) für alles: _Code erklären, Bugs finden, Features bauen, Prompts optimieren_. Referenzieren Sie Dateien mit @-Mention (@graph.py, @tools.py, @caseA_batches.csv), damit Cursor den Kontext hat.

## Den Starter-Agenten erweitern

Der Agent in _graph.py hat aktuell zwei Nodes_ (Planner > Actor) und _ein Tool_ (Calculator). Ihr Job ist, diesen _Agenten für Ihre Challenge umzubauen_:
_Neue Tools in tools.py_ hinzufügen (z. B. ein Tool, das Batch-Daten lädt, oder eines, das einen Plot erstellt)
_System-Prompts anpassen_ (der Planner und Actor brauchen domänenspezifische Anweisungen)
_Neue Nodes hinzufügen_, wenn Ihr Flow komplexer wird (z. B. ein separater Analyse-Node) Cursor-Prompt dafür: **„Erkläre mir, wie ich in @graph.py einen dritten Node hinzufüge und wie ich in @tools.py ein neues Tool registriere."**
_Modelle bewusst wählen_
In der .env das Modell wechseln.

# Vorschlag Zeitmanagement

_Freitag 09:30-12:00_: Daten verstehen, erstes Mini-Ergebnis, Architektur skizzieren
_Freitag 12:00-17:30_: Prototyp bauen, iterativ erweitern
_Samstag 09:00-11:00_: Prototyp finalisieren, Edge-Cases testen
_Samstag 11:00-12:00_: Präsentation bauen, nicht unterschätzen
_Samstag 12:00_: Präsentationen

## Wenn Sie stecken bleiben

_Cursor fragen_: Fehlermeldung in den Chat kopieren
_Im Teams-Kanal posten_
_Coaching-Angebot nutzen_

# Definition und Hinweise

geklaut aus challenges/challenge\ a/Golden\ Batch\ Detective.md

_Der Begriff **"Golden Batch"** beschreibt einen idealen Lauf, der als **Benchmark** für spätere Batches dient._

_Agentic AI Idee (optional)_
_- Agent 1: Data Prep (Phasen, Normalisierung)_
_- Agent 2: Monitoring/Anomaly_
_- Agent 3: RCA + Report_
