/**
 * Robotic Assistant Kinematic Controller & Mission State Machine
 * Features:
 * - Differential drive kinematics with wheel rotation animation
 * - Autonomous A* waypoint follower with Pure Pursuit steering
 * - Multi-phase assistive missions (Medicine Delivery, Patient Assist, Charging, Emergency Stop)
 * - LIDAR-driven obstacle safety braking and collision prevention
 * - Battery depletion & charging dynamics
 */

class AssistiveRobot {
  constructor(startStation = CONFIG.STATIONS.HOME, pathFinder, lidar) {
    this.pathFinder = pathFinder;
    this.lidar = lidar;

    // Spatial State
    this.x = startStation.x;
    this.y = startStation.y;
    this.heading = 0; // Radians (0 = pointing East)
    this.linearVelocity = 0;
    this.angularVelocity = 0;
    this.targetLinearVelocity = 0;
    this.targetAngularVelocity = 0;

    // Physical dimensions & limits
    this.radius = CONFIG.ROBOT.RADIUS;
    this.maxSpeed = CONFIG.ROBOT.MAX_SPEED;
    this.reverseSpeed = CONFIG.ROBOT.REVERSE_SPEED;
    this.accel = CONFIG.ROBOT.ACCELERATION;
    this.decel = CONFIG.ROBOT.DECELERATION;
    this.turnSpeed = CONFIG.ROBOT.TURN_SPEED;

    // Wheel animation tracking (radians)
    this.leftWheelAngle = 0;
    this.rightWheelAngle = 0;

    // Battery & Energy
    this.battery = 88.0; // Starts at 88%
    this.isDocked = false;

    // Mission & Assistive State Machine
    this.state = 'IDLE'; // IDLE, MOVING, NAVIGATING, DISPENSING, DELIVERING, CHARGING, EMERGENCY_STOP
    this.activeTask = 'System Standby';
    this.currentMission = null; // { type: 'MEDICINE_DELIVERY', stage: 1, ... }
    this.activePath = [];
    this.currentWaypointIndex = 0;

    // Cargo Payload
    this.hasMedicineCargo = false;
    this.medicineDetails = null;

    // Safety & Obstacle
    this.obstacleBrakeActive = false;
    this.emergencyStopEngaged = false;
    this.totalDistanceTravelled = 0;

    // Callbacks for events (status changes, mission completion, TTS announcements)
    this.onStatusChange = null;
    this.onMissionStep = null;
    this.onAudioAnnounce = null;
  }

  /**
   * Reset robot to initial base position
   */
  reset(station = CONFIG.STATIONS.HOME) {
    this.x = station.x;
    this.y = station.y;
    this.heading = 0;
    this.linearVelocity = 0;
    this.angularVelocity = 0;
    this.targetLinearVelocity = 0;
    this.targetAngularVelocity = 0;
    this.leftWheelAngle = 0;
    this.rightWheelAngle = 0;
    this.state = 'IDLE';
    this.activeTask = 'System Standby - Ready for Voice Command';
    this.currentMission = null;
    this.activePath = [];
    this.currentWaypointIndex = 0;
    this.hasMedicineCargo = false;
    this.medicineDetails = null;
    this.emergencyStopEngaged = false;
    this.obstacleBrakeActive = false;
    this.isDocked = false;

    if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
  }

  /**
   * Immediate Emergency Stop
   */
  emergencyStop() {
    this.emergencyStopEngaged = true;
    this.targetLinearVelocity = 0;
    this.targetAngularVelocity = 0;
    this.linearVelocity = 0;
    this.angularVelocity = 0;
    this.activePath = [];
    this.currentMission = null;
    this.state = 'EMERGENCY_STOP';
    this.activeTask = 'EMERGENCY STOPPED - All Motors Locked';

    if (this.onAudioAnnounce) {
      this.onAudioAnnounce('Emergency stop engaged. Robot halted immediately.');
    }
    if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
  }

  /**
   * Resume / Clear Emergency Stop latch
   */
  clearEmergencyStop() {
    this.emergencyStopEngaged = false;
    this.state = 'IDLE';
    this.activeTask = 'System Standby - Ready';
    if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
  }

  /**
   * Execute manual directional action from Voice or UI
   */
  executeDirectionalCommand(action) {
    if (this.emergencyStopEngaged) {
      this.clearEmergencyStop();
    }

    // Cancel any active autonomous navigation
    this.activePath = [];
    this.currentMission = null;

    switch (action) {
      case 'MOVE_FORWARD':
        this.targetLinearVelocity = this.maxSpeed;
        this.targetAngularVelocity = 0;
        this.state = 'MOVING_FORWARD';
        this.activeTask = 'Manual Drive: Forward';
        break;

      case 'MOVE_BACKWARD':
        this.targetLinearVelocity = -this.reverseSpeed;
        this.targetAngularVelocity = 0;
        this.state = 'MOVING_BACKWARD';
        this.activeTask = 'Manual Drive: Reverse';
        break;

      case 'TURN_LEFT':
        this.targetLinearVelocity = 0;
        this.targetAngularVelocity = -this.turnSpeed * 1.5;
        this.state = 'TURNING_LEFT';
        this.activeTask = 'Manual Rotate: Left (Counter-Clockwise)';
        // Timed rotation for stepped turn
        setTimeout(() => {
          if (this.state === 'TURNING_LEFT') {
            this.targetAngularVelocity = 0;
            this.state = 'IDLE';
            this.activeTask = 'Rotation Complete - Standby';
            if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
          }
        }, 900);
        break;

      case 'TURN_RIGHT':
        this.targetLinearVelocity = 0;
        this.targetAngularVelocity = this.turnSpeed * 1.5;
        this.state = 'TURNING_RIGHT';
        this.activeTask = 'Manual Rotate: Right (Clockwise)';
        setTimeout(() => {
          if (this.state === 'TURNING_RIGHT') {
            this.targetAngularVelocity = 0;
            this.state = 'IDLE';
            this.activeTask = 'Rotation Complete - Standby';
            if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
          }
        }, 900);
        break;

      case 'STOP':
        this.stopManualMovement();
        break;
    }

    if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
  }

  stopManualMovement() {
    this.targetLinearVelocity = 0;
    this.targetAngularVelocity = 0;
    if (this.state !== 'EMERGENCY_STOP' && this.state !== 'CHARGING') {
      this.state = 'IDLE';
      this.activeTask = 'System Standby - Ready';
    }
    if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
  }

  /**
   * Plan and execute autonomous navigation to a target station
   */
  navigateToStation(stationId, taskName = 'Autonomous Navigation') {
    if (this.emergencyStopEngaged) {
      this.clearEmergencyStop();
    }

    const station = CONFIG.STATIONS[stationId];
    if (!station) {
      console.error('Unknown station ID:', stationId);
      return false;
    }

    const path = this.pathFinder.findPath(this.x, this.y, station.x, station.y);
    if (!path || path.length === 0) {
      console.warn('Could not compute path to', station.name);
      this.activeTask = `Navigation Failed: Target unreachable (${station.name})`;
      if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
      return false;
    }

    this.activePath = path;
    this.currentWaypointIndex = 0;
    this.state = 'NAVIGATING';
    this.activeTask = `Navigating to ${station.name}`;
    this.isDocked = false;

    if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
    return true;
  }

  /**
   * Start high-level assistive mission
   */
  startMission(missionType) {
    if (this.emergencyStopEngaged) {
      this.clearEmergencyStop();
    }

    switch (missionType) {
      case 'NAVIGATE_PATIENT':
        this.currentMission = { type: 'NAVIGATE_PATIENT', stage: 1 };
        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('Acknowledged. Navigating to patient bedside for assistance.');
        }
        this.navigateToStation('PATIENT', 'Patient Assistance: Moving to Bedside');
        break;

      case 'DELIVER_MEDICINE':
        this.currentMission = {
          type: 'DELIVER_MEDICINE',
          stage: 1, // 1: Go to pharmacy, 2: Dispense, 3: Deliver to patient, 4: Done
          prescription: 'Med-Pack 500mg'
        };
        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('Initiating medicine delivery. First navigating to pharmacy dispensary.');
        }
        this.navigateToStation('MEDICINE', 'Medicine Mission: Fetching from Pharmacy');
        break;

      case 'HELP_EMERGENCY':
        this.currentMission = { type: 'HELP_EMERGENCY', stage: 1 };
        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('Urgent help requested! Dispatched immediately to patient bedside.');
        }
        this.navigateToStation('PATIENT', 'EMERGENCY DISPATCH: Direct to Patient');
        break;

      case 'NAVIGATE_CHARGING':
        this.currentMission = { type: 'NAVIGATE_CHARGING', stage: 1 };
        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('Navigating to recharging dock for battery replenishment.');
        }
        this.navigateToStation('CHARGER', 'Returning to Charging Station');
        break;

      case 'NAVIGATE_HOME':
        this.currentMission = { type: 'NAVIGATE_HOME', stage: 1 };
        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('Returning to home base dock.');
        }
        this.navigateToStation('HOME', 'Returning to Home Base');
        break;
    }
  }

  /**
   * Advance mission state upon reaching intermediate waypoints / goals
   */
  handleGoalArrival() {
    if (!this.currentMission) {
      this.state = 'IDLE';
      this.activeTask = 'Arrived at Destination - Standby';
      if (this.onAudioAnnounce) this.onAudioAnnounce('Destination reached.');
      if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
      return;
    }

    const mission = this.currentMission;

    if (mission.type === 'NAVIGATE_PATIENT' || mission.type === 'HELP_EMERGENCY') {
      this.state = 'IDLE';
      this.activeTask = 'At Patient Bedside - Ready to Assist';
      this.currentMission = null;
      if (this.onAudioAnnounce) {
        this.onAudioAnnounce('I have arrived at the patient bedside. How may I assist you?');
      }
      if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
    }
    else if (mission.type === 'DELIVER_MEDICINE') {
      if (mission.stage === 1) {
        // Arrived at Pharmacy Dispensary
        this.state = 'DISPENSING';
        this.activeTask = 'Pharmacy Dispensary: Loading Medication Pack...';
        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('At pharmacy dispensary. Dispensing and securing prescribed medication.');
        }
        if (this.onStatusChange) this.onStatusChange(this.getTelemetry());

        // Dispensing dwell time (2.2 seconds simulated load)
        setTimeout(() => {
          if (this.emergencyStopEngaged) return;
          this.hasMedicineCargo = true;
          this.medicineDetails = { name: 'Prescription Pack', dose: '1 Capsule', time: '12:00' };
          mission.stage = 2;
          this.activeTask = 'Medication Secured. Navigating to Patient Room...';

          if (this.onAudioAnnounce) {
            this.onAudioAnnounce('Medication loaded. Transporting directly to patient bedside.');
          }

          // Stage 2: Navigate from Pharmacy to Patient Bedside
          this.navigateToStation('PATIENT', 'Delivering Medication to Patient');
        }, 2200);
      }
      else if (mission.stage === 2) {
        // Arrived at Patient with medicine!
        this.state = 'IDLE';
        this.activeTask = 'Medicine Delivered Successfully to Patient Bedside';
        this.hasMedicineCargo = false;
        this.medicineDetails = null;
        this.currentMission = null;

        if (this.onAudioAnnounce) {
          this.onAudioAnnounce('Medication delivery complete. Prescribed dosage ready for the patient.');
        }
        if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
      }
    }
    else if (mission.type === 'NAVIGATE_CHARGING') {
      this.state = 'CHARGING';
      this.isDocked = true;
      this.activeTask = 'Docked at Recharging Station (Charging Battery)';
      this.currentMission = null;
      if (this.onAudioAnnounce) {
        this.onAudioAnnounce('Docked at recharging station. Inductive charging initiated.');
      }
      if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
    }
    else if (mission.type === 'NAVIGATE_HOME') {
      this.state = 'IDLE';
      this.isDocked = true;
      this.activeTask = 'Docked at Home Base - Standby';
      this.currentMission = null;
      if (this.onAudioAnnounce) {
        this.onAudioAnnounce('Successfully returned to home base.');
      }
      if (this.onStatusChange) this.onStatusChange(this.getTelemetry());
    }
  }

  /**
   * Main Per-Frame Physics, Kinematics & Waypoint Tracking Update
   */
  update(walls, obstacles) {
    // 1. Run LIDAR scan
    const lidarData = this.lidar.update(this.x, this.y, this.heading, walls, obstacles);

    // 2. Obstacle Braking Guard
    // If moving forward and obstacle is within safety brake distance
    if (this.targetLinearVelocity > 0 && lidarData.isObstacleAhead) {
      this.obstacleBrakeActive = true;
      this.targetLinearVelocity = 0;
      if (this.state === 'NAVIGATING') {
        this.activeTask = 'Safety Pause: Obstacle Detected in Path - Rerouting...';
      } else {
        this.activeTask = 'Safety Brake: Proximity Obstacle Detected Ahead';
      }
    } else {
      this.obstacleBrakeActive = false;
    }

    // 3. Waypoint Navigation Logic (Autonomous Path Following)
    if (this.state === 'NAVIGATING' && this.activePath.length > 0) {
      const targetWaypoint = this.activePath[this.currentWaypointIndex];
      if (targetWaypoint) {
        const dx = targetWaypoint.x - this.x;
        const dy = targetWaypoint.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Calculate target heading angle
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - this.heading;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Waypoint arrival threshold
        if (dist < 22) {
          this.currentWaypointIndex++;
          if (this.currentWaypointIndex >= this.activePath.length) {
            // Reached final destination
            this.activePath = [];
            this.targetLinearVelocity = 0;
            this.targetAngularVelocity = 0;
            this.handleGoalArrival();
          }
        } else {
          // Steering controller:
          // Turn towards waypoint if angle difference is significant
          if (Math.abs(angleDiff) > 0.15) {
            this.targetAngularVelocity = Math.sign(angleDiff) * Math.min(this.turnSpeed * 1.6, Math.abs(angleDiff));
            // Slow down or pause forward movement while making sharp turn
            this.targetLinearVelocity = Math.abs(angleDiff) > 0.6 ? 0.3 : this.maxSpeed * 0.65;
          } else {
            this.targetAngularVelocity = angleDiff * 0.8;
            this.targetLinearVelocity = this.maxSpeed;
          }
        }
      }
    }

    // 4. Smooth Velocity Acceleration / Deceleration
    if (this.linearVelocity < this.targetLinearVelocity) {
      this.linearVelocity = Math.min(this.targetLinearVelocity, this.linearVelocity + this.accel);
    } else if (this.linearVelocity > this.targetLinearVelocity) {
      this.linearVelocity = Math.max(this.targetLinearVelocity, this.linearVelocity - this.decel);
    }

    if (this.angularVelocity < this.targetAngularVelocity) {
      this.angularVelocity = Math.min(this.targetAngularVelocity, this.angularVelocity + this.turnSpeed * 0.4);
    } else if (this.angularVelocity > this.targetAngularVelocity) {
      this.angularVelocity = Math.max(this.targetAngularVelocity, this.angularVelocity - this.turnSpeed * 0.4);
    }

    // 5. Update Heading
    this.heading += this.angularVelocity;
    // Normalize heading to [0, 2*PI)
    while (this.heading < 0) this.heading += Math.PI * 2;
    while (this.heading >= Math.PI * 2) this.heading -= Math.PI * 2;

    // 6. Kinematic Displacement & Collision Check
    if (Math.abs(this.linearVelocity) > 0.001) {
      const vx = Math.cos(this.heading) * this.linearVelocity;
      const vy = Math.sin(this.heading) * this.linearVelocity;

      const nextX = this.x + vx;
      const nextY = this.y + vy;

      // Check physical collision before moving
      const collidesX = this.lidar.isPositionColliding(nextX, this.y, this.radius, walls, obstacles);
      const collidesY = this.lidar.isPositionColliding(this.x, nextY, this.radius, walls, obstacles);

      if (!collidesX) {
        this.x = nextX;
      } else {
        this.linearVelocity *= 0.2;
      }

      if (!collidesY) {
        this.y = nextY;
      } else {
        this.linearVelocity *= 0.2;
      }

      // Track distance
      const frameDist = Math.hypot(vx, vy);
      this.totalDistanceTravelled += frameDist;

      // Wheel animation rotation
      const wheelRotation = frameDist * 0.18;
      this.leftWheelAngle += wheelRotation;
      this.rightWheelAngle += wheelRotation;

      // Battery drain
      this.battery = Math.max(0, this.battery - CONFIG.ROBOT.BATTERY_DRAIN_RATE);
    }

    // 7. Battery Charging when Docked at Charger
    if (this.state === 'CHARGING') {
      if (this.battery < 100) {
        this.battery = Math.min(100, this.battery + CONFIG.ROBOT.BATTERY_CHARGE_RATE);
      }
    }
  }

  /**
   * Return comprehensive telemetry snapshot for HUD and Research evaluation
   */
  getTelemetry() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      headingDeg: Math.round((this.heading * 180 / Math.PI) % 360),
      linearVelocity: Math.round(this.linearVelocity * 10) / 10,
      angularVelocity: Math.round(this.angularVelocity * 100) / 100,
      state: this.state,
      activeTask: this.activeTask,
      battery: Math.round(this.battery * 10) / 10,
      hasMedicineCargo: this.hasMedicineCargo,
      isDocked: this.isDocked,
      isObstacleAhead: this.obstacleBrakeActive,
      emergencyStopEngaged: this.emergencyStopEngaged,
      waypointsRemaining: Math.max(0, this.activePath.length - this.currentWaypointIndex),
      minLidarDistance: Math.round(this.lidar.minOverallDist)
    };
  }
}
