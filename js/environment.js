/**
 * 2D Canvas Simulation Rendering Engine
 * Visual rendering for:
 * - Hospital / Assistive Living Suite floor plan
 * - Partition walls, doorways, floor guide tiles
 * - Interactive Stations (Patient Bedside, Pharmacy Dispensary, Recharger, Home Base)
 * - Furniture & Obstacles
 * - Planned A* Path Visualization & Trajectory Waypoints
 * - 360-Degree LIDAR Laser Sweep & Point-Cloud Rays
 * - Highly Detailed Multi-Layer Robotic Assistant
 */

class SimulationEnvironment {
  constructor(canvasId, robot, pathFinder, lidar) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.robot = robot;
    this.pathFinder = pathFinder;
    this.lidar = lidar;

    // View Options (toggled via UI)
    this.showLidarRays = true;
    this.showPlannedPath = true;
    this.showGrid = true;
    this.showSafetyZones = true;

    // Animation tickers
    this.animTime = 0;
    this.pulsePhase = 0;

    // High DPI Support
    this.setupHighDPI();
  }

  setupHighDPI() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = CONFIG.CANVAS.WIDTH * dpr;
    this.canvas.height = CONFIG.CANVAS.HEIGHT * dpr;
    this.canvas.style.width = `${CONFIG.CANVAS.WIDTH}px`;
    this.canvas.style.height = `${CONFIG.CANVAS.HEIGHT}px`;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Main Render Loop Call
   */
  render() {
    this.animTime += 0.03;
    this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);

    // 1. Floor Background & Grid
    this.drawFloor(ctx);

    // 2. Room Zones & Station Footprints
    this.drawStations(ctx);

    // 3. Walls & Barriers
    this.drawWalls(ctx);

    // 4. Furniture & Obstacles
    this.drawObstacles(ctx);

    // 5. Planned A* Path & Waypoints
    if (this.showPlannedPath && this.robot.activePath.length > 0) {
      this.drawPlannedPath(ctx);
    }

    // 6. LIDAR Rays & Sensor Sweeps
    if (this.showLidarRays) {
      this.drawLidarScan(ctx);
    }

    // 7. Assistive Robot
    this.drawRobot(ctx);

    // 8. Dynamic Overlay Annotations (Station labels & tooltips)
    this.drawStationLabels(ctx);
  }

  /**
   * Draw clinical tile floor pattern
   */
  drawFloor(ctx) {
    ctx.fillStyle = '#0b1329';
    ctx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);

    if (this.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x <= CONFIG.CANVAS.WIDTH; x += CONFIG.CANVAS.GRID_SIZE * 2) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.CANVAS.HEIGHT);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= CONFIG.CANVAS.HEIGHT; y += CONFIG.CANVAS.GRID_SIZE * 2) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CONFIG.CANVAS.WIDTH, y);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw interactive station bays
   */
  drawStations(ctx) {
    const stations = CONFIG.STATIONS;

    // --- 1. HOME BASE (Top-Left) ---
    this.drawHomeBase(ctx, stations.HOME);

    // --- 2. CHARGING DOCK (Bottom-Left) ---
    this.drawChargingStation(ctx, stations.CHARGER);

    // --- 3. PHARMACY DISPENSARY (Top-Right) ---
    this.drawDispensary(ctx, stations.MEDICINE);

    // --- 4. PATIENT BEDSIDE WARD (Bottom-Right) ---
    this.drawPatientBed(ctx, stations.PATIENT);
  }

  drawHomeBase(ctx, st) {
    const cx = st.x;
    const cy = st.y;

    // Base Zone Glow
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 55);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fill();

    // Concentric Dock Pad Rings
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Home Icon
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', cx, cy);
  }

  drawChargingStation(ctx, st) {
    const cx = st.x;
    const cy = st.y;
    const isCharging = this.robot.state === 'CHARGING';

    // Docking pad base
    ctx.fillStyle = isCharging ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)';
    ctx.strokeStyle = isCharging ? '#10b981' : 'rgba(16, 185, 129, 0.6)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(cx - 38, cy - 38, 76, 76, 10);
    ctx.fill();
    ctx.stroke();

    // Charging Contact Plates
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx - 24, cy - 34, 14, 6);
    ctx.fillRect(cx + 10, cy - 34, 14, 6);

    // Glowing Charge Arc Animation if currently docked
    if (isCharging) {
      const pulse = Math.sin(this.animTime * 6) * 6;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 44 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Icon
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', cx, cy + 2);
  }

  drawDispensary(ctx, st) {
    const cx = st.x;
    const cy = st.y;

    // Dispensary Counter Background
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 42, cy - 42, 84, 84, 8);
    ctx.fill();
    ctx.stroke();

    // Medical cross graphic
    ctx.fillStyle = '#06b6d4';
    const s = 8;
    ctx.fillRect(cx - s / 2, cy - 22, s, 44);
    ctx.fillRect(cx - 22, cy - s / 2, 44, s);

    // Medication Box Icon
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💊', cx, cy);
  }

  drawPatientBed(ctx, st) {
    const cx = st.x;
    const cy = st.y;

    // Ward area zone
    ctx.fillStyle = 'rgba(236, 72, 153, 0.10)';
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 50, cy - 48, 100, 96, 10);
    ctx.fill();
    ctx.stroke();

    // Hospital Bed Frame
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 36, cy - 32, 72, 64, 6);
    ctx.fill();
    ctx.stroke();

    // Bed pillow
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(cx - 30, cy - 28, 20, 56, 4);
    ctx.fill();

    // Patient Blanket
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(cx - 6, cy - 28, 38, 56, 4);
    ctx.fill();

    // Patient Avatar (elderly patient head with breathing animation)
    const breath = Math.sin(this.animTime * 2.5) * 1.5;
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.arc(cx - 20, cy + breath, 10, 0, Math.PI * 2);
    ctx.fill();

    // Heartbeat ECG Pulse Line
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const ecgY = cy + 38;
    ctx.moveTo(cx - 40, ecgY);
    ctx.lineTo(cx - 20, ecgY);
    ctx.lineTo(cx - 15, ecgY - 6);
    ctx.lineTo(cx - 10, ecgY + 8);
    ctx.lineTo(cx - 5, ecgY - 10);
    ctx.lineTo(cx, ecgY + 5);
    ctx.lineTo(cx + 5, ecgY);
    ctx.lineTo(cx + 40, ecgY);
    ctx.stroke();
  }

  /**
   * Draw solid partition walls with bevel and lighting
   */
  drawWalls(ctx) {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;

    for (const w of CONFIG.WALLS) {
      // Wall drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      ctx.fillRect(w.x, w.y, w.width, w.height);
      ctx.strokeRect(w.x, w.y, w.width, w.height);

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Subtle metallic highlight line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + w.width, w.y);
      ctx.stroke();
    }
  }

  /**
   * Draw furniture and clinical obstacles
   */
  drawObstacles(ctx) {
    for (const obs of CONFIG.OBSTACLES) {
      ctx.fillStyle = obs.color || '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 6);
      ctx.fill();
      ctx.stroke();

      // Top surface pattern
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, obs.height - 8);

      // Label
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obs.name, obs.x + obs.width / 2, obs.y + obs.height / 2);
    }
  }

  /**
   * Draw planned A* trajectory and waypoints
   */
  drawPlannedPath(ctx) {
    const path = this.robot.activePath;
    if (path.length === 0) return;

    ctx.save();
    // Connecting trajectory line with glowing dash animation
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -this.animTime * 30;

    ctx.beginPath();
    ctx.moveTo(this.robot.x, this.robot.y);
    for (let i = this.robot.currentWaypointIndex; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint nodes
    for (let i = this.robot.currentWaypointIndex; i < path.length; i++) {
      const wp = path[i];
      const isFinal = (i === path.length - 1);

      ctx.fillStyle = isFinal ? '#10b981' : '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(wp.x, wp.y, isFinal ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draw real-time 360-degree LIDAR rays
   */
  drawLidarScan(ctx) {
    const scans = this.lidar.scanResults;
    if (!scans || scans.length === 0) return;

    ctx.save();
    for (const scan of scans) {
      const isObstacle = scan.isObstacleClose;
      const isFront = scan.isFrontSector;

      // Color coding: Red = Obstacle close in front, Amber = Obstacle close peripheral, Cyan = Clear
      let strokeColor = 'rgba(56, 189, 248, 0.15)';
      if (isObstacle) {
        strokeColor = isFront ? 'rgba(239, 68, 68, 0.65)' : 'rgba(245, 158, 11, 0.45)';
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isObstacle && isFront ? 1.5 : 0.8;

      ctx.beginPath();
      ctx.moveTo(this.robot.x, this.robot.y);
      ctx.lineTo(scan.hitX, scan.hitY);
      ctx.stroke();

      // Hit point dots
      if (scan.hitType !== 'CLEAR') {
        ctx.fillStyle = isObstacle ? '#ef4444' : 'rgba(56, 189, 248, 0.6)';
        ctx.beginPath();
        ctx.arc(scan.hitX, scan.hitY, isObstacle ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Draw detailed differential robotic assistant
   */
  drawRobot(ctx) {
    const r = this.robot;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.heading);

    // 1. Forward Headlight Cone Beam
    const lightCone = ctx.createRadialGradient(0, 0, 10, 80, 0, 90);
    lightCone.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
    lightCone.addColorStop(1, 'rgba(254, 240, 138, 0.0)');

    ctx.fillStyle = lightCone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 85, -0.38, 0.38);
    ctx.closePath();
    ctx.fill();

    // 2. Dual Tread / Wheel Assemblies
    const wheelW = 38;
    const wheelH = 10;
    const treadDist = 18;

    // Draw Left Track & Right Track
    [-treadDist, treadDist].forEach((offsetY, idx) => {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(-wheelW / 2, offsetY - wheelH / 2, wheelW, wheelH, 3);
      ctx.fill();
      ctx.stroke();

      // Animated wheel tread ticks
      const wheelAngle = idx === 0 ? r.leftWheelAngle : r.rightWheelAngle;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      for (let t = -wheelW / 2 + 4; t < wheelW / 2; t += 7) {
        const tickX = t + (wheelAngle % 7);
        if (tickX > -wheelW / 2 && tickX < wheelW / 2) {
          ctx.beginPath();
          ctx.moveTo(tickX, offsetY - wheelH / 2 + 1);
          ctx.lineTo(tickX, offsetY + wheelH / 2 - 1);
          ctx.stroke();
        }
      }
    });

    // 3. Main Robotic Chassis Body
    // Status Ring Color
    let ringColor = '#3b82f6'; // Idle/normal blue
    if (r.emergencyStopEngaged) ringColor = '#ef4444'; // Red alert
    else if (r.obstacleBrakeActive) ringColor = '#f59e0b'; // Amber caution
    else if (r.hasMedicineCargo) ringColor = '#a855f7'; // Purple delivery cargo
    else if (r.state === 'CHARGING') ringColor = '#10b981'; // Green charging

    // Outer glow / safety halo
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Metal chassis plate
    const bodyGrad = ctx.createRadialGradient(-5, -5, 2, 0, 0, r.radius - 2);
    bodyGrad.addColorStop(0, '#f8fafc');
    bodyGrad.addColorStop(0.7, '#cbd5e1');
    bodyGrad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // 4. Directional Heading Indicator (Forward Chevron)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(6, -6);
    ctx.lineTo(8, 0);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();

    // 5. Cargo Bay / Medicine Compartment
    if (r.hasMedicineCargo) {
      // Draw medication payload box on the back deck of the robot
      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-18, -9, 14, 18, 3);
      ctx.fill();
      ctx.stroke();

      // White cross on pill box
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-13, -6, 4, 12);
      ctx.fillRect(-17, -2, 12, 4);
    }

    // 6. Central Rotating LIDAR Turret
    const turretRadius = 9;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spinning LIDAR laser aperture notch
    const lidarAngle = this.animTime * 12;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(lidarAngle) * turretRadius, Math.sin(lidarAngle) * turretRadius);
    ctx.stroke();

    ctx.restore();

    // 7. Floating HUD Status Badge Above Robot
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Badge background
    const label = r.activeTask;
    const metrics = ctx.measureText(label);
    const badgeW = metrics.width + 16;
    const badgeH = 20;
    const badgeX = r.x - badgeW / 2;
    const badgeY = r.y - r.radius - 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, r.x, badgeY + 15);
  }

  /**
   * Draw static station nameplates & room headers
   */
  drawStationLabels(ctx) {
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';

    // Home Base
    ctx.fillText('HOME BASE DOCK', CONFIG.STATIONS.HOME.x, CONFIG.STATIONS.HOME.y + 55);

    // Charging Dock
    ctx.fillText('CHARGING BAY', CONFIG.STATIONS.CHARGER.x, CONFIG.STATIONS.CHARGER.y + 55);

    // Pharmacy
    ctx.fillText('PHARMACY DISPENSARY', CONFIG.STATIONS.MEDICINE.x, CONFIG.STATIONS.MEDICINE.y + 58);

    // Patient Ward
    ctx.fillText('PATIENT BEDSIDE WARD', CONFIG.STATIONS.PATIENT.x, CONFIG.STATIONS.PATIENT.y + 60);

    // Corridor Label
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('CENTRAL TRANSIT CORRIDOR', 480, 310);
  }
}
