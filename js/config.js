/**
 * Configuration and Static Data for AI Assistive Robotic System
 * Simulation Environment: 960x600 px clinical suite
 */

const CONFIG = {
  CANVAS: {
    WIDTH: 960,
    HEIGHT: 600,
    GRID_SIZE: 20 // 48 cols x 30 rows for A* pathfinding
  },

  ROBOT: {
    RADIUS: 24,
    COLLISION_RADIUS: 28,
    MAX_SPEED: 2.8,
    REVERSE_SPEED: 1.8,
    ACCELERATION: 0.15,
    DECELERATION: 0.25,
    TURN_SPEED: 0.05, // Radians per frame
    BATTERY_DRAIN_RATE: 0.015, // % per tick when moving
    BATTERY_CHARGE_RATE: 0.12, // % per tick when docking
    LIDAR: {
      RAYS_COUNT: 36,
      MAX_DISTANCE: 140,
      FOV: Math.PI * 2, // 360 degree scan
      SAFETY_BRAKE_DIST: 35
    }
  },

  STATIONS: {
    HOME: {
      id: 'HOME',
      name: 'Home / Base Dock',
      x: 120,
      y: 120,
      width: 80,
      height: 80,
      color: '#3b82f6',
      icon: '🏠'
    },
    CHARGER: {
      id: 'CHARGER',
      name: 'Recharging Station',
      x: 120,
      y: 490,
      width: 80,
      height: 80,
      color: '#10b981',
      icon: '⚡'
    },
    MEDICINE: {
      id: 'MEDICINE',
      name: 'Pharmacy Dispensary',
      x: 820,
      y: 120,
      width: 90,
      height: 90,
      color: '#06b6d4',
      icon: '💊'
    },
    PATIENT: {
      id: 'PATIENT',
      name: 'Patient Ward / Bedside',
      x: 800,
      y: 470,
      width: 100,
      height: 100,
      color: '#ec4899',
      icon: '🛏️'
    }
  },

  // Wall partitions dividing the simulated hospital/assistive environment
  WALLS: [
    // Outer perimeter walls
    { x: 10, y: 10, width: 940, height: 12, label: 'North Boundary Wall' },
    { x: 10, y: 578, width: 940, height: 12, label: 'South Boundary Wall' },
    { x: 10, y: 10, width: 12, height: 580, label: 'West Boundary Wall' },
    { x: 938, y: 10, width: 12, height: 580, label: 'East Boundary Wall' },

    // Partition 1: West Rooms Divider (leaving wide corridor opening at y: 180-380)
    { x: 230, y: 10, width: 14, height: 180, label: 'Service Bay Wall North' },
    { x: 230, y: 380, width: 14, height: 210, label: 'Service Bay Wall South' },

    // Partition 2: East Rooms Divider (leaving wide corridor opening at y: 180-380)
    { x: 670, y: 10, width: 14, height: 180, label: 'Dispensary Partition' },
    { x: 670, y: 380, width: 14, height: 210, label: 'Patient Ward Partition' },

    // Partition 3: Center Hallway dividers
    { x: 340, y: 290, width: 100, height: 14, label: 'Corridor Barrier A' },
    { x: 510, y: 290, width: 100, height: 14, label: 'Corridor Barrier B' }
  ],

  // Furniture / Dynamic Obstacles
  OBSTACLES: [
    { x: 420, y: 120, width: 90, height: 60, type: 'TABLE', name: 'Clinical Worktable', color: '#475569' },
    { x: 440, y: 440, width: 70, height: 70, type: 'CABINET', name: 'Equipment Cabinet', color: '#475569' },
    { x: 300, y: 460, width: 45, height: 45, type: 'IV_POLE', name: 'Wheelchair / IV Stand', color: '#64748b' }
  ],

  // Intent definitions and canonical voice command patterns
  INTENTS: {
    MOVE_FORWARD: {
      action: 'MOVE_FORWARD',
      label: 'Move Forward',
      category: 'DIRECTIONAL',
      description: 'Drives robot forward in current heading direction',
      confidenceThreshold: 0.55,
      phrases: [
        'move forward', 'go forward', 'drive forward', 'go ahead', 'move ahead',
        'forward', 'ahead', 'straight', 'advance', 'keep going', 'move front', 'drive ahead'
      ],
      keywords: ['forward', 'ahead', 'front', 'advance', 'straight']
    },

    MOVE_BACKWARD: {
      action: 'MOVE_BACKWARD',
      label: 'Move Backward',
      category: 'DIRECTIONAL',
      description: 'Reverses robot in opposite of current heading direction',
      confidenceThreshold: 0.55,
      phrases: [
        'move backward', 'go backward', 'reverse', 'move back', 'go back',
        'backward', 'back', 'retreat', 'drive backward', 'step back'
      ],
      keywords: ['backward', 'back', 'reverse', 'retreat']
    },

    TURN_LEFT: {
      action: 'TURN_LEFT',
      label: 'Turn Left',
      category: 'DIRECTIONAL',
      description: 'Rotates robot counter-clockwise by 45-90 degrees',
      confidenceThreshold: 0.55,
      phrases: [
        'turn left', 'rotate left', 'spin left', 'go left', 'pivot left',
        'left turn', 'face left', 'bear left', 'steer left'
      ],
      keywords: ['left', 'counterclockwise', 'anticlockwise']
    },

    TURN_RIGHT: {
      action: 'TURN_RIGHT',
      label: 'Turn Right',
      category: 'DIRECTIONAL',
      description: 'Rotates robot clockwise by 45-90 degrees',
      confidenceThreshold: 0.55,
      phrases: [
        'turn right', 'rotate right', 'spin right', 'go right', 'pivot right',
        'right turn', 'face right', 'bear right', 'steer right'
      ],
      keywords: ['right', 'clockwise']
    },

    STOP: {
      action: 'STOP',
      label: 'Emergency Stop / Halt',
      category: 'SAFETY',
      description: 'Immediately brakes all motors and halts current tasks',
      confidenceThreshold: 0.50,
      phrases: [
        'stop', 'please stop', 'emergency stop', 'halt', 'freeze', 'wait',
        'pause', 'brake', 'hold on', 'cancel', 'terminate', 'stand still'
      ],
      keywords: ['stop', 'halt', 'freeze', 'pause', 'wait', 'brake', 'cancel']
    },

    NAVIGATE_PATIENT: {
      action: 'NAVIGATE_PATIENT',
      label: 'Assist Patient',
      category: 'ASSISTIVE_MISSION',
      description: 'Calculates collision-free path and navigates to patient bedside',
      confidenceThreshold: 0.58,
      phrases: [
        'move to the patient', 'go to patient', 'move to patient', 'go to the patient',
        'help the patient', 'visit patient', 'navigate to patient', 'patient room',
        'assist patient', 'check patient', 'go to bed', 'bedside'
      ],
      keywords: ['patient', 'bed', 'bedside', 'person', 'elderly']
    },

    DELIVER_MEDICINE: {
      action: 'DELIVER_MEDICINE',
      label: 'Deliver Medicine Mission',
      category: 'ASSISTIVE_MISSION',
      description: 'Navigates to pharmacy dispensary, loads medicine cargo, and delivers to patient',
      confidenceThreshold: 0.55,
      phrases: [
        'bring medicine', 'get medicine', 'fetch medicine', 'deliver medicine',
        'bring the medicine', 'bring pills', 'get pills', 'fetch pills',
        'deliver pills', 'bring medication', 'fetch medication', 'medicine delivery'
      ],
      keywords: ['medicine', 'medication', 'pills', 'drugs', 'dispensary', 'prescription']
    },

    HELP_EMERGENCY: {
      action: 'HELP_EMERGENCY',
      label: 'Emergency Distress Assistance',
      category: 'ASSISTIVE_MISSION',
      description: 'High-priority distress response: immediately navigates to patient bedside with alert',
      confidenceThreshold: 0.55,
      phrases: [
        'help me', 'emergency', 'help', 'i need help', 'sos', 'assist me',
        'call for help', 'urgent help', 'emergency assistance'
      ],
      keywords: ['help', 'emergency', 'sos', 'distress', 'urgent']
    },

    NAVIGATE_CHARGING: {
      action: 'NAVIGATE_CHARGING',
      label: 'Dock at Charging Station',
      category: 'MAINTENANCE',
      description: 'Plans path to recharging dock, docks, and initiates battery replenishment',
      confidenceThreshold: 0.55,
      phrases: [
        'go to the charging station', 'go to charging station', 'recharge',
        'dock', 'charge battery', 'go charge', 'charge', 'return to charger',
        'charging dock', 'plug in'
      ],
      keywords: ['charging', 'charger', 'charge', 'recharge', 'dock', 'battery']
    },

    NAVIGATE_HOME: {
      action: 'NAVIGATE_HOME',
      label: 'Return to Home Base',
      category: 'MAINTENANCE',
      description: 'Plans collision-free path and returns to home base starting dock',
      confidenceThreshold: 0.55,
      phrases: [
        'go home', 'return home', 'go to base', 'return to base',
        'return to home position', 'back to start', 'home position'
      ],
      keywords: ['home', 'base', 'origin', 'start']
    }
  }
};

// Freeze config for immutability
Object.freeze(CONFIG);
