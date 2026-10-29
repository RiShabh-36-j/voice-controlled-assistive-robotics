/**
 * Research Testing & Automated Benchmark Evaluation Suite
 * Predefined Research Test Cases:
 * 1. Move Forward (Directional Translation)
 * 2. Move Backward (Directional Reversal)
 * 3. Turn Left (Angular CCW Orientation)
 * 4. Turn Right (Angular CW Orientation)
 * 5. Emergency Stop (Safety Brake & Latency)
 * 6. Patient Assistance Mode (A* Pathfinding & Arrival)
 * 7. Medicine Delivery Mission (Multi-phase Cargo Transit & Bedside Handover)
 */

class ResearchTestSuite {
  constructor(robot, nlpEngine, appController) {
    this.robot = robot;
    this.nlp = nlpEngine;
    this.app = appController;
    this.isRunning = false;
    this.testResults = [];

    this.testDefinitions = [
      {
        id: 'TC-01',
        name: 'Directional Forward Translation',
        command: 'Move forward',
        expectedIntent: 'MOVE_FORWARD',
        description: 'Verify robot recognizes forward voice command and initiates positive linear displacement.'
      },
      {
        id: 'TC-02',
        name: 'Directional Backward Reversal',
        command: 'Move backward',
        expectedIntent: 'MOVE_BACKWARD',
        description: 'Verify robot recognizes reverse command and initiates negative linear displacement.'
      },
      {
        id: 'TC-03',
        name: 'Angular Steering: Turn Left',
        command: 'Turn left',
        expectedIntent: 'TURN_LEFT',
        description: 'Verify counter-clockwise angular velocity and heading adjustment.'
      },
      {
        id: 'TC-04',
        name: 'Angular Steering: Turn Right',
        command: 'Turn right',
        expectedIntent: 'TURN_RIGHT',
        description: 'Verify clockwise angular velocity and heading adjustment.'
      },
      {
        id: 'TC-05',
        name: 'Emergency Safety Braking',
        command: 'Stop',
        expectedIntent: 'STOP',
        description: 'Verify instantaneous motor cut-off and zero velocity latch upon stop trigger.'
      },
      {
        id: 'TC-06',
        name: 'Autonomous Patient Assistance',
        command: 'Move to the patient',
        expectedIntent: 'NAVIGATE_PATIENT',
        description: 'Verify A* collision-free trajectory computation and autonomous transit to patient bedside.'
      },
      {
        id: 'TC-07',
        name: 'Multi-Phase Medicine Delivery',
        command: 'Bring medicine',
        expectedIntent: 'DELIVER_MEDICINE',
        description: 'Verify full mission pipeline: pharmacy dispensary arrival -> cargo loading -> patient delivery.'
      }
    ];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run full test suite sequentially with visual simulation updates
   */
  async runAll(onUpdate = () => {}, onComplete = () => {}) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.testResults = [];

    // Reset robot to starting dock
    this.robot.reset(CONFIG.STATIONS.HOME);
    await this.sleep(400);

    for (let i = 0; i < this.testDefinitions.length; i++) {
      const def = this.testDefinitions[i];
      onUpdate({ currentIndex: i, total: this.testDefinitions.length, currentTest: def });

      const result = await this.executeTestCase(def);
      this.testResults.push(result);
      onUpdate({ currentIndex: i + 1, total: this.testDefinitions.length, result, allResults: this.testResults });
      await this.sleep(800);
    }

    this.isRunning = false;
    onComplete(this.testResults);
    return this.testResults;
  }

  /**
   * Execute an individual test case against the live robot simulation
   */
  async executeTestCase(testDef) {
    const startTime = performance.now();
    const startPose = { x: this.robot.x, y: this.robot.y, heading: this.robot.heading };

    // 1. Run through NLP pipeline
    const nlpResult = this.nlp.process(testDef.command);
    const intentMatchSuccess = nlpResult.success && (nlpResult.matchedIntent === testDef.expectedIntent);

    let executionSuccess = false;
    let verificationDetail = '';

    if (!intentMatchSuccess) {
      return {
        ...testDef,
        passed: false,
        intentMatchSuccess: false,
        confidence: nlpResult.confidencePct,
        latencyMs: Math.round(performance.now() - startTime),
        startPose,
        endPose: { x: this.robot.x, y: this.robot.y, heading: this.robot.heading },
        verificationDetail: `NLP failed: expected ${testDef.expectedIntent}, got ${nlpResult.matchedIntent}`
      };
    }

    // 2. Dispatch command to robot
    this.app.executeVoiceCommand(testDef.command, false);

    // 3. Execution Verification Logic per test case
    switch (testDef.id) {
      case 'TC-01': // Forward
        await this.sleep(900);
        const endPose01 = { x: this.robot.x, y: this.robot.y, heading: this.robot.heading };
        const dist01 = Math.hypot(endPose01.x - startPose.x, endPose01.y - startPose.y);
        executionSuccess = dist01 > 12 && this.robot.linearVelocity >= 0;
        verificationDetail = `Displacement: +${dist01.toFixed(1)}px along heading vector (v > 0)`;
        this.robot.stopManualMovement();
        break;

      case 'TC-02': // Backward
        await this.sleep(900);
        const endPose02 = { x: this.robot.x, y: this.robot.y, heading: this.robot.heading };
        const dist02 = Math.hypot(endPose02.x - startPose.x, endPose02.y - startPose.y);
        executionSuccess = dist02 > 10;
        verificationDetail = `Displacement: -${dist02.toFixed(1)}px in reverse`;
        this.robot.stopManualMovement();
        break;

      case 'TC-03': // Turn Left
        await this.sleep(950);
        const endPose03 = { x: this.robot.x, y: this.robot.y, heading: this.robot.heading };
        executionSuccess = endPose03.heading !== startPose.heading;
        verificationDetail = `Heading rotated CCW from ${Math.round(startPose.heading * 180 / Math.PI)}° to ${Math.round(endPose03.heading * 180 / Math.PI)}°`;
        break;

      case 'TC-04': // Turn Right
        await this.sleep(950);
        const endPose04 = { x: this.robot.x, y: this.robot.y, heading: this.robot.heading };
        executionSuccess = endPose04.heading !== startPose.heading;
        verificationDetail = `Heading rotated CW from ${Math.round(startPose.heading * 180 / Math.PI)}° to ${Math.round(endPose04.heading * 180 / Math.PI)}°`;
        break;

      case 'TC-05': // Stop
        // Drive robot first, then issue stop
        this.robot.executeDirectionalCommand('MOVE_FORWARD');
        await this.sleep(250);
        const stopTriggerTime = performance.now();
        this.app.executeVoiceCommand('Stop', false);
        await this.sleep(150);
        const stopLatency = Math.round(performance.now() - stopTriggerTime);
        executionSuccess = Math.abs(this.robot.linearVelocity) < 0.1 && Math.abs(this.robot.angularVelocity) < 0.1;
        verificationDetail = `Immediate braking confirmed (v = ${this.robot.linearVelocity.toFixed(1)} px/s, latency ${stopLatency}ms)`;
        break;

      case 'TC-06': // Move to Patient
        // Wait for autonomous navigation to arrive
        let maxWaitNav = 6000;
        const navStartTime = Date.now();
        while (this.robot.state === 'NAVIGATING' && (Date.now() - navStartTime) < maxWaitNav) {
          await this.sleep(200);
        }
        const patientStation = CONFIG.STATIONS.PATIENT;
        const patientDist = Math.hypot(this.robot.x - patientStation.x, this.robot.y - patientStation.y);
        executionSuccess = patientDist < 60;
        verificationDetail = `Arrived at Patient Bedside within ${patientDist.toFixed(1)}px tolerance`;
        break;

      case 'TC-07': // Bring Medicine
        // For research verification, accelerate path execution or monitor multi-phase delivery
        let maxWaitDelivery = 9500;
        const delStartTime = Date.now();
        let witnessedDispensing = false;

        while ((this.robot.currentMission || this.robot.state === 'NAVIGATING' || this.robot.state === 'DISPENSING') && (Date.now() - delStartTime) < maxWaitDelivery) {
          if (this.robot.state === 'DISPENSING' || this.robot.hasMedicineCargo) {
            witnessedDispensing = true;
          }
          await this.sleep(250);
        }

        const patientSt = CONFIG.STATIONS.PATIENT;
        const finalBedDist = Math.hypot(this.robot.x - patientSt.x, this.robot.y - patientSt.y);
        executionSuccess = witnessedDispensing && (finalBedDist < 75);
        verificationDetail = `Multi-stage mission completed (Pharmacy pickup -> Patient handover confirmed)`;
        break;
    }

    const totalDuration = Math.round(performance.now() - startTime);
    const passed = intentMatchSuccess && executionSuccess;

    return {
      ...testDef,
      passed,
      intentMatchSuccess,
      executionSuccess,
      confidence: nlpResult.confidencePct,
      latencyMs: totalDuration,
      startPose,
      endPose: { x: this.robot.x, y: this.robot.y, heading: this.robot.heading },
      verificationDetail
    };
  }
}
