/**
 * Main Application Coordinator & UI Bridge
 * Integrates Voice Recognition, NLP Intent Engine, A* Pathfinding,
 * 2D Canvas Physics Engine, Telemetry HUD, and Research Test Suite.
 */

class AssistiveRoboticsApp {
  constructor() {
    this.history = [];
    this.initCore();
    this.initUI();
    this.bindEvents();
    this.startSimulationLoop();
  }

  initCore() {
    // 1. Initialize Subsystems
    this.nlp = new IntentRecognitionEngine(CONFIG.INTENTS);
    this.pathFinder = new PathFinder(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT, CONFIG.CANVAS.GRID_SIZE);
    this.lidar = new LidarSensor(CONFIG.ROBOT.LIDAR);
    this.robot = new AssistiveRobot(CONFIG.STATIONS.HOME, this.pathFinder, this.lidar);

    // 2. Canvas & Rendering
    this.env = new SimulationEnvironment('simCanvas', this.robot, this.pathFinder, this.lidar);

    // 3. Speech & Voice Synthesis
    this.speech = new SpeechController({
      onTranscript: (data) => this.handleVoiceTranscript(data),
      onStatusChange: (status) => this.handleVoiceStatusChange(status),
      onError: (msg) => this.showVoiceAlert(msg, 'error')
    });

    // Connect Speech to Robot voice confirmations
    this.robot.onAudioAnnounce = (phrase) => this.speech.speak(phrase);
    this.robot.onStatusChange = (telemetry) => this.updateTelemetryUI(telemetry);

    // 4. Test Suite & Demo Controller
    this.testSuite = new ResearchTestSuite(this.robot, this.nlp, this);
    this.demoController = new DemoController(this);
  }

  initUI() {
    // Attach audio visualizer canvas
    const visualizerEl = document.getElementById('audioVisualizer');
    if (visualizerEl) {
      this.speech.attachVisualizer(visualizerEl);
    }

    // Populate initial state
    this.updateTelemetryUI(this.robot.getTelemetry());
    this.renderCommandHistory();
  }

  bindEvents() {
    // --- Microphone Button ---
    const micBtn = document.getElementById('micButton');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (this.speech.isListening) {
          this.speech.stopListening();
        } else {
          this.speech.startListening();
        }
      });
    }

    // --- Text Command Input & Execute ---
    const textForm = document.getElementById('textCommandForm');
    const textInput = document.getElementById('textCommandInput');
    if (textForm && textInput) {
      textForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cmd = textInput.value.trim();
        if (cmd) {
          this.executeVoiceCommand(cmd, true);
          textInput.value = '';
        }
      });
    }

    // --- Sample Command Chips ---
    document.querySelectorAll('.sample-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd') || chip.innerText.trim();
        if (textInput) textInput.value = cmd;
        this.executeVoiceCommand(cmd, true);
      });
    });

    // --- Manual D-Pad Controls ---
    const btnUp = document.getElementById('btnDriveForward');
    const btnDown = document.getElementById('btnDriveBackward');
    const btnLeft = document.getElementById('btnTurnLeft');
    const btnRight = document.getElementById('btnTurnRight');
    const btnStop = document.getElementById('btnEmergencyStop');
    const btnReset = document.getElementById('btnResetSim');

    if (btnUp) btnUp.addEventListener('click', () => this.robot.executeDirectionalCommand('MOVE_FORWARD'));
    if (btnDown) btnDown.addEventListener('click', () => this.robot.executeDirectionalCommand('MOVE_BACKWARD'));
    if (btnLeft) btnLeft.addEventListener('click', () => this.robot.executeDirectionalCommand('TURN_LEFT'));
    if (btnRight) btnRight.addEventListener('click', () => this.robot.executeDirectionalCommand('TURN_RIGHT'));
    if (btnStop) btnStop.addEventListener('click', () => this.robot.emergencyStop());
    if (btnReset) btnReset.addEventListener('click', () => {
      this.robot.reset(CONFIG.STATIONS.HOME);
      this.speech.speak('Simulation reset to home base dock.');
    });

    // Keyboard shortcuts (W/A/S/D / Arrows / Space for stop)
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in text command input
      if (document.activeElement === textInput) return;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          this.robot.executeDirectionalCommand('MOVE_FORWARD');
          break;
        case 's':
        case 'arrowdown':
          this.robot.executeDirectionalCommand('MOVE_BACKWARD');
          break;
        case 'a':
        case 'arrowleft':
          this.robot.executeDirectionalCommand('TURN_LEFT');
          break;
        case 'd':
        case 'arrowright':
          this.robot.executeDirectionalCommand('TURN_RIGHT');
          break;
        case ' ': // Spacebar for emergency stop
          e.preventDefault();
          this.robot.emergencyStop();
          break;
      }
    });

    // --- Canvas Toggles ---
    const toggleLidar = document.getElementById('toggleLidar');
    const togglePath = document.getElementById('togglePath');
    const toggleGrid = document.getElementById('toggleGrid');

    if (toggleLidar) toggleLidar.addEventListener('change', (e) => this.env.showLidarRays = e.target.checked);
    if (togglePath) togglePath.addEventListener('change', (e) => this.env.showPlannedPath = e.target.checked);
    if (toggleGrid) toggleGrid.addEventListener('change', (e) => this.env.showGrid = e.target.checked);

    // --- Sound Mute Toggle ---
    const muteBtn = document.getElementById('btnMuteAudio');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = this.speech.toggleMute();
        muteBtn.innerHTML = isMuted ? '🔇 Audio: Muted' : '🔊 Audio: On';
        muteBtn.classList.toggle('active', isMuted);
      });
    }

    // --- One-Click Guided Demo Button ---
    const demoBtn = document.getElementById('btnRunDemo');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => this.handleRunDemo(demoBtn));
    }

    // --- Tab Switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // --- Research Test Suite Controls ---
    const runTestsBtn = document.getElementById('btnRunAllTests');
    if (runTestsBtn) {
      runTestsBtn.addEventListener('click', () => this.handleRunAllTests(runTestsBtn));
    }
  }

  /**
   * Handle Voice Recognition Event
   */
  handleVoiceTranscript(data) {
    const rawTranscriptEl = document.getElementById('rawTranscriptText');
    if (rawTranscriptEl) {
      rawTranscriptEl.textContent = `"${data.transcript}"`;
    }

    if (data.isFinal && data.transcript.trim().length > 0) {
      this.executeVoiceCommand(data.transcript, true);
    }
  }

  handleVoiceStatusChange(status) {
    const statusPill = document.getElementById('voiceStatusPill');
    const micBtn = document.getElementById('micButton');
    const statusMsg = document.getElementById('voiceStatusMessage');

    if (statusMsg) statusMsg.textContent = status.message;

    if (statusPill) {
      statusPill.className = 'status-pill ' + status.state.toLowerCase();
      statusPill.textContent = status.state;
    }

    if (micBtn) {
      if (status.state === 'LISTENING') {
        micBtn.classList.add('listening');
      } else {
        micBtn.classList.remove('listening');
      }
    }
  }

  showVoiceAlert(msg, type = 'info') {
    const alertBox = document.getElementById('voiceAlertBanner');
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.className = `alert-banner ${type}`;
      alertBox.style.display = 'block';
      setTimeout(() => {
        alertBox.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Execute Voice or Text Command through NLP and Robotics Dispatch
   */
  executeVoiceCommand(commandText, allowVoiceReply = true) {
    const nlpResult = this.nlp.process(commandText);

    // 1. Update AI Command Processing Panel
    this.updateAIPanel(nlpResult);

    // 2. Add to History
    this.addToHistory(commandText, nlpResult);

    // 3. Execution logic
    if (!nlpResult.success) {
      // Ambiguous or unsupported
      if (allowVoiceReply) {
        this.speech.speak('I did not understand that command. Please repeat clearly, or check the sample commands.');
      }
      return false;
    }

    // Command accepted -> Dispatch to Assistive Robot
    const action = nlpResult.action;

    switch (action) {
      case 'MOVE_FORWARD':
      case 'MOVE_BACKWARD':
      case 'TURN_LEFT':
      case 'TURN_RIGHT':
        this.robot.executeDirectionalCommand(action);
        if (allowVoiceReply) this.speech.speak(`Executing ${nlpResult.label.toLowerCase()}`);
        break;

      case 'STOP':
        this.robot.emergencyStop();
        break;

      case 'NAVIGATE_PATIENT':
      case 'DELIVER_MEDICINE':
      case 'HELP_EMERGENCY':
      case 'NAVIGATE_CHARGING':
      case 'NAVIGATE_HOME':
        this.robot.startMission(action);
        break;
    }

    return true;
  }

  /**
   * Update AI Command Processing Panel
   */
  updateAIPanel(result) {
    const rawEl = document.getElementById('aiRawInput');
    const recognizedEl = document.getElementById('aiRecognizedCmd');
    const intentEl = document.getElementById('aiDetectedIntent');
    const actionEl = document.getElementById('aiSelectedAction');
    const confidenceValEl = document.getElementById('aiConfidenceValue');
    const confidenceBarEl = document.getElementById('aiConfidenceBar');
    const statusBadgeEl = document.getElementById('aiExecutionStatus');
    const decisionRuleEl = document.getElementById('aiDecisionRule');
    const matchedTokensEl = document.getElementById('aiMatchedTokens');

    if (rawEl) rawEl.textContent = result.rawInput || 'None';
    if (recognizedEl) recognizedEl.textContent = result.recognizedText ? `"${result.recognizedText}"` : 'None';
    if (intentEl) intentEl.textContent = result.label || 'Unclassified';
    if (actionEl) actionEl.textContent = result.action || 'No Action Triggered';

    // Confidence
    const pct = result.confidencePct !== undefined ? result.confidencePct : 0;
    if (confidenceValEl) confidenceValEl.textContent = `${pct}%`;
    if (confidenceBarEl) {
      confidenceBarEl.style.width = `${pct}%`;
      confidenceBarEl.className = 'confidence-fill ' + (pct >= 80 ? 'high' : pct >= 55 ? 'medium' : 'low');
    }

    // Status Badge
    if (statusBadgeEl) {
      statusBadgeEl.textContent = result.status;
      statusBadgeEl.className = 'status-tag ' + (result.success ? 'success' : 'rejected');
    }

    // Explainable rationale
    if (decisionRuleEl) decisionRuleEl.textContent = result.decisionRule || 'Awaiting input.';
    if (matchedTokensEl) {
      matchedTokensEl.innerHTML = (result.matchedKeywords && result.matchedKeywords.length > 0)
        ? result.matchedKeywords.map(k => `<span class="token-pill">${k}</span>`).join(' ')
        : '<span class="text-muted">None</span>';
    }
  }

  /**
   * Update live Telemetry gauges in UI
   */
  updateTelemetryUI(t) {
    const elPos = document.getElementById('hudPos');
    const elHeading = document.getElementById('hudHeading');
    const elSpeed = document.getElementById('hudSpeed');
    const elBatteryVal = document.getElementById('hudBattery');
    const elBatteryBar = document.getElementById('hudBatteryBar');
    const elState = document.getElementById('hudState');
    const elTask = document.getElementById('hudTask');
    const elCargo = document.getElementById('hudCargo');
    const elLidarDist = document.getElementById('hudLidarDist');
    const elObstacleAlert = document.getElementById('hudObstacleAlert');

    if (elPos) elPos.textContent = `X: ${t.x} px, Y: ${t.y} px`;
    if (elHeading) elHeading.textContent = `${t.headingDeg}°`;
    if (elSpeed) elSpeed.textContent = `${t.linearVelocity} px/frame`;

    if (elBatteryVal) elBatteryVal.textContent = `${t.battery}%`;
    if (elBatteryBar) {
      elBatteryBar.style.width = `${t.battery}%`;
      elBatteryBar.className = 'battery-fill ' + (t.battery > 50 ? 'green' : t.battery > 20 ? 'amber' : 'red');
    }

    if (elState) {
      elState.textContent = t.state;
      elState.className = 'state-badge ' + t.state.toLowerCase();
    }

    if (elTask) elTask.textContent = t.activeTask;

    if (elCargo) {
      elCargo.innerHTML = t.hasMedicineCargo
        ? '<span class="cargo-loaded">💊 Prescription Pack Loaded</span>'
        : '<span class="cargo-empty">Empty (Standby)</span>';
    }

    if (elLidarDist) elLidarDist.textContent = `${t.minLidarDistance} px`;

    if (elObstacleAlert) {
      if (t.isObstacleAhead) {
        elObstacleAlert.style.display = 'inline-flex';
      } else {
        elObstacleAlert.style.display = 'none';
      }
    }
  }

  /**
   * Command History Tracker
   */
  addToHistory(cmdText, nlpResult) {
    const timeStr = new Date().toLocaleTimeString();
    this.history.unshift({
      time: timeStr,
      command: cmdText,
      intent: nlpResult.label || 'Unrecognized',
      action: nlpResult.action || 'None',
      confidence: nlpResult.confidencePct || 0,
      status: nlpResult.status
    });

    if (this.history.length > 20) this.history.pop();
    this.renderCommandHistory();
  }

  renderCommandHistory() {
    const container = document.getElementById('commandHistoryList');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = '<div class="empty-history">No voice or text commands executed yet.</div>';
      return;
    }

    container.innerHTML = this.history.map(item => `
      <div class="history-item ${item.status === 'ACCEPTED' ? 'success' : 'rejected'}">
        <div class="history-header">
          <span class="history-cmd">"${item.command}"</span>
          <span class="history-time">${item.time}</span>
        </div>
        <div class="history-details">
          <span>Intent: <strong>${item.intent}</strong></span>
          <span>Match: <strong>${item.confidence}%</strong></span>
          <span class="status-chip ${item.status.toLowerCase()}">${item.status}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Tab Navigation (Simulation Dashboard, Architecture, Research Test Suite)
   */
  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.toggle('active', section.id === tabId);
    });
  }

  /**
   * Run Research Test Suite
   */
  async handleRunAllTests(btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Executing Test Cases...';

    const testProgressEl = document.getElementById('testProgressText');
    const tableBody = document.getElementById('testResultsTableBody');

    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Initialising research test suite...</td></tr>';

    await this.testSuite.runAll(
      // Progress Callback
      (progress) => {
        if (testProgressEl) {
          testProgressEl.textContent = `Running Test ${progress.currentIndex} / ${progress.total}: ${progress.currentTest ? progress.currentTest.name : 'Completed'}`;
        }
        if (progress.allResults) {
          this.renderTestTable(progress.allResults);
        }
      },
      // Completion Callback
      (results) => {
        btn.disabled = false;
        btn.textContent = '▶ Run Automated Research Tests';
        const passedCount = results.filter(r => r.passed).length;
        if (testProgressEl) {
          testProgressEl.innerHTML = `<strong>Benchmark Complete:</strong> ${passedCount} / ${results.length} Tests Passed (${Math.round(passedCount / results.length * 100)}% Success Rate).`;
        }
        this.renderTestTable(results);
      }
    );
  }

  renderTestTable(results) {
    const tableBody = document.getElementById('testResultsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = results.map(r => `
      <tr class="${r.passed ? 'row-pass' : 'row-fail'}">
        <td><strong>${r.id}</strong></td>
        <td>${r.name}</td>
        <td><code>"${r.command}"</code></td>
        <td>${r.expectedIntent}</td>
        <td><span class="confidence-badge">${r.confidence}%</span></td>
        <td>${r.latencyMs} ms</td>
        <td><span class="test-badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? '✓ PASS' : '✗ FAIL'}</span></td>
      </tr>
    `).join('');
  }

  /**
   * One-Click Interactive Demonstration
   */
  async handleRunDemo(btn) {
    if (this.demoController.isActive) {
      this.demoController.stop();
      btn.textContent = '▶ One-Click Demonstration';
      btn.classList.remove('running');
      return;
    }

    btn.textContent = '⏹ Stop Demonstration';
    btn.classList.add('running');

    const demoBanner = document.getElementById('demoBanner');
    const demoTitle = document.getElementById('demoStepTitle');
    const demoDesc = document.getElementById('demoStepDesc');

    if (demoBanner) demoBanner.style.display = 'block';

    await this.demoController.start(
      (step) => {
        if (demoTitle) demoTitle.textContent = step.stepTitle;
        if (demoDesc) demoDesc.textContent = step.narrative;
      },
      () => {
        btn.textContent = '▶ One-Click Demonstration';
        btn.classList.remove('running');
        if (demoBanner) demoBanner.style.display = 'none';
      }
    );
  }

  /**
   * 60FPS Physics Simulation & Render Loop
   */
  startSimulationLoop() {
    const loop = () => {
      // 1. Advance robot physics & kinematics
      this.robot.update(CONFIG.WALLS, CONFIG.OBSTACLES);

      // 2. Render Canvas 2D scene
      this.env.render();

      // 3. Update HUD
      this.updateTelemetryUI(this.robot.getTelemetry());

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Global App Instance Initialization on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AssistiveRoboticsApp();
});
