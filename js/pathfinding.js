/**
 * Grid-Based A* (A-Star) Pathfinding & Waypoint Generator
 * Features:
 * - 48x30 Occupancy Grid with Obstacle/Wall Inflation (Costmap)
 * - 8-directional search with diagonal corner-cutting prevention
 * - Line-of-Sight Path Smoothing (Raycast string pulling)
 */

class PathFinder {
  constructor(width = CONFIG.CANVAS.WIDTH, height = CONFIG.CANVAS.HEIGHT, cellSize = CONFIG.CANVAS.GRID_SIZE) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.inflationRadius = 20; // pixels inflation around obstacles
    this.grid = [];

    this.initGrid();
    this.buildStaticCostMap(CONFIG.WALLS, CONFIG.OBSTACLES);
  }

  initGrid() {
    this.grid = new Array(this.cols);
    for (let x = 0; x < this.cols; x++) {
      this.grid[x] = new Uint8Array(this.rows); // 0 = free, 1 = obstacle/wall
    }
  }

  /**
   * Bake walls and obstacles into the occupancy grid with safe inflation
   */
  buildStaticCostMap(walls, obstacles) {
    // Reset
    for (let x = 0; x < this.cols; x++) {
      this.grid[x].fill(0);
    }

    const markRect = (rx, ry, rw, rh) => {
      // Inflate by safety radius
      const minX = Math.max(0, Math.floor((rx - this.inflationRadius) / this.cellSize));
      const maxX = Math.min(this.cols - 1, Math.floor((rx + rw + this.inflationRadius) / this.cellSize));
      const minY = Math.max(0, Math.floor((ry - this.inflationRadius) / this.cellSize));
      const maxY = Math.min(this.rows - 1, Math.floor((ry + rh + this.inflationRadius) / this.cellSize));

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          this.grid[cx][cy] = 1; // Blocked
        }
      }
    };

    walls.forEach(w => markRect(w.x, w.y, w.width, w.height));
    obstacles.forEach(o => markRect(o.x, o.y, o.width, o.height));
  }

  /**
   * Convert pixel position (x, y) to grid coordinates (gx, gy)
   */
  toGrid(x, y) {
    const gx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
    const gy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
    return { gx, gy };
  }

  /**
   * Convert grid coordinates (gx, gy) to center pixel position (x, y)
   */
  toWorld(gx, gy) {
    return {
      x: gx * this.cellSize + this.cellSize / 2,
      y: gy * this.cellSize + this.cellSize / 2
    };
  }

  isBlocked(gx, gy) {
    if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return true;
    return this.grid[gx][gy] === 1;
  }

  /**
   * Find nearest walkable grid cell if target is slightly inside obstacle
   */
  findNearestWalkable(gx, gy) {
    if (!this.isBlocked(gx, gy)) return { gx, gy };
    for (let r = 1; r < 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (!this.isBlocked(nx, ny)) return { gx: nx, gy: ny };
        }
      }
    }
    return { gx, gy };
  }

  /**
   * A* Search Algorithm
   */
  findPath(startX, startY, goalX, goalY) {
    let start = this.toGrid(startX, startY);
    let goal = this.toGrid(goalX, goalY);

    if (this.isBlocked(start.gx, start.gy)) {
      start = this.findNearestWalkable(start.gx, start.gy);
    }

    if (this.isBlocked(goal.gx, goal.gy)) {
      goal = this.findNearestWalkable(goal.gx, goal.gy);
    }

    if (start.gx === goal.gx && start.gy === goal.gy) {
      return [{ x: goalX, y: goalY }];
    }

    // Node representation
    class Node {
      constructor(gx, gy, g = 0, h = 0, parent = null) {
        this.gx = gx;
        this.gy = gy;
        this.g = g;
        this.h = h;
        this.f = g + h;
        this.parent = parent;
      }
    }

    const heuristic = (ax, ay, bx, by) => {
      // Octile distance for 8-directional movement
      const dx = Math.abs(ax - bx);
      const dy = Math.abs(ay - by);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };

    const openList = [];
    const openMap = new Map();
    const closedSet = new Uint8Array(this.cols * this.rows);

    const key = (x, y) => y * this.cols + x;

    const startNode = new Node(start.gx, start.gy, 0, heuristic(start.gx, start.gy, goal.gx, goal.gy));
    openList.push(startNode);
    openMap.set(key(start.gx, start.gy), startNode);

    // 8 neighbors: dx, dy, cost
    const neighbors = [
      { dx: 1, dy: 0, cost: 1.0 },
      { dx: -1, dy: 0, cost: 1.0 },
      { dx: 0, dy: 1, cost: 1.0 },
      { dx: 0, dy: -1, cost: 1.0 },
      { dx: 1, dy: 1, cost: Math.SQRT2 },
      { dx: -1, dy: 1, cost: Math.SQRT2 },
      { dx: 1, dy: -1, cost: Math.SQRT2 },
      { dx: -1, dy: -1, cost: Math.SQRT2 }
    ];

    let foundGoalNode = null;
    let iterations = 0;
    const maxIterations = 2500;

    while (openList.length > 0 && iterations++ < maxIterations) {
      // Extract lowest f node
      let bestIndex = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[bestIndex].f) bestIndex = i;
      }
      const current = openList.splice(bestIndex, 1)[0];
      const curKey = key(current.gx, current.gy);
      openMap.delete(curKey);
      closedSet[curKey] = 1;

      // Goal reached?
      if (current.gx === goal.gx && current.gy === goal.gy) {
        foundGoalNode = current;
        break;
      }

      // Explore neighbors
      for (const n of neighbors) {
        const nx = current.gx + n.dx;
        const ny = current.gy + n.dy;
        const nKey = key(nx, ny);

        if (this.isBlocked(nx, ny) || closedSet[nKey] === 1) continue;

        // Prevent cutting across diagonal corners of walls
        if (n.dx !== 0 && n.dy !== 0) {
          if (this.isBlocked(current.gx + n.dx, current.gy) || this.isBlocked(current.gx, current.gy + n.dy)) {
            continue;
          }
        }

        const tentativeG = current.g + n.cost;
        const existingNode = openMap.get(nKey);

        if (!existingNode) {
          const h = heuristic(nx, ny, goal.gx, goal.gy);
          const neighborNode = new Node(nx, ny, tentativeG, h, current);
          openList.push(neighborNode);
          openMap.set(nKey, neighborNode);
        } else if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = tentativeG + existingNode.h;
          existingNode.parent = current;
        }
      }
    }

    if (!foundGoalNode) {
      console.warn('A* pathfinding: No valid path found to goal.');
      return null;
    }

    // Reconstruct raw path
    const rawPath = [];
    let curr = foundGoalNode;
    while (curr) {
      rawPath.unshift(this.toWorld(curr.gx, curr.gy));
      curr = curr.parent;
    }

    // Replace endpoints with exact pixel coordinates
    if (rawPath.length > 0) {
      rawPath[rawPath.length - 1] = { x: goalX, y: goalY };
    }

    // Smooth path with Line of Sight string pulling
    return this.smoothPath(rawPath);
  }

  /**
   * Line of sight check between two points
   */
  hasLineOfSight(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.ceil(dist / (this.cellSize / 2));
    if (steps <= 1) return true;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;
      const { gx, gy } = this.toGrid(x, y);
      if (this.isBlocked(gx, gy)) return false;
    }
    return true;
  }

  /**
   * Smooth waypoints by skipping intermediate collinear points
   */
  smoothPath(path) {
    if (!path || path.length <= 2) return path;

    const smoothed = [path[0]];
    let currentIdx = 0;

    while (currentIdx < path.length - 1) {
      let furthestVisible = currentIdx + 1;
      for (let testIdx = path.length - 1; testIdx > currentIdx + 1; testIdx--) {
        if (this.hasLineOfSight(path[currentIdx], path[testIdx])) {
          furthestVisible = testIdx;
          break;
        }
      }
      smoothed.push(path[furthestVisible]);
      currentIdx = furthestVisible;
    }

    return smoothed;
  }
}
