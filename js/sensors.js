/**
 * 2D Simulated LIDAR Sensor & Collision Detection Engine
 * Real-time 360-degree multi-ray laser scanning and geometric collision testing
 */

class LidarSensor {
  constructor(config = CONFIG.ROBOT.LIDAR) {
    this.raysCount = config.RAYS_COUNT || 36;
    this.maxDistance = config.MAX_DISTANCE || 140;
    this.safetyBrakeDist = config.SAFETY_BRAKE_DIST || 35;
    this.scanResults = [];
    this.minFrontDist = Infinity;
    this.minOverallDist = Infinity;
  }

  /**
   * Ray-to-Segment 2D intersection
   * Returns distance t along ray, or null if no hit
   */
  intersectRaySegment(rayOrigin, rayDir, segA, segB) {
    const rx = rayOrigin.x;
    const ry = rayOrigin.y;
    const dx = rayDir.x;
    const dy = rayDir.y;

    const x1 = segA.x;
    const y1 = segA.y;
    const x2 = segB.x;
    const y2 = segB.y;

    const v1x = rx - x1;
    const v1y = ry - y1;
    const v2x = x2 - x1;
    const v2y = y2 - y1;
    const v3x = -dy;
    const v3y = dx;

    const dot = v2x * v3x + v2y * v3y;
    if (Math.abs(dot) < 0.00001) return null;

    const t1 = (v2x * v1y - v2y * v1x) / dot;
    const t2 = (v1x * v3x + v1y * v3y) / dot;

    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
      return t1; // Distance along ray
    }
    return null;
  }

  /**
   * Ray-to-AABB Box intersection
   */
  intersectRayBox(origin, dir, box) {
    const segments = [
      { a: { x: box.x, y: box.y }, b: { x: box.x + box.width, y: box.y } }, // Top
      { a: { x: box.x + box.width, y: box.y }, b: { x: box.x + box.width, y: box.y + box.height } }, // Right
      { a: { x: box.x + box.width, y: box.y + box.height }, b: { x: box.x, y: box.y + box.height } }, // Bottom
      { a: { x: box.x, y: box.y + box.height }, b: { x: box.x, y: box.y } } // Left
    ];

    let minT = null;
    for (const seg of segments) {
      const t = this.intersectRaySegment(origin, dir, seg.a, seg.b);
      if (t !== null && (minT === null || t < minT)) {
        minT = t;
      }
    }
    return minT;
  }

  /**
   * Perform 360-degree LIDAR sweep from robot position
   */
  update(robotX, robotY, robotHeading, walls, obstacles) {
    this.scanResults = [];
    this.minFrontDist = Infinity;
    this.minOverallDist = Infinity;

    const angleStep = (Math.PI * 2) / this.raysCount;

    for (let i = 0; i < this.raysCount; i++) {
      // Ray angle relative to world, aligned with robot heading
      const rayAngle = robotHeading + i * angleStep;
      const dirX = Math.cos(rayAngle);
      const dirY = Math.sin(rayAngle);

      let closestDist = this.maxDistance;
      let hitType = 'CLEAR';

      // Test against walls
      for (const wall of walls) {
        const dist = this.intersectRayBox({ x: robotX, y: robotY }, { x: dirX, y: dirY }, wall);
        if (dist !== null && dist < closestDist) {
          closestDist = dist;
          hitType = 'WALL';
        }
      }

      // Test against obstacles
      for (const obs of obstacles) {
        const dist = this.intersectRayBox({ x: robotX, y: robotY }, { x: dirX, y: dirY }, obs);
        if (dist !== null && dist < closestDist) {
          closestDist = dist;
          hitType = 'OBSTACLE';
        }
      }

      const hitX = robotX + dirX * closestDist;
      const hitY = robotY + dirY * closestDist;

      // Track overall minimum distance
      if (closestDist < this.minOverallDist) {
        this.minOverallDist = closestDist;
      }

      // Track front-facing cone (within +- 35 degrees of robot heading)
      let relAngle = (rayAngle - robotHeading) % (Math.PI * 2);
      if (relAngle > Math.PI) relAngle -= Math.PI * 2;
      if (relAngle < -Math.PI) relAngle += Math.PI * 2;

      const isFrontSector = Math.abs(relAngle) <= (35 * Math.PI / 180);
      if (isFrontSector && closestDist < this.minFrontDist) {
        this.minFrontDist = closestDist;
      }

      this.scanResults.push({
        angle: rayAngle,
        relativeAngle: relAngle,
        distance: closestDist,
        hitX,
        hitY,
        hitType,
        isFrontSector,
        isObstacleClose: closestDist < this.safetyBrakeDist
      });
    }

    return {
      scanResults: this.scanResults,
      minFrontDist: this.minFrontDist,
      minOverallDist: this.minOverallDist,
      isObstacleAhead: this.minFrontDist < this.safetyBrakeDist
    };
  }

  /**
   * Circle vs Rectangle collision check for physical boundary safety
   */
  checkCircleRectCollision(cx, cy, radius, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));

    const distanceX = cx - closestX;
    const distanceY = cy - closestY;

    return (distanceX * distanceX + distanceY * distanceY) < (radius * radius);
  }

  /**
   * Test if a hypothetical position (newX, newY) collides with any wall or obstacle
   */
  isPositionColliding(newX, newY, radius = CONFIG.ROBOT.COLLISION_RADIUS, walls = CONFIG.WALLS, obstacles = CONFIG.OBSTACLES) {
    for (const wall of walls) {
      if (this.checkCircleRectCollision(newX, newY, radius, wall)) return true;
    }
    for (const obs of obstacles) {
      if (this.checkCircleRectCollision(newX, newY, radius, obs)) return true;
    }
    return false;
  }
}
