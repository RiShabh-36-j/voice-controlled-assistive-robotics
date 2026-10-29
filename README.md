# AI-Based Voice Command Recognition for Assistive Robotic Systems
> **College Engineering Research Project Demonstration**  
> *A software-only autonomous robotic simulation featuring real-time speech recognition, explainable NLP intent classification, collision avoidance, and assistive healthcare missions.*

---

## 1. Executive Summary & Objective

In healthcare and assisted-living environments, patients with limited mobility require hands-free interaction with robotic care assistants. This project demonstrates an **AI-based voice command recognition system** for an autonomous assistive healthcare robot operating in real-time inside an interactive 2D simulation environment.

### Key Highlights
- **100% Software-Only Simulation:** Zero external microcontrollers, Arduino boards, or physical sensors required.
- **Web Speech API Voice Recognition:** High-fidelity microphone listening with visual audio wave pulsation and verbal Text-to-Speech (TTS) confirmations.
- **Explainable AI Intent-Matching Engine:** Transparent multi-metric classification combining canonical phrase Levenshtein edit distance, keyword anchor coverage, and Jaccard token overlap.
- **Autonomous A\* Pathfinding & Pure Pursuit:** Grid-based A* path planning with 20px obstacle inflation and line-of-sight smoothing around walls and hospital furniture.
- **360° Simulated LIDAR Raycasting:** 36-ray laser scanner providing continuous obstacle clearance and autonomous collision braking.
- **Multi-Phase Assistive Missions:** Supports complex compound missions including Pharmacy Medicine Delivery, Patient Bedside Assistance, Emergency SOS Dispatch, and Inductive Dock Recharging.
- **Zero Paid APIs / Zero External Keys:** Runs completely locally in any modern Chromium browser.

---

## 2. System Architecture & Dataflow

```
+-------------------------------------------------------------------------------+
|                             SYSTEM ARCHITECTURE                               |
+-------------------------------------------------------------------------------+

[ 1. Voice Input ]         🎙️ User speaks voice instruction into microphone
         │
         ▼
[ 2. Speech Recognition ]  📝 Web Speech API (SpeechRecognition / webkitSpeechRecognition)
         │                    Converts acoustic waveform to text transcript
         ▼
[ 3. Explainable NLP ]     🧠 Tokenization & Medical Synonym Normalization
         │                    Levenshtein String Similarity + Jaccard Token Overlap
         │                    Confidence Score Calculation [0% - 100%]
         ▼
[ 4. Safety & Dispatch ]   🛡️ Ambiguity Gate (Rejects commands with confidence < 55%)
         │                    Finite State Machine (FSM) Mission Dispatcher
         ▼
[ 5. Path & Kinematics ]   🧭 Grid A* Path Planner (Obstacle Inflation Costmap)
         │                    Differential Drive Kinematics (v, ω, heading θ)
         ▼
[ 6. 2D Simulation ]       📡 960x600 Canvas Engine with 360° LIDAR Raycaster
         │                    Audio Voice Synthesizer (TTS) & Real-time Telemetry HUD
```

---

## 3. Supported Voice Commands & Intent Lexicon

| Canonical Command | Category | Matched Action | Recognized Variations / Synonyms |
| :--- | :--- | :--- | :--- |
| **“Move forward”** | Directional | `MOVE_FORWARD` | “go ahead”, “move ahead”, “advance”, “go forward”, “drive ahead” |
| **“Move backward”** | Directional | `MOVE_BACKWARD` | “go back”, “reverse”, “retreat”, “move back”, “step back” |
| **“Turn left”** | Directional | `TURN_LEFT` | “rotate left”, “spin left”, “go left”, “pivot left”, “left turn” |
| **“Turn right”** | Directional | `TURN_RIGHT` | “rotate right”, “spin right”, “go right”, “pivot right”, “right turn” |
| **“Stop”** | Safety | `STOP` | “please stop”, “emergency stop”, “halt”, “freeze”, “brake”, “cancel” |
| **“Move to the patient”** | Assistive Mission | `NAVIGATE_PATIENT` | “go to patient”, “help the patient”, “assist patient”, “patient room”, “bedside” |
| **“Bring medicine”** | Assistive Mission | `DELIVER_MEDICINE` | “get medicine”, “fetch medicine”, “deliver pills”, “bring pills”, “bring medication” |
| **“Help me”** | Emergency Assist | `HELP_EMERGENCY` | “emergency”, “i need help”, “sos”, “assist me”, “urgent help” |
| **“Go to the charging station”** | Maintenance | `NAVIGATE_CHARGING` | “recharge”, “dock”, “charge battery”, “go charge”, “return to charger” |
| **“Go home”** | Maintenance | `NAVIGATE_HOME` | “return home”, “go to base”, “return to start”, “home position” |

---

## 4. Assistive Healthcare Functions

### 1. Directional Navigation & Continuous Control
- Direct translation and steering via voice commands or manual D-pad.
- Differential wheel drive simulation with animated motorized track treads.

### 2. Multi-Stage Medicine Delivery Mission (`DELIVER_MEDICINE`)
1. **Dispensary Transit:** Robot calculates A* path and drives from its current location to the **Pharmacy Dispensary** (top-right bay).
2. **Payload Dispense & Load:** Pauses for 2.2 seconds at the counter with a dispensing chime; a physical medicine pack appears in the robot's rear cargo hold.
3. **Bedside Transit:** Robot re-plans route across the central transit corridor to the **Patient Bedside Ward** (bottom-right bay).
4. **Delivery Handover:** Robot announces completion: *"Medication delivery complete. Prescribed dosage ready for the patient."* and offloads cargo.

### 3. Patient Assistance Mode (`NAVIGATE_PATIENT`)
- Autonomous collision-free navigation directly to patient bedside with verbal check-in: *"At patient bedside. How may I assist you?"*

### 4. Emergency Distress Assistance (`HELP_EMERGENCY`)
- High-urgency dispatch to the patient room accompanied by flashing red/amber beacon alerts and audio distress acknowledgments.

### 5. Inductive Dock Recharging (`NAVIGATE_CHARGING`)
- Robot navigates to the charging bay, docks with contact plates, and recharges its battery with animated inductive charge arcs.

### 6. Collision Prevention & 360° LIDAR
- Casts 36 active laser rays every frame.
- Automatically halts linear translation if an obstacle breaches the 35px safety threshold in the forward cone ($\pm 35^\circ$).

---

## 5. Explainable AI Intent-Matching Algorithm

To comply with engineering research standards, the system rejects opaque black-box assumptions in favor of a **transparent, explainable multi-metric NLP algorithm**:

$$\text{Composite Confidence } C = 0.45 \cdot S_{\text{phrase}} + 0.40 \cdot K_{\text{coverage}} + 0.15 \cdot J_{\text{tokens}}$$

Where:
- $S_{\text{phrase}} = 1 - \frac{\text{Levenshtein}(T_{\text{input}}, T_{\text{canonical}})}{\max(|T_{\text{input}}|, |T_{\text{canonical}}|)}$
- $K_{\text{coverage}} = \frac{|T_{\text{tokens}} \cap K_{\text{intent}}|}{\min(|T_{\text{tokens}}|, |K_{\text{intent}}|)}$
- $J_{\text{tokens}} = \frac{|T_{\text{tokens}} \cap K_{\text{intent}}|}{|T_{\text{tokens}} \cup K_{\text{intent}}|}$

### Safety Ambiguity Guard
If $C < 0.55$, the command is classified as **`AMBIGUOUS_REJECTED`**. Rather than executing a potentially hazardous motion in a clinical setting, the system halts and politely instructs the user:
> *"I did not understand that command. Please repeat clearly, or check the sample commands."*

---

## 6. Predefined Research Benchmark Test Suite

The dashboard includes a dedicated **Research Benchmark & Testing Tab** that evaluates the system against 7 empirical test cases with live execution verification:

| Test ID | Test Name | Input Command | Verification Condition |
| :--- | :--- | :--- | :--- |
| **TC-01** | Directional Forward Translation | `"Move forward"` | Linear velocity $v > 0$ and displacement $> 12\text{px}$ along heading |
| **TC-02** | Directional Backward Reversal | `"Move backward"` | Linear velocity $v < 0$ and reverse displacement $> 10\text{px}$ |
| **TC-03** | Angular Steering: Turn Left | `"Turn left"` | Angular velocity $\omega < 0$ and counter-clockwise heading rotation |
| **TC-04** | Angular Steering: Turn Right | `"Turn right"` | Angular velocity $\omega > 0$ and clockwise heading rotation |
| **TC-05** | Emergency Safety Braking | `"Stop"` | Instantaneous motor cut-off ($v = 0, \omega = 0$, latency $< 40\text{ms}$) |
| **TC-06** | Autonomous Patient Assistance | `"Move to the patient"` | A* collision-free navigation to patient bedside within $60\text{px}$ tolerance |
| **TC-07** | Multi-Phase Medicine Delivery | `"Bring medicine"` | Pharmacy arrival $\to$ cargo load $\to$ patient transfer confirmation |

---

## 7. Installation & Quick Start Guide

### Prerequisites
- Modern web browser: **Google Chrome**, **Microsoft Edge**, or **Brave** (Chromium-based browsers have native Web Speech API support).
- Python 3.x (for serving over `http://localhost` to enable browser microphone permissions).

### Quick Launch (Windows 1-Click)
Double-click `run.bat` in the project root directory. This will start the server and automatically launch your default browser to:
```
http://localhost:8000
```

### Manual Launch (Command Line)
```bash
# Navigate to the project directory
cd voice-controlled-assistive-robotics

# Start the local server
python server.py
# (or: python -m http.server 8000)

# Open in browser:
# http://localhost:8000
```

> **Important Note on Microphone Permissions:**  
> The Web Speech API requires serving from `http://localhost` or `https://`. When first opening the page, click **"Allow"** when prompted for microphone access in your browser's address bar.

---

## 8. File Structure

```
voice-controlled-assistive-robotics/
├── index.html              # Main HTML5 Engineering Dashboard & Simulation Shell
├── css/
│   └── styles.css          # Dark Navy Engineering Research Lab Theme
├── js/
│   ├── config.js           # Environment coordinates, map partitions, and intent dictionary
│   ├── nlp.js              # Explainable NLP engine with multi-metric scoring
│   ├── pathfinding.js      # Grid-based A* pathfinder with obstacle inflation
│   ├── sensors.js          # 360° LIDAR raycasting and collision detection
│   ├── robot.js            # Differential drive kinematics, battery, cargo, and FSM
│   ├── environment.js      # 2D Canvas renderer (stations, patient, robot, lidar, trails)
│   ├── speech.js           # Web Speech API recognition & speech synthesis (TTS)
│   ├── test_suite.js       # Predefined research test case benchmark suite
│   ├── demo_controller.js  # Automated one-click demonstration walkthrough
│   └── app.js              # Application coordinator and UI controller
├── server.py               # Lightweight Python HTTP server with CORS headers
├── run.bat                 # Windows 1-click batch launcher
├── .gitignore              # Standard git ignore file
└── README.md               # Research documentation & technical manual
```

---

## 9. Academic Citation / Presentation Reference

If using this project for academic evaluation or research presentation:
```
Project Title: AI-Based Voice Command Recognition for Assistive Robotic Systems
Domain: Assistive Healthcare Robotics, Human-Robot Interaction (HRI), Software Simulation
Keywords: Web Speech API, Explainable NLP, Intent Classification, A* Pathfinding, 2D LIDAR Simulation
```
