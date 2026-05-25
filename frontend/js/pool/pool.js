// js/pool/pool.js
import * as THREE from "https://esm.sh/three@0.158.0";
import { createPoolWater } from "./water.js";
import { EditablePolygon } from "./editing/polygon.js";

const STEP_PRESET_WIDTH = 0.9; // metres: preset left/centre/right step width
const DEFAULT_BENCH2_EXTENSION = 0.6; // metres: second/full-width bench starts at 600 mm
const DEFAULT_DIAGONAL_STEP_SIZE = 0.45; // metres: diagonal corner step starts at 450 mm x 450 mm
const STEP_TIER_OFFSET = 0.3; // metres: consistent 300 mm offset between nested step tiers

function clampStepValue(value, min, max) {
  const n = Number(value);
  const lo = Number.isFinite(min) ? min : 0.05;
  const hi = Number.isFinite(max) && max > lo ? max : lo;
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function getBench2Extension(params) {
  const n = Number(params?.bench2Extension);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BENCH2_EXTENSION;
}

function getDiagonalStepSize(params, bench2Extension = getBench2Extension(params)) {
  const raw = Number(params?.diagonalStepSize ?? params?.stepWidth);
  const wanted = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DIAGONAL_STEP_SIZE;
  return clampStepValue(wanted, 0.05, bench2Extension);
}

function getStepsOnlyStepRunOverride(params, stepIndex) {
  const runs = params?.stepsOnlyStepRuns;
  if (!runs) return null;
  const raw = Array.isArray(runs) ? runs[stepIndex] : runs[String(stepIndex)];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getStepFootprintLength(params, stepCount, stepLength) {
  const count = Math.max(0, Number(stepCount) | 0);
  if (count <= 0) return 0;

  const bench2Extension = getBench2Extension(params);
  const stepBenchMode = params?.stepBenchMode === "stepsOnly" ? "stepsOnly" : "bench";
  const isCenteredCircular = params?.stepShape === "circular" && params?.stepPosition === "center";
  const centeredCircularRun = Math.max(0.05, Number(params?.stepExtension) || ((Number(params?.stepWidth) || STEP_PRESET_WIDTH) * 0.5));
  const isDiagonal = (params?.stepShape === "diagonal" || params?.stepShape === "circular") && params?.stepPosition !== "center";
  const narrowRun = isCenteredCircular ? centeredCircularRun : (isDiagonal ? getDiagonalStepSize(params, bench2Extension) : stepLength);

  // Floor origin rule:
  // - Steps Only: transition starts at the entry wall, regardless of nested step depth.
  // - Bench Seat: transition starts from the front edge of the second/full-width bench.
  //   Extra lower steps no longer keep pushing the transition deeper into the pool.
  if (stepBenchMode === "stepsOnly") return 0;
  if (count === 1) return narrowRun;
  return bench2Extension;
}

function getStepLayout(params, spanMinY, spanMaxY, options = {}) {
  const fullWidth = Math.max(0.05, spanMaxY - spanMinY);
  const pos = params.stepPosition === "left" || params.stepPosition === "right" ? params.stepPosition : "center";

  // Preset behaviour:
  // - second step uses full pool width
  // - all other steps use a locked 900 mm width and align left/centre/right
  const configuredWidth = Number(params.stepWidth);
  const isDiagonal = (params?.stepShape === "diagonal" || params?.stepShape === "circular") && pos !== "center" && !options.fullWidth;
  const bench2Extension = getBench2Extension(params);
  const targetWidth = options.fullWidth
    ? fullWidth
    : (isDiagonal
        ? getDiagonalStepSize(params, bench2Extension)
        : (Number.isFinite(configuredWidth) && configuredWidth > 0 ? configuredWidth : STEP_PRESET_WIDTH));
  const maxNarrowWidth = isDiagonal ? Math.min(fullWidth, bench2Extension) : fullWidth;
  const width = Math.min(maxNarrowWidth, Math.max(0.05, targetWidth));

  let centerY = (spanMinY + spanMaxY) * 0.5;
  if (pos === "left") centerY = spanMinY + width * 0.5;
  if (pos === "right") centerY = spanMaxY - width * 0.5;
  return { width, centerY, position: pos, isFullWidth: !!options.fullWidth };
}

function getStepWallFrame(params, minX, maxX, minY, maxY) {
  const wall = ["west", "east", "south", "north"].includes(params?.stepWall) ? params.stepWall : "west";
  if (wall === "east") {
    return {
      wall,
      axis: "x",
      inwardSign: -1,
      wallCoord: maxX,
      spanMin: minY,
      spanMax: maxY,
      rotationZ: Math.PI
    };
  }
  if (wall === "south") {
    return {
      wall,
      axis: "y",
      inwardSign: 1,
      wallCoord: minY,
      spanMin: minX,
      spanMax: maxX,
      rotationZ: Math.PI * 0.5
    };
  }
  if (wall === "north") {
    return {
      wall,
      axis: "y",
      inwardSign: -1,
      wallCoord: maxY,
      spanMin: minX,
      spanMax: maxX,
      rotationZ: -Math.PI * 0.5
    };
  }
  return {
    wall: "west",
    axis: "x",
    inwardSign: 1,
    wallCoord: minX,
    spanMin: minY,
    spanMax: maxY,
    rotationZ: 0
  };
}

function placeStepOnWall(step, frame, distanceFromWall, alongCenter, z) {
  const runCenter = frame.wallCoord + frame.inwardSign * distanceFromWall;
  if (frame.axis === "x") {
    step.position.set(runCenter, alongCenter, z);
  } else {
    step.position.set(alongCenter, runCenter, z);
  }
  step.rotation.z = frame.rotationZ;
}

function createStepGeometry(runLength, stepWidth, height, params, layout) {
  const shape = (["diagonal", "circular", "radius"].includes(params?.stepShape)) ? params.stepShape : "rectangle";
  const pos = layout?.position === "right" ? "right" : layout?.position === "left" ? "left" : "center";

  // The full-width second step remains rectangular so it can keep acting as the
  // continuous wall-backed bench/ledge.
  const isFullWidthStep = layout?.isFullWidth === true;
  const isCenteredCircularStep = shape === "circular" && pos === "center";
  const forceBenchSeat = layout?.isBenchSeat === true;
  if (shape === "rectangle" || forceBenchSeat || (isFullWidthStep && !isCenteredCircularStep)) {
    return new THREE.BoxGeometry(runLength, stepWidth, height);
  }

  const makeExtrudedShapeGeometry = (pointsOrShape) => {
    const shapePath = pointsOrShape instanceof THREE.Shape
      ? pointsOrShape
      : new THREE.Shape(pointsOrShape);
    const geo = new THREE.ExtrudeGeometry(shapePath, {
      depth: height,
      bevelEnabled: false,
      steps: 1
    });
    // ExtrudeGeometry runs from z=0..height. Centre it so existing step
    // positioning still treats the mesh origin as the middle of the solid block.
    geo.translate(0, 0, -height * 0.5);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    if (geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute("uv2", geo.attributes.uv.clone());
    }
    return geo;
  };

  // Radius Corner: same sizing behaviour as Rectangle steps, but the exposed
  // pool-side front corner is rounded instead of square. For centred steps both
  // front corners are rounded. The full-width bench stays rectangular above.
  if (shape === "radius") {
    const run = Math.max(0.05, Number(runLength) || 0.05);
    const width = Math.max(0.05, Number(stepWidth) || 0.05);
    const radius = THREE.MathUtils.clamp(Math.min(run, width) * 0.45, 0.03, Math.min(run, width) * 0.5);
    const x0 = -run * 0.5;
    const x1 = run * 0.5;
    const y0 = -width * 0.5;
    const y1 = width * 0.5;
    const segments = 18;
    const points = [];
    const arc = (cx, cy, r, a0, a1) => {
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const a = a0 + (a1 - a0) * t;
        points.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
    };

    if (pos === "left") {
      // Rounded exposed/front inside corner at x1,y1.
      points.push(new THREE.Vector2(x0, y0));
      points.push(new THREE.Vector2(x0, y1));
      points.push(new THREE.Vector2(x1 - radius, y1));
      arc(x1 - radius, y1 - radius, radius, Math.PI * 0.5, 0);
      points.push(new THREE.Vector2(x1, y0));
    } else if (pos === "right") {
      // Rounded exposed/front inside corner at x1,y0.
      points.push(new THREE.Vector2(x0, y0));
      points.push(new THREE.Vector2(x0, y1));
      points.push(new THREE.Vector2(x1, y1));
      points.push(new THREE.Vector2(x1, y0 + radius));
      arc(x1 - radius, y0 + radius, radius, 0, -Math.PI * 0.5);
    } else {
      // Centre steps: rectangle with both front corners rounded.
      points.push(new THREE.Vector2(x0, y0));
      points.push(new THREE.Vector2(x0, y1));
      points.push(new THREE.Vector2(x1 - radius, y1));
      arc(x1 - radius, y1 - radius, radius, Math.PI * 0.5, 0);
      points.push(new THREE.Vector2(x1, y0 + radius));
      arc(x1 - radius, y0 + radius, radius, 0, -Math.PI * 0.5);
    }
    return makeExtrudedShapeGeometry(new THREE.Shape(points));
  }

  // Diagonal and Circular Corner use one single real-world size. This keeps
  // the UI value honest: 0.60 m on the slider creates a 600 mm x 600 mm
  // corner footprint, regardless of any old extension/width state.
  if (pos === "center") {
    if (shape === "circular") {
      // Centre circular steps are true semi-circles: the straight edge sits
      // on the entry wall and the curved edge projects into the pool.
      // runLength is the radius/projection; stepWidth is the diameter.
      const radius = Math.max(0.05, Number(runLength) || 0.05);
      const diameter = Math.max(radius * 2, Number(stepWidth) || radius * 2);
      const x0 = -radius * 0.5;
      const cy = 0;
      const y0 = -diameter * 0.5;
      const y1 = diameter * 0.5;
      const segments = 40;
      const points = [
        new THREE.Vector2(x0, y0),
        new THREE.Vector2(x0, y1)
      ];
      for (let i = 0; i <= segments; i += 1) {
        const a = Math.PI * 0.5 - (i / segments) * Math.PI;
        points.push(new THREE.Vector2(
          x0 + Math.cos(a) * radius,
          cy + Math.sin(a) * (diameter * 0.5)
        ));
      }
      return makeExtrudedShapeGeometry(new THREE.Shape(points));
    }
    return new THREE.BoxGeometry(runLength, stepWidth, height);
  }

  const size = Math.max(
    0.05,
    Math.min(Number(runLength) || 0, Number(stepWidth) || 0) || DEFAULT_DIAGONAL_STEP_SIZE
  );
  const x0 = -size * 0.5;
  const x1 = size * 0.5;
  const y0 = -size * 0.5;
  const y1 = size * 0.5;

  if (shape === "circular") {
    // Rounded/circular corner step: same controlling value as diagonal steps,
    // but the corner footprint is a quarter-circle instead of a triangle.
    const segments = 24;
    const points = [];
    if (pos === "right") {
      // Corner is the wall/right side intersection at (x0, y1).
      points.push(new THREE.Vector2(x0, y1));
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 0.5;
        points.push(new THREE.Vector2(x0 + Math.sin(a) * size, y1 - Math.cos(a) * size));
      }
    } else {
      // Corner is the wall/left side intersection at (x0, y0).
      points.push(new THREE.Vector2(x0, y0));
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 0.5;
        points.push(new THREE.Vector2(x0 + Math.cos(a) * size, y0 + Math.sin(a) * size));
      }
    }
    return makeExtrudedShapeGeometry(new THREE.Shape(points));
  }

  // Build a real triangular prism in local XY and extrude it through Z.
  // This avoids hand-indexed faces, which could render as dark/grey wall holes
  // because some faces had poor winding/UVs.
  const points = pos === "right"
    ? [new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y0)]
    : [new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y0)];

  return makeExtrudedShapeGeometry(points);
}




function buildSpaSnapEdgesFromPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const pts = points
    .map((p) => (p?.isVector2 ? p.clone() : new THREE.Vector2(Number.isFinite(p?.x) ? p.x : 0, Number.isFinite(p?.y) ? p.y : 0)))
    .filter(Boolean);

  if (pts.length < 2) return [];

  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    area += p.x * q.y - q.x * p.y;
  }
  const ccw = area >= 0;

  const edges = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % pts.length];
    if (!p0 || !p1 || p0.distanceToSquared(p1) <= 1e-10) continue;

    const tangent = p1.clone().sub(p0);
    const length = tangent.length();
    if (length <= 1e-6) continue;
    tangent.divideScalar(length);

    const normal = ccw
      ? new THREE.Vector2(-tangent.y, tangent.x)
      : new THREE.Vector2(tangent.y, -tangent.x);

    edges.push({
      p0: p0.clone(),
      p1: p1.clone(),
      center: p0.clone().add(p1).multiplyScalar(0.5),
      tangent,
      normal: normal.normalize(),
      length
    });
  }

  return edges;
}

/* =====================================================
   UV HELPERS
   ===================================================== */

function generateMeterUVsForShapeGeometry(geo, tileSize) {
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = pos.getX(i) / tileSize;
    uvs[i * 2 + 1] = pos.getY(i) / tileSize;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

function generateMeterUVsForBoxGeometry(geo, tileSize) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));

    let u = 0, v = 0;

    if (az >= ax && az >= ay) {
      u = x / tileSize;
      v = y / tileSize;
    } else if (ay >= ax && ay >= az) {
      u = x / tileSize;
      v = z / tileSize;
    } else {
      u = y / tileSize;
      v = z / tileSize;
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

function addUV2(geo) {
  if (geo?.attributes?.uv && !geo.attributes.uv2) {
    geo.setAttribute("uv2", geo.attributes.uv.clone());
  }
}

/* =====================================================
   RECTANGLE POOL DEPTH LOGIC (ported verbatim style)
   ===================================================== */

function computeRectangleDepthAtX(worldX, params, axisStartX, axisEndX, originX) {
  const clampedShallow = Math.max(0.5, params.shallow);
  const clampedDeep = Math.max(clampedShallow, params.deep);

  let sFlat = params.shallowFlat || 0;
  let dFlat = params.deepFlat || 0;

  const fullLen = axisEndX - originX;
  const maxFlats = Math.max(0, fullLen - 0.01);

  if (sFlat + dFlat > maxFlats) {
    const scale = maxFlats / (sFlat + dFlat);
    sFlat *= scale;
    dFlat *= scale;
  }

  const slopeLen = Math.max(0.01, fullLen - sFlat - dFlat);

  // dx measured from "originX" (which accounts for steps region)
  let dx = worldX - originX;
  if (dx < 0) dx = 0;

  if (dx <= sFlat) return -clampedShallow;
  if (dx >= fullLen - dFlat) return -clampedDeep;

  const t = (dx - sFlat) / slopeLen;
  return -(clampedShallow + t * (clampedDeep - clampedShallow));
}

function computeRectangleDepthOnWallAxis(worldX, worldY, params, frame, axisLen, stepFootprintLen) {
  if (!frame) return computeRectangleDepthAtX(worldX, params, 0, axisLen, stepFootprintLen);

  const clampedShallow = Math.max(0.5, params.shallow);
  const clampedDeep = Math.max(clampedShallow, params.deep);
  let sFlat = params.shallowFlat || 0;
  let dFlat = params.deepFlat || 0;
  const fullLen = Math.max(0.01, axisLen - stepFootprintLen);
  const maxFlats = Math.max(0, fullLen - 0.01);

  if (sFlat + dFlat > maxFlats) {
    const scale = maxFlats / (sFlat + dFlat);
    sFlat *= scale;
    dFlat *= scale;
  }

  const slopeLen = Math.max(0.01, fullLen - sFlat - dFlat);
  const axisCoord = frame.axis === "x" ? worldX : worldY;
  const originCoord = frame.wallCoord + frame.inwardSign * stepFootprintLen;
  let dx = frame.inwardSign * (axisCoord - originCoord);
  if (dx < 0) dx = 0;

  if (dx <= sFlat) return -clampedShallow;
  if (dx >= fullLen - dFlat) return -clampedDeep;

  const t = (dx - sFlat) / slopeLen;
  return -(clampedShallow + t * (clampedDeep - clampedShallow));
}


function isPointOnSegment2D(p, a, b, eps = 1e-6) {
  const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > eps) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  if (dot < -eps) return false;
  const lenSq = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  return dot <= lenSq + eps;
}

function isPointInsideClosedPolygon2D(p, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;
  const limit = polygon[0].distanceToSquared?.(polygon[n - 1]) < 1e-10 ? n - 1 : n;

  for (let i = 0, j = limit - 1; i < limit; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;

    if (isPointOnSegment2D(p, a, b)) return true;

    const intersects = ((a.y > p.y) !== (b.y > p.y)) &&
      (p.x < ((b.x - a.x) * (p.y - a.y)) / ((b.y - a.y) || 1e-12) + a.x);

    if (intersects) inside = !inside;
  }

  return inside;
}

function createProfiledFloorGeometryFromPolygon(perimeter2D, bb, params, tileSize, axisStartWallX, axisEndX, originX, stepWallFrame = null, axisLenOverride = null, stepFootprintLenOverride = null) {
  const bbLen = Math.max(0.1, bb.max.x - bb.min.x);
  const bbWid = Math.max(0.1, bb.max.y - bb.min.y);

  // A regular clipped grid is used instead of ShapeGeometry. ShapeGeometry only
  // creates sparse triangulation vertices, so a customised outline could lose
  // the exact 1 m shallow/deep flat bands and show a single diagonal floor fall.
  const tile = Math.max(0.05, Number(tileSize) || 0.3);
  const cell = Math.min(0.2, Math.max(0.1, tile));
  const segmentsX = Math.max(2, Math.ceil(bbLen / cell));
  const segmentsY = Math.max(2, Math.ceil(bbWid / cell));
  const dx = bbLen / segmentsX;
  const dy = bbWid / segmentsY;

  const positions = [];
  const indices = [];
  const uvs = [];

  function addVertex(x, y) {
    const z = stepWallFrame
      ? computeRectangleDepthOnWallAxis(x, y, params, stepWallFrame, axisLenOverride ?? (axisEndX - axisStartWallX), stepFootprintLenOverride ?? Math.max(0, originX - axisStartWallX))
      : computeRectangleDepthAtX(x, params, axisStartWallX, axisEndX, originX);
    positions.push(x, y, z);
    uvs.push(x / tile, y / tile);
    return positions.length / 3 - 1;
  }

  for (let ix = 0; ix < segmentsX; ix++) {
    const x0 = bb.min.x + ix * dx;
    const x1 = ix === segmentsX - 1 ? bb.max.x : x0 + dx;
    for (let iy = 0; iy < segmentsY; iy++) {
      const y0 = bb.min.y + iy * dy;
      const y1 = iy === segmentsY - 1 ? bb.max.y : y0 + dy;
      const center = new THREE.Vector2((x0 + x1) * 0.5, (y0 + y1) * 0.5);
      if (!isPointInsideClosedPolygon2D(center, perimeter2D)) continue;

      const a = addVertex(x0, y0);
      const b = addVertex(x1, y0);
      const c = addVertex(x1, y1);
      const d = addVertex(x0, y1);
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  addUV2(geo);
  return geo;
}

/* =====================================================
   CURVE SAMPLING (FOR WALL BENDING)
   ===================================================== */

function sampleQuadratic(v1, c, v2, segments) {
  const pts = [];
  const n = Math.max(2, segments | 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const it = 1 - t;
    pts.push(
      new THREE.Vector2(
        it * it * v1.x + 2 * it * t * c.x + t * t * v2.x,
        it * it * v1.y + 2 * it * t * c.y + t * t * v2.y
      )
    );
  }
  return pts;
}



function polygonSignedArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  const limit = points[0].distanceToSquared(points[n - 1]) < 1e-10 ? n - 1 : n;
  for (let i = 0; i < limit; i++) {
    const a = points[i];
    const b = points[(i + 1) % limit];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function lineIntersection2D(a1, a2, b1, b2) {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-8) return null;

  const dx = b1.x - a1.x;
  const dy = b1.y - a1.y;
  const t = (dx * dby - dy * dbx) / denom;
  return new THREE.Vector2(a1.x + dax * t, a1.y + day * t);
}

function createMiteredWallPrism(pPrev, p0, p1, pNext, halfThickness, height, isCCW) {
  const dir = p1.clone().sub(p0);
  const len = dir.length();
  if (len < 1e-6) return null;
  dir.multiplyScalar(1 / len);

  const prevDir = p0.clone().sub(pPrev);
  if (prevDir.lengthSq() > 1e-10) prevDir.normalize();
  else prevDir.copy(dir);

  const nextDir = pNext.clone().sub(p1);
  if (nextDir.lengthSq() > 1e-10) nextDir.normalize();
  else nextDir.copy(dir);

  const leftNormal = (v) => new THREE.Vector2(-v.y, v.x);
  const inwardFor = (v) => (isCCW ? leftNormal(v) : leftNormal(v).multiplyScalar(-1));

  const curIn = inwardFor(dir);
  const prevIn = inwardFor(prevDir);
  const nextIn = inwardFor(nextDir);

  const curOut = curIn.clone().multiplyScalar(-1);
  const prevOut = prevIn.clone().multiplyScalar(-1);
  const nextOut = nextIn.clone().multiplyScalar(-1);

  const offsetLine = (a, b, n, d) => [a.clone().addScaledVector(n, d), b.clone().addScaledVector(n, d)];

  const [curInnerA, curInnerB] = offsetLine(p0, p1, curIn, halfThickness);
  const [curOuterA, curOuterB] = offsetLine(p0, p1, curOut, halfThickness);
  const [prevInnerA, prevInnerB] = offsetLine(pPrev, p0, prevIn, halfThickness);
  const [prevOuterA, prevOuterB] = offsetLine(pPrev, p0, prevOut, halfThickness);
  const [nextInnerA, nextInnerB] = offsetLine(p1, pNext, nextIn, halfThickness);
  const [nextOuterA, nextOuterB] = offsetLine(p1, pNext, nextOut, halfThickness);

  let innerStart = lineIntersection2D(prevInnerA, prevInnerB, curInnerA, curInnerB) || curInnerA.clone();
  let outerStart = lineIntersection2D(prevOuterA, prevOuterB, curOuterA, curOuterB) || curOuterA.clone();
  let innerEnd = lineIntersection2D(curInnerA, curInnerB, nextInnerA, nextInnerB) || curInnerB.clone();
  let outerEnd = lineIntersection2D(curOuterA, curOuterB, nextOuterA, nextOuterB) || curOuterB.clone();

  const maxMiter = halfThickness * 8;
  if (innerStart.distanceTo(p0) > maxMiter) innerStart = curInnerA.clone();
  if (outerStart.distanceTo(p0) > maxMiter) outerStart = curOuterA.clone();
  if (innerEnd.distanceTo(p1) > maxMiter) innerEnd = curInnerB.clone();
  if (outerEnd.distanceTo(p1) > maxMiter) outerEnd = curOuterB.clone();

  const wallShape = new THREE.Shape([
    new THREE.Vector2(innerStart.x, innerStart.y),
    new THREE.Vector2(innerEnd.x, innerEnd.y),
    new THREE.Vector2(outerEnd.x, outerEnd.y),
    new THREE.Vector2(outerStart.x, outerStart.y)
  ]);

  const geo = new THREE.ExtrudeGeometry(wallShape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1
  });
  // Center the wall depth around the local origin so wall raising can use the
  // same stable transform behaviour as the older v7.1 box-based walls:
  // scale local Z, then shift the mesh by half the extra height.
  geo.translate(0, 0, -height * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function makeShapeFromClosedPoints(points) {
  const shape = new THREE.Shape();
  if (!points || points.length < 3) return shape;

  const first = points[0];
  shape.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }

  const last = points[points.length - 1];
  if (last.distanceToSquared(first) > 1e-10) {
    shape.lineTo(first.x, first.y);
  }
  return shape;
}

/* =====================================================
   COPING MATERIAL (restore travertine PBR)
   ===================================================== */

const _copingTexCache = { loaded: false, maps: null };
function getCopingMaps() {
  if (_copingTexCache.loaded) return _copingTexCache.maps;

  const loader = new THREE.TextureLoader();
  const baseColorMap = loader.load("textures/Coping/TilesTravertine001_COL_4K.jpg");
  const normalMap = loader.load("textures/Coping/TilesTravertine001_NRM_4K.jpg");
  const roughnessMap = loader.load("textures/Coping/TilesTravertine001_GLOSS_4K.jpg");
  const aoMap = loader.load("textures/Coping/TilesTravertine001_AO_4K.jpg");

  [baseColorMap, normalMap, roughnessMap, aoMap].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
  });

  _copingTexCache.loaded = true;
  _copingTexCache.maps = { baseColorMap, normalMap, roughnessMap, aoMap };
  return _copingTexCache.maps;
}

function makeCopingMat() {
  const maps = getCopingMaps();
  return new THREE.MeshStandardMaterial({
    map: maps.baseColorMap,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    aoMap: maps.aoMap,
    metalness: 0.0,
    roughness: 1.0
  });
}

/* =====================================================
   POOL BUILDER
   ===================================================== */

class PoolBuilder {
  constructor(polygon, params, tileSize) {
    this.polygon = polygon;
    this.params = params;
    this.tileSize = tileSize;

    this.group = new THREE.Group();

    // Keep datum at z=0 (coping / top of wall)
    this.group.position.set(0, 0, 0);

    this.group.userData.poolParams = { ...params };

    // PoolApp expects copingSegments array + wall.copingIndex mapping
    this.copingMeshes = [];

    this.build();
  }

  clearGroup() {
    while (this.group.children.length) {
      const c = this.group.children.pop();
      if (c?.geometry) c.geometry.dispose();
      // Do not dispose materials here (PBRManager swaps materials a lot).
    }
  }

  build() {
    this.clearGroup();
    this.copingMeshes.length = 0;

    // Build the visible/water footprint from the fully sampled perimeter so
    // freeform curves and edited edges fill the actual pool shape.
    let shape = null;

    // We will build:
    //  - CURVE-AWARE perimeter for walls/coping + outerPts (void cutting)
    //  - RECTANGULAR footprint (bounding box) for floor + rectangle steps
    const perimeter2D = [];
    const perimeterSourceEdgeIndices = [];
    const vCount = this.polygon.vertexCount();

    for (let i = 0; i < vCount; i++) {
      const v1 = this.polygon.getVertex(i);
      const v2 = this.polygon.getVertex(this.polygon.nextIndex(i));
      const e = this.polygon.getEdge(i);

      const pts =
        e?.isCurved && e.control
          ? sampleQuadratic(v1, e.control, v2, 24)
          : [v1.clone(), v2.clone()];

      for (let j = 0; j < pts.length - 1; j++) {
        const p1 = pts[j];
        // avoid duplicates
        if (
          perimeter2D.length === 0 ||
          perimeter2D[perimeter2D.length - 1].distanceToSquared(p1) > 1e-10
        ) {
          perimeter2D.push(p1.clone());
          perimeterSourceEdgeIndices.push(i);
        }
      }
    }

    // close loop with last vertex
    if (perimeter2D.length) {
      const last = perimeter2D[perimeter2D.length - 1];
      const first = perimeter2D[0];
      if (last.distanceToSquared(first) > 1e-10) perimeter2D.push(first.clone());
    }

    shape = makeShapeFromClosedPoints(perimeter2D);

    // Expose outerPts for ground void cutting (PoolApp/scene.js uses this)
    this.group.userData.outerPts = perimeter2D.map(
      (v) => new THREE.Vector2(v.x, v.y)
    );
    this.group.userData.spaSnapEdges = buildSpaSnapEdgesFromPoints(perimeter2D.slice(0, Math.max(0, perimeter2D.length - 1)));

    // Bounding box footprint for rectangle-style floor/steps
    const bb = new THREE.Box2();
    for (const p of perimeter2D) bb.expandByPoint(p);

    const bbLen = Math.max(0.1, bb.max.x - bb.min.x);
    const bbWid = Math.max(0.1, bb.max.y - bb.min.y);

    const cx = (bb.min.x + bb.max.x) * 0.5;
    const cy = (bb.min.y + bb.max.y) * 0.5;

    /* =====================================================
       FLOOR (RECTANGLE-POOL LOGIC, FIT TO BBOX)
       ===================================================== */

    const STEP_LENGTH = 0.3;
    const STEP_TOP_OFFSET = 0.25;

    const stepCount = Math.max(0, this.params.stepCount | 0);
    const stepDepth = Math.max(0.01, this.params.stepDepth ?? 0.2);

    const axisStartWallX = cx - bbLen / 2;
    const axisEndX = cx + bbLen / 2;
    const stepWallFrame = getStepWallFrame(this.params, bb.min.x, bb.max.x, bb.min.y, bb.max.y);
    const axisLen = stepWallFrame.axis === "x" ? bbLen : bbWid;

    // originX is retained for backward-compatible section/floor metadata.
    // The actual profiled floor now uses the selected step wall frame so north,
    // south and east entries no longer behave like west-side entries.
    const stepFootprintLen = stepCount > 0 ? getStepFootprintLength(this.params, stepCount, STEP_LENGTH) : 0;
    const originX = axisStartWallX + stepFootprintLen;

    const floorGeo = createProfiledFloorGeometryFromPolygon(
      perimeter2D,
      bb,
      this.params,
      this.tileSize,
      axisStartWallX,
      axisEndX,
      originX,
      stepWallFrame,
      axisLen,
      stepFootprintLen
    );

    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial());
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    floor.userData.isFloor = true;
    floor.userData.type = "floor";
    this.group.add(floor);

    
    this.group.userData.floorMesh = floor;
    this.group.userData.floorMeta = {
      cx: 0, cy: 0,
      bbLen, bbWid,
      axisStartWallX,
      axisEndX,
      originX,
      stepWall: stepWallFrame.wall,
      stepAxis: stepWallFrame.axis,
    };

    // Section-view caps/handles use these top-level values.
    // Customised/curved presets previously only stored originX in floorMeta,
    // so section caps fell back to the raw bounding-box start and could place
    // the shallow-flat/deep-flat break points differently from the floor mesh.
    this.group.userData.originX = originX;
    this.group.userData.stepWall = stepWallFrame.wall;
    this.group.userData.stepFootprintLen = stepFootprintLen;

/* =====================================================
       STEPS (RECTANGLE-POOL LOGIC, FIT TO BBOX WIDTH)
       ===================================================== */

    if (stepCount > 0) {
      const clampedShallow = Math.max(0.5, this.params.shallow);
      const stepWallFrame = getStepWallFrame(this.params, bb.min.x, bb.max.x, bb.min.y, bb.max.y);
      const narrowLayout = getStepLayout(this.params, stepWallFrame.spanMin, stepWallFrame.spanMax);
      const fullStepLayout = getStepLayout(this.params, stepWallFrame.spanMin, stepWallFrame.spanMax, { fullWidth: true });

      for (let s = 0; s < stepCount; s++) {
        const liveParams = this.params ?? params;
        const bench2Extension = getBench2Extension(liveParams);
        const diagonalStepSize = getDiagonalStepSize(liveParams, bench2Extension);
        const stepBenchMode = liveParams?.stepBenchMode === "stepsOnly" ? "stepsOnly" : "bench";
        const wantsBenchSeat = stepBenchMode === "bench" && stepCount > 1;
      const baseLayout = wantsBenchSeat && s === 1 ? fullStepLayout : narrowLayout;
        const isCenteredCircular = liveParams?.stepShape === "circular" && baseLayout.position === "center";
        const centeredCircularMode = stepBenchMode;
        const isBenchSeat = wantsBenchSeat && s === 1;
        const isCenterBenchSeat = isCenteredCircular && isBenchSeat;
        let layout = isBenchSeat ? { ...fullStepLayout, isBenchSeat: true } : baseLayout;
        const topDepth = Math.max(0, Math.min(clampedShallow - 0.05, STEP_TOP_OFFSET + stepDepth * s));
        const h = Math.max(0.05, clampedShallow - topDepth);

        if (stepBenchMode === "stepsOnly") {
          const nestedFullWidth = Math.max(0.05, stepWallFrame.spanMax - stepWallFrame.spanMin);
          const nestedBaseWidth = Math.max(0.05, Number(narrowLayout.width) || STEP_PRESET_WIDTH);
          const nestedWidthGrowth = narrowLayout.position === "center" ? STEP_TIER_OFFSET * 2 * s : STEP_TIER_OFFSET * s;
          const nestedWidth = Math.min(nestedFullWidth, nestedBaseWidth + nestedWidthGrowth);
          let nestedCenterY = (stepWallFrame.spanMin + stepWallFrame.spanMax) * 0.5;
          if (narrowLayout.position === "left") nestedCenterY = stepWallFrame.spanMin + nestedWidth * 0.5;
          if (narrowLayout.position === "right") nestedCenterY = stepWallFrame.spanMax - nestedWidth * 0.5;
          layout = { ...layout, width: nestedWidth, centerY: nestedCenterY, isFullWidth: false, isBenchSeat: false };
        }


        const centeredCircularRadius = Math.max(0.05, Number(liveParams?.stepExtension) || ((Number(liveParams?.stepWidth) || STEP_PRESET_WIDTH) * 0.5));
        const centeredCircularStepCount = Math.max(1, centeredCircularMode === "bench" && stepCount > 1 ? stepCount - 1 : stepCount);
        const centeredCircularOrdinal = centeredCircularMode === "bench" && stepCount > 1
          ? (s < 1 ? s + 1 : s)
          : (s + 1);
        const centeredCircularRun = centeredCircularMode === "stepsOnly"
          ? centeredCircularRadius + STEP_TIER_OFFSET * s
          : centeredCircularRadius * (centeredCircularOrdinal / centeredCircularStepCount);
        const isDiagonalNarrow = (liveParams?.stepShape === "diagonal" || liveParams?.stepShape === "circular") && !isBenchSeat && layout.position !== "center";
        let stepRun = isBenchSeat ? bench2Extension : (isCenteredCircular ? centeredCircularRun : (isDiagonalNarrow ? diagonalStepSize : STEP_LENGTH));
        let stepWidthForGeo = isBenchSeat ? layout.width : (isCenteredCircular ? centeredCircularRun * 2 : (isDiagonalNarrow ? diagonalStepSize : layout.width));
        if (stepBenchMode === "stepsOnly") {
          if (isCenteredCircular) {
            stepWidthForGeo = layout.width;
            stepRun = Math.max(0.05, stepWidthForGeo * 0.5);
          } else if (isDiagonalNarrow) {
            stepRun = Math.max(0.05, diagonalStepSize + STEP_TIER_OFFSET * s);
            stepWidthForGeo = stepRun;
          } else {
            stepRun = Math.max(0.05, STEP_LENGTH + STEP_TIER_OFFSET * s);
            stepWidthForGeo = layout.width;
          }

          // Optional per-tier override: the Step Extension slider can extend the
          // selected tier without forcing every tier to remain exactly 300 mm apart.
          const customRun = getStepsOnlyStepRunOverride(liveParams ?? params, s);
          if (customRun !== null) {
            stepRun = customRun;
            if (isDiagonalNarrow) stepWidthForGeo = customRun;
          }
        }
        const geo = createStepGeometry(stepRun, stepWidthForGeo, h, liveParams, layout);
        const step = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());

        const distanceFromWall = isCenteredCircular
          ? ((stepBenchMode === "bench" && stepCount > 1 && s > 1 ? bench2Extension : 0) + stepRun * 0.5)
          : (stepBenchMode === "stepsOnly"
              ? stepRun * 0.5
              : (s <= 1
                  ? stepRun * 0.5
                  : bench2Extension + ((s - 2) * stepRun) + stepRun * 0.5));
        const z = -(topDepth + h * 0.5);

        placeStepOnWall(step, stepWallFrame, distanceFromWall, layout.centerY, z);
        step.userData.isStep = true;
        step.userData.type = "step";
        step.userData.stepIndex = s;
        step.userData.stepPosition = layout.position;
        step.userData.stepWall = stepWallFrame.wall;
      step.userData.stepShape = (["diagonal", "circular", "radius"].includes(this.params?.stepShape)) ? this.params.stepShape : "rectangle";
        step.userData.stepWidth = stepWidthForGeo;
        step.userData.baseHeight = h;
      step.userData.stepRun = stepRun;
        step.userData.stepRun = stepRun;
        step.castShadow = true;
        step.receiveShadow = true;

        this.group.add(step);
      }

      addStepBenchMeshes(
        this.group,
        this.params,
        narrowLayout,
        bb.min.y,
        bb.max.y,
        axisStartWallX,
        STEP_LENGTH,
        STEP_TOP_OFFSET,
        stepDepth
      );
    }

    /* =====================================================
       WALLS + COPING (CURVE-AWARE, BENDS WITH BLUE HANDLES)
       ===================================================== */
    const wallHeight = Math.max(this.params.deep, this.params.shallow);
    const wallThickness = 0.05;
    const isCCW = polygonSignedArea(perimeter2D) >= 0;

    // We build walls from perimeter2D segments using mitered joins so corners do not overlap/flicker.
    for (let i = 0; i < perimeter2D.length - 1; i++) {
      const p0 = perimeter2D[i];
      const p1 = perimeter2D[i + 1];
      const pPrev = perimeter2D[(i - 1 + (perimeter2D.length - 1)) % (perimeter2D.length - 1)];
      const pNext = perimeter2D[(i + 2) % (perimeter2D.length - 1)];

      const len = p0.distanceTo(p1);
      if (len < 1e-6) continue;

      const wallGeo = createMiteredWallPrism(pPrev, p0, p1, pNext, wallThickness * 0.5, wallHeight, isCCW);
      if (!wallGeo) continue;
      generateMeterUVsForBoxGeometry(wallGeo, this.tileSize);
      addUV2(wallGeo);

      const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial());
      wall.position.z = -wallHeight / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.userData.isWall = true;
      wall.userData.baseHeight = wallHeight;
      wall.userData.currentHeight = wallHeight;
      wall.userData.extraHeight = 0;
      const sourceEdgeIndex = perimeterSourceEdgeIndices[i] ?? i;
      wall.userData.copingIndex = this.copingMeshes.length;
      wall.userData.edgeIndex = i;
      wall.userData.sourceEdgeIndex = sourceEdgeIndex;
      wall.userData.sourceEdgeCurved = !!this.polygon.getEdge(sourceEdgeIndex)?.isCurved;
      this.group.add(wall);

      const copingDepth = 0.05;
      const copingGeo = createMiteredWallPrism(pPrev, p0, p1, pNext, 0.125, copingDepth, isCCW);
      if (!copingGeo) continue;
      generateMeterUVsForBoxGeometry(copingGeo, this.tileSize);
      addUV2(copingGeo);

      const coping = new THREE.Mesh(copingGeo, makeCopingMat());
      coping.position.z = 0.001;
      coping.castShadow = true;
      coping.receiveShadow = true;
      coping.userData.isCoping = true;
      coping.userData.baseZ = coping.position.z;
      this.group.add(coping);
      this.copingMeshes.push(coping);
    }

    this.group.userData.copingSegments = this.copingMeshes;

    /* =====================================================
       WATER (FOLLOW FREEFORM SHAPE, NOT THE RECT FLOOR)
       ===================================================== */

    const water = createPoolWater(this.params.length, this.params.width);
    const waterGeo = new THREE.ShapeGeometry(shape, 256);

    if (water.geometry) water.geometry.dispose();
    water.geometry = waterGeo;

    water.position.set(0, 0, -0.1);
    this.group.userData.waterMesh = water;
    this.group.add(water);

    
    // ------------------------------------------------------------
    // Caustics overlay (projected onto pool floor) driven by ripple sim gradient
    // ------------------------------------------------------------
    if (false && !this.group.userData.causticsOverlay && this.group.userData.floorMesh) { // disabled: using CausticsSystem RT injection
      const floorMesh = this.group.userData.floorMesh;

      const causticsUniforms = {
        time: { value: 0 },
        heightTex: { value: (water.material?.uniforms?.heightTex?.value || water.material?.uniforms?.heightmap?.value || null) },
        texel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        poolCenter: { value: new THREE.Vector2(floorMesh.position.x, floorMesh.position.y) },
        poolSize: { value: new THREE.Vector2(this.params.length, this.params.width) },
        strength: { value: 1.25 },
        scale: { value: 2.6 },
        speed: { value: 0.42 }
      };

      const causticsMat = new THREE.ShaderMaterial({
        uniforms: causticsUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vPosW;
          void main(){
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vPosW = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          precision highp float;

          uniform float time;
          uniform sampler2D heightTex;
          uniform vec2 texel;

          uniform vec2 poolCenter;
          uniform vec2 poolSize;

          uniform float strength;
          uniform float scale;
          uniform float speed;

          varying vec2 vUv;
          varying vec3 vPosW;

          float hmap(vec2 uv){ return texture2D(heightTex, uv).r; }

          void main(){
            // Map world XY to 0..1 over pool footprint
            vec2 rel = (vPosW.xy - poolCenter) / max(poolSize, vec2(0.001));
            vec2 cuv = rel + 0.5;

            // Animated caustics UV (Water.zip style drift)
            cuv = fract(cuv * scale + vec2(0.09, -0.06) * time * speed);

            float h0 = hmap(cuv);
            float hx = hmap(cuv + vec2(texel.x, 0.0));
            float hy = hmap(cuv + vec2(0.0, texel.y));
            vec2 g = vec2(hx - h0, hy - h0);

            float focus = 1.0 - smoothstep(0.0, 0.03, length(g));
            float ca = pow(focus, 6.0);

            float flow = 0.5 + 0.5 * sin((cuv.x + cuv.y) * 12.0 + time * 1.5);
            ca *= (0.55 + 0.65 * flow);

            float a = ca * strength;

            // Warm/cyan caustics tint (subtle)
            vec3 col = vec3(0.85, 0.95, 1.00) * a;

            // Fade toward edges so it doesn't hit the coping
            float edgeX = smoothstep(0.0, 0.06, cuv.x) * smoothstep(1.0, 0.94, cuv.x);
            float edgeY = smoothstep(0.0, 0.06, cuv.y) * smoothstep(1.0, 0.94, cuv.y);
            float edge = edgeX * edgeY;

            gl_FragColor = vec4(col, a * edge);
          }
        `
      });

      const causticsGeo = floorMesh.geometry.clone();
      const caustics = new THREE.Mesh(causticsGeo, causticsMat);
      caustics.position.copy(floorMesh.position);
      caustics.position.z += 0.02; // lift slightly above floor (Z-up)
      caustics.renderOrder = 5;

      // Animate hook (PoolApp animatables)
      caustics.userData.animate = (delta, clock, camera, dirLight, renderer) => {
        const t = clock.getElapsedTime();
        causticsMat.uniforms.time.value = t;

        // Keep sampling the latest heightmap texture from water sim
        const hm = water.material?.uniforms?.heightTex?.value || water.material?.uniforms?.heightmap?.value;
        if (hm) causticsMat.uniforms.heightTex.value = hm;
      };

      this.group.userData.causticsOverlay = caustics;
      this.group.userData.animatables = this.group.userData.animatables || [];
      this.group.userData.animatables.push(caustics);
      this.group.add(caustics);
    }
// Restore ripple hook expected by PoolApp
    const rippler =
      water?.userData?.triggerRipple ||
      water?.userData?.water?.userData?.triggerRipple ||
      water?.userData?.ripple?.triggerRipple;

    if (typeof rippler === "function") {
      this.group.userData.triggerRipple = (...args) => rippler(...args);
    }
  }

  getGroup() {
    return this.group;
  }
}

/* =====================================================
   EXPORT
   ===================================================== */
function addStepBenchMeshes(group, params, layout, spanMinY, spanMaxY, startX, stepLength, topOffset, stepDepth) {
  // Disabled: the old side-bench add-on looked too busy with the new presets.
  // The second step now provides the full-width bench/ledge band.
  return;

  if (!params?.stepBenchEnabled || !group || !layout) return;

  const fullWidth = Math.max(0.05, spanMaxY - spanMinY);
  const stepMinY = layout.centerY - layout.width * 0.5;
  const stepMaxY = layout.centerY + layout.width * 0.5;
  const gap = 0.01;

  const ranges = [];
  const leftWidth = stepMinY - spanMinY;
  const rightWidth = spanMaxY - stepMaxY;

  if (leftWidth > 0.15) ranges.push([spanMinY, stepMinY - gap * 0.5]);
  if (rightWidth > 0.15) ranges.push([stepMaxY + gap * 0.5, spanMaxY]);

  // When the steps already occupy the full wall width there is no safe side bench
  // to add in this first-stage geometry. Leave it hidden instead of overlapping steps.
  if (!ranges.length || layout.width >= fullWidth - 0.02) return;

  const benchRun = Math.max(0.25, Math.min(0.6, stepLength * 1.5));
  const benchHeight = Math.max(0.05, Math.min(0.35, Number(stepDepth) || 0.2));
  const benchX = startX + benchRun * 0.5;
  const benchZ = -(topOffset + benchHeight * 0.5);

  ranges.forEach(([minY, maxY], idx) => {
    const benchWidth = Math.max(0.05, maxY - minY);
    const geo = new THREE.BoxGeometry(benchRun, benchWidth, benchHeight);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const bench = new THREE.Mesh(geo, mat);

    bench.position.set(benchX, (minY + maxY) * 0.5, benchZ);
    bench.userData.isStep = true;
    bench.userData.isStepAddon = true;
    bench.userData.isStepBench = true;
    bench.userData.type = "step";
    bench.userData.stepIndex = -100 - idx;
    bench.userData.stepPosition = layout.position;
    bench.userData.stepWidth = benchWidth;
    bench.userData.baseHeight = benchHeight;
    bench.castShadow = true;
    bench.receiveShadow = true;

    group.add(bench);
  });
}


export function createPoolGroup(params, tileSize = 0.3, editablePolygon = null) {
  const polygon =
    editablePolygon || EditablePolygon.fromRectangle(params.length, params.width);

  const builder = new PoolBuilder(polygon, params, tileSize);
  const group = builder.getGroup();
  // Persist the latest full params on the group for lightweight live updates.
  group.userData.params = { ...params };
  return group;
}


// ------------------------------------------------------------
// Live preview: update floor vertex Z + wall height without rebuilding geometry.
// Safe for slider-drag; does NOT touch coping/steps/water sim.
// Requires: group.userData.floorMesh + group.userData.floorMeta
export function previewUpdateDepths(group, paramsPatch = {}) {
  if (!group?.userData?.floorMesh?.geometry) return false;

  // Merge patch onto last-known params (stored on group by creator)
  group.userData.params = group.userData.params || {};
  const params = Object.assign({}, group.userData.params, paramsPatch);

  // Keep semantics: deep >= shallow, both >= 0.5
  const shallow = Math.max(0.5, params.shallow ?? 1.2);
  const deep = Math.max(shallow, params.deep ?? shallow);
  params.shallow = shallow;
  params.deep = deep;

  const STEP_LENGTH = 0.3;
  const STEP_TOP_OFFSET = 0.25;

  // Some shapes don't store floorMeta. Fallback: derive an X-axis span directly
  // from the current floor geometry so we can still preview depth changes live.
  let meta = group.userData.floorMeta;
  if (!meta) {
    const floor = group.userData.floorMesh;
    const geo = floor.geometry;
    const pos = geo.attributes.position;

    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }

    const cx = floor.position?.x || 0;
    const cy = floor.position?.y || 0;

    const axisStartWallX = minX + cx;
    const axisEndX = maxX + cx;

    // Make shallowFlat start AFTER the steps run (so sFlat=0 begins at last-step end).
    const stepCount = Math.max(0, (params.stepCount | 0));
    const originX = Math.min(axisEndX, axisStartWallX + getStepFootprintLength(params, stepCount, STEP_LENGTH));

    meta = { cx, cy, axisStartWallX, axisEndX, originX };
  }

  // Update floor vertices (z only)
  const floor = group.userData.floorMesh;
  const geo = floor.geometry;
  const pos = geo.attributes.position;
  const cx = meta.cx || 0;

  for (let i = 0; i < pos.count; i++) {
    const worldX = pos.getX(i) + cx; // local x + mesh center x
    const z = computeRectangleDepthAtX(
      worldX,
      params,
      meta.axisStartWallX || meta.originX,
      meta.axisEndX,
      meta.originX
    );
    pos.setZ(i, z);
  }

  pos.needsUpdate = true;

  // Normals: recompute (caller may throttle this by calling less often)
  geo.computeVertexNormals();
  if (geo.attributes.normal) geo.attributes.normal.needsUpdate = true;

  // Update wall height (uniform max depth; top stays at z=0)
  const wallHeight = Math.max(params.deep, params.shallow);
  group.traverse((obj) => {
    if (!obj?.isMesh) return;

    if (obj.userData?.isWall) {
      const baseH = obj.userData.baseHeight || 1;
      const extraH = Math.max(0, Number(obj.userData?.extraHeight) || 0);
      const totalH = wallHeight + extraH;
      obj.scale.z = totalH / baseH;
      obj.position.z = -(wallHeight / 2) + extraH / 2;
      obj.userData.currentHeight = totalH;
      return;
    }

    // Steps: keep all step tops fixed; last step grows/shrinks so its bottom stays
    // attached to the shallow floor when shallow changes.
    if (obj.userData?.isStep) {
      const stepCount = Math.max(0, (params.stepCount | 0));
      if (stepCount <= 0) return;

      const idx = obj.userData.stepIndex;
      if (idx == null) return;

      const stepDepth = Math.max(0.01, params.stepDepth ?? 0.2);

      // Default step height is stepDepth; last step auto-fills to shallow floor.
      let h = stepDepth;

      if (idx === stepCount - 1) {
        const used = stepDepth * (stepCount - 1);
        h = params.shallow - STEP_TOP_OFFSET - used;
        if (h < 0.05) h = 0.05;

        // Top of last step should match the top plane of the step stack:
        // topZ = -(STEP_TOP_OFFSET + stepDepth * idx)
        const topZ = -(STEP_TOP_OFFSET + stepDepth * idx);
        const baseH = obj.userData.baseHeight || h;
        obj.scale.z = h / baseH;
        obj.position.z = topZ - h / 2;
      } else {
        // Non-last steps keep standard center position; update if stepDepth changes.
        const topZ = -(STEP_TOP_OFFSET + stepDepth * idx);
        const baseH = obj.userData.baseHeight || h;
        obj.scale.z = h / baseH;
        obj.position.z = topZ - h / 2;
      }
    }
  });

  // Persist merged params for next patch
  group.userData.params = params;

  return true;
}