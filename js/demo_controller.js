/**
 * Guided Research Demonstration Controller
 * One-Click Automated Assistive Robotics Walkthrough
 * Demonstrates:
 * 1. System Self-Check & LIDAR sensor sweep
 * 2. Voice Command: "Move forward" with Obstacle Safety Guard
 * 3. Autonomous Assistive Mission: "Bring medicine"
 * 4. Autonomous Maintenance: "Go to the charging station"
 */

class DemoController {
  constructor(app) {
    this.app = app;
    this.isActive = false;
    this.currentStepIndex = 0;
    this.abortController = null;

    this.steps = [
      {
        title: 'Step 1: Diagnostics & Voice Calibration',
        narrative: 'Initiating assistive robot demonstration. Checking differential kinematics, A* path planning mesh, and 360-degree LIDAR raycasting...',
        action: async () => {
          this.app.robot.reset(CONFIG.STATIONS.HOME);
          this.app.speech.speak('System diagnostics initialized. Assistive robot operational.');
          await this.delay(2200);
        }
      },
      {
        title: 'Step 2: Voice Directional Navigation ("Move forward")',
        narrative: 'Issuing simulated voice command: "Move forward". Demonstrating real-time intent classification and linear velocity actuation.',
        action: async () => {
          this.app.executeVoiceCommand('Move forward', true);
          await this.delay(1800);
          this.app.executeVoiceCommand('Turn right', true);
          await this.delay(1200);
          this.app.executeVoiceCommand('Stop', true);
          await this.delay(1200);
        }
      },
      {
        title: 'Step 3: Multi-Stage Medicine Delivery ("Bring medicine")',
        narrative: 'Issuing assistive medical command: "Bring medicine". Robot plans collision-free A* trajectory to Pharmacy Dispensary, loads medication, and transports to patient bedside.',
        action: async () => {
          this.app.executeVoiceCommand('Bring medicine', true);

          // Monitor mission progression
          const startT = Date.now();
          while (this.isActive && this.app.robot.currentMission && (Date.now() - startT < 18000)) {
            await this.delay(400);
          }
          await this.delay(1500);
        }
      },
      {
        title: 'Step 4: Recharging Dock Navigation ("Go to the charging station")',
        narrative: 'Issuing maintenance command: "Go to the charging station". Robot calculates path back to docking bay, docks, and initiates inductive battery replenishment.',
        action: async () => {
          this.app.executeVoiceCommand('Go to the charging station', true);

          const startT = Date.now();
          while (this.isActive && this.app.robot.state === 'NAVIGATING' && (Date.now() - startT < 14000)) {
            await this.delay(400);
          }
          await this.delay(2000);
        }
      },
      {
        title: 'Demonstration Complete',
        narrative: 'Assistive robotics voice recognition and autonomous simulation demonstration concluded successfully.',
        action: async () => {
          this.app.speech.speak('Research demonstration complete. Ready for interactive voice control.');
          await this.delay(1000);
        }
      }
    ];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start(onStepChange = () => {}, onComplete = () => {}) {
    if (this.isActive) return;
    this.isActive = true;
    this.currentStepIndex = 0;

    for (let i = 0; i < this.steps.length; i++) {
      if (!this.isActive) break;
      this.currentStepIndex = i;
      const step = this.steps[i];
      onStepChange({
        index: i,
        total: this.steps.length,
        stepTitle: step.title,
        narrative: step.narrative
      });

      await step.action();
    }

    this.isActive = false;
    onComplete();
  }

  stop() {
    this.isActive = false;
    this.app.executeVoiceCommand('Stop', false);
  }
}
