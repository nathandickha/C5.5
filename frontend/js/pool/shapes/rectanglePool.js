// js/pool/shapes/rectanglePool.js
import * as THREE from "https://esm.sh/three@0.158.0";
import { createPoolWater } from "../water.js";

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
  const wallCoord = getBoundaryWallCoord(frame, alongCenter, frame.wallCoord);
  const runCenter = wallCoord + frame.inwardSign * distanceFromWall;
  if (frame.axis === "x") {
    step.position.set(runCenter, alongCenter, z);
  } else {
    step.position.set(alongCenter, runCenter, z);
  }
  step.rotation.z = frame.rotationZ;
}


function getClosedBoundaryPoints(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const clean = points
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => new THREE.Vector2(p.x, p.y));
  if (clean.length < 3) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first.distanceToSquared(last) > 1e-10) clean.push(first.clone());
  return clean;
}

function getBoundaryIntersections(boundaryPoints, axis, coord) {
  const pts = getClosedBoundaryPoints(boundaryPoints);
  if (!pts) return [];
  const values = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const aCoord = axis === "x" ? a.x : a.y;
    const bCoord = axis === "x" ? b.x : b.y;
    const aVal = axis === "x" ? a.y : a.x;
    const bVal = axis === "x" ? b.y : b.x;
    const da = aCoord - coord;
    const db = bCoord - coord;

    if (Math.abs(da) < 1e-8 && Math.abs(db) < 1e-8) {
      values.push(aVal, bVal);
      continue;
    }
    if ((da <= 0 && db > 0) || (db <= 0 && da > 0)) {
      const t = (coord - aCoord) / (bCoord - aCoord || 1);
      values.push(aVal + (bVal - aVal) * t);
    }
  }
  values.sort((a, b) => a - b);

  const unique = [];
  for (const v of values) {
    if (!unique.length || Math.abs(v - unique[unique.length - 1]) > 1e-6) unique.push(v);
  }
  return unique;
}

function getBoundaryIntervals(boundaryPoints, axis, coord) {
  const values = getBoundaryIntersections(boundaryPoints, axis, coord);
  const intervals = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const min = values[i];
    const max = values[i + 1];
    if (Number.isFinite(min) && Number.isFinite(max) && max - min > 1e-5) intervals.push({ min, max });
  }
  return intervals;
}

function chooseBoundaryInterval(intervals, preferredCenter) {
  if (!Array.isArray(intervals) || !intervals.length) return null;
  let best = intervals[0];
  let bestScore = Infinity;
  for (const interval of intervals) {
    const contains = preferredCenter >= interval.min && preferredCenter <= interval.max;
    const center = (interval.min + interval.max) * 0.5;
    const gap = contains ? 0 : Math.min(Math.abs(preferredCenter - interval.min), Math.abs(preferredCenter - interval.max));
    const score = gap * 1000 + Math.abs(preferredCenter - center) - (interval.max - interval.min) * 0.001;
    if (score < bestScore) {
      bestScore = score;
      best = interval;
    }
  }
  return best;
}

function getBoundaryWallCoord(frame, alongCenter, fallbackCoord = frame?.wallCoord) {
  if (!frame?.boundaryPoints) return fallbackCoord;
  const axis = frame.axis === "x" ? "y" : "x";
  const values = getBoundaryIntersections(frame.boundaryPoints, axis, alongCenter);
  if (!values.length) return fallbackCoord;
  if (frame.wall === "west" || frame.wall === "south") return values[0];
  return values[values.length - 1];
}

function fitStepToPoolBoundary(frame, distanceFromWall, layout, runLength, wantedWidth) {
  if (!frame?.boundaryPoints || !layout) return null;
  const preferredCenter = Number(layout.centerY);
  const wanted = Math.max(0.05, Number(wantedWidth) || Number(layout.width) || 0.05);
  const run = Math.max(0.05, Number(runLength) || 0.05);
  if (!Number.isFinite(preferredCenter)) return null;

  const wallCoord = getBoundaryWallCoord(frame, preferredCenter, frame.wallCoord);
  if (!Number.isFinite(wallCoord)) return null;

  const sampleDistances = [
    Math.min(run, Math.max(0.02, run * 0.08)),
    Math.max(0.02, Math.min(run, Number(distanceFromWall) || run * 0.5)),
    Math.max(0.02, run * 0.98)
  ];

  let fitMin = -Infinity;
  let fitMax = Infinity;
  for (const d of sampleDistances) {
    const axisCoord = wallCoord + frame.inwardSign * d;
    const intervals = getBoundaryIntervals(frame.boundaryPoints, frame.axis, axisCoord);
    const chosen = chooseBoundaryInterval(intervals, preferredCenter);
    if (!chosen) continue;
    fitMin = Math.max(fitMin, chosen.min);
    fitMax = Math.min(fitMax, chosen.max);
  }

  if (!Number.isFinite(fitMin) || !Number.isFinite(fitMax) || fitMax - fitMin < 0.05) {
    const runCenter = wallCoord + frame.inwardSign * (Number(distanceFromWall) || run * 0.5);
    const intervals = getBoundaryIntervals(frame.boundaryPoints, frame.axis, runCenter);
    const chosen = chooseBoundaryInterval(intervals, preferredCenter);
    if (!chosen) return null;
    fitMin = chosen.min;
    fitMax = chosen.max;
  }

  const margin = 0.015;
  const available = Math.max(0.05, fitMax - fitMin - margin * 2);
  const width = Math.min(wanted, available);
  const centerMin = fitMin + margin + width * 0.5;
  const centerMax = fitMax - margin - width * 0.5;
  const centerY = centerMin <= centerMax
    ? THREE.MathUtils.clamp(preferredCenter, centerMin, centerMax)
    : (fitMin + fitMax) * 0.5;

  return { centerY, width };
}

function getStepFootprintFloorDepth(frame, distanceFromWall, alongCenter, runLength, spanWidth, floorDepthAt) {
  if (!frame || typeof floorDepthAt !== "function") return null;
  const runHalf = Math.max(0.025, (Number(runLength) || 0.05) * 0.5);
  const spanHalf = Math.max(0.025, (Number(spanWidth) || 0.05) * 0.5);
  const runCenter = frame.wallCoord + frame.inwardSign * distanceFromWall;
  const samples = [];

  if (frame.axis === "x") {
    const xs = [runCenter - runHalf, runCenter, runCenter + runHalf];
    const ys = [alongCenter - spanHalf, alongCenter, alongCenter + spanHalf];
    for (const x of xs) for (const y of ys) samples.push([x, y]);
  } else {
    const xs = [alongCenter - spanHalf, alongCenter, alongCenter + spanHalf];
    const ys = [runCenter - runHalf, runCenter, runCenter + runHalf];
    for (const x of xs) for (const y of ys) samples.push([x, y]);
  }

  let deepest = null;
  for (const [x, y] of samples) {
    const depth = Number(floorDepthAt(x, y));
    if (Number.isFinite(depth)) deepest = deepest === null ? depth : Math.max(deepest, depth);
  }
  return deepest;
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


export function createRectanglePool(params, tileSize = 0.3) {
  const {
    length,
    width,
    shallow,
    deep,
    shallowFlat,
    deepFlat,
    stepCount,
    stepDepth,
    stepWidth,
    stepPosition,
    stepShape
  } = params;

  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();

  const clampedShallow = Math.max(0.5, shallow);
  const clampedDeep = Math.max(clampedShallow, deep);

  group.userData.poolParams = {
    length,
    width,
    shallow,
    deep,
    shallowFlat,
    deepFlat,
    stepCount,
    stepDepth,
    stepWidth,
    stepPosition,
    stepShape
  };

  // Live-preview source params used by previewUpdateDepths()
  group.userData.params = { ...group.userData.poolParams };

  /* -------------------------------------------------------
     FLOOR
  ------------------------------------------------------- */
  const segmentsX = Math.max(2, Math.floor(length * 10));
  const segmentsY = Math.max(2, Math.floor(width * 10));
  const floorGeo = new THREE.PlaneGeometry(
    length,
    width,
    segmentsX,
    segmentsY
  );

  const pos = floorGeo.attributes.position;

  const axisStartWallX = -length / 2;
  const axisEndX = length / 2;

  const STEP_LENGTH = 0.3;
  const STEP_TOP_OFFSET = 0.25;

// Shared source of truth: how far the steps run into the pool
const stepFootprintLen = getStepFootprintLength(params, stepCount, STEP_LENGTH);
const floorStepWallFrame = getStepWallFrame({ ...params, stepWall: "west" }, -length / 2, length / 2, -width / 2, width / 2);

// Keep the floor transition locked to the original west/left entry axis.
// stepWall only controls where the stair meshes are placed.
const originCoord = floorStepWallFrame.wallCoord + floorStepWallFrame.inwardSign * stepFootprintLen;
const axisLen = floorStepWallFrame.axis === "x" ? length : width;
const originX = axisStartWallX + stepFootprintLen;

// Persist for downstream systems / debugging
group.userData.stepFootprintLen = stepFootprintLen;
group.userData.originX = originX;
group.userData.floorStepWall = floorStepWallFrame.wall;

  const fullLen = Math.max(0.01, axisLen - stepFootprintLen);

  let sFlat = shallowFlat || 0;
  let dFlat = deepFlat || 0;

  const maxFlats = Math.max(0, fullLen - 0.01);
  if (sFlat + dFlat > maxFlats) {
    const scale = maxFlats / (sFlat + dFlat);
    sFlat *= scale;
    dFlat *= scale;
  }

  const slopeLen = Math.max(0.01, fullLen - sFlat - dFlat);

  for (let i = 0; i < pos.count; i++) {
    const axisCoord = floorStepWallFrame.axis === "x" ? pos.getX(i) : pos.getY(i);
    let dx = floorStepWallFrame.inwardSign * (axisCoord - originCoord);
    if (dx < 0) dx = 0;

    let z;
    if (dx <= sFlat) {
      z = -clampedShallow;
    } else if (dx >= fullLen - dFlat) {
      z = -clampedDeep;
    } else {
      const t = (dx - sFlat) / slopeLen;
      z = -(clampedShallow + t * (clampedDeep - clampedShallow));
    }

    pos.setZ(i, z);
  }

  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(
    floorGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  floor.receiveShadow = true;
  floor.userData.isFloor = true;
floor.userData.type = "floor";

  group.add(floor);


  const getLockedFloorDepthAt = (worldX, worldY) => {
    const axisCoord = floorStepWallFrame.axis === "x" ? worldX : worldY;
    let dx = floorStepWallFrame.inwardSign * (axisCoord - originCoord);
    if (dx < 0) dx = 0;

    if (dx <= sFlat) return clampedShallow;
    if (dx >= fullLen - dFlat) return clampedDeep;
    const t = (dx - sFlat) / slopeLen;
    return clampedShallow + t * (clampedDeep - clampedShallow);
  };

  /* -------------------------------------------------------
     STEPS
  ------------------------------------------------------- */
  if (stepCount > 0) {
    const shallowDepth = clampedShallow;
    const stepWallFrame = getStepWallFrame(params, -length / 2, length / 2, -width / 2, width / 2);
    const narrowLayout = getStepLayout(params, stepWallFrame.spanMin, stepWallFrame.spanMax);
    const fullStepLayout = getStepLayout(params, stepWallFrame.spanMin, stepWallFrame.spanMax, { fullWidth: true });

    for (let s = 0; s < stepCount; s++) {
      const bench2Extension = getBench2Extension(params);
      const diagonalStepSize = getDiagonalStepSize(params, bench2Extension);
      const stepBenchMode = params?.stepBenchMode === "stepsOnly" ? "stepsOnly" : "bench";
      const wantsBenchSeat = stepBenchMode === "bench" && stepCount > 1;
      const baseLayout = wantsBenchSeat && s === 1 ? fullStepLayout : narrowLayout;
      const isCenteredCircular = params?.stepShape === "circular" && baseLayout.position === "center";
      const centeredCircularMode = stepBenchMode;
      const isBenchSeat = wantsBenchSeat && s === 1;
      const isCenterBenchSeat = isCenteredCircular && isBenchSeat;
      let layout = isBenchSeat ? { ...fullStepLayout, isBenchSeat: true } : baseLayout;
      const topDepth = Math.max(0, Math.min(shallowDepth - 0.05, STEP_TOP_OFFSET + stepDepth * s));
      let h = Math.max(0.05, shallowDepth - topDepth);

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


      const centeredCircularRadius = Math.max(0.05, Number(params?.stepExtension) || ((Number(params?.stepWidth) || STEP_PRESET_WIDTH) * 0.5));
      const centeredCircularStepCount = Math.max(1, centeredCircularMode === "bench" && stepCount > 1 ? stepCount - 1 : stepCount);
      const centeredCircularOrdinal = centeredCircularMode === "bench" && stepCount > 1
        ? (s < 1 ? s + 1 : s)
        : (s + 1);
      const centeredCircularRun = centeredCircularMode === "stepsOnly"
          ? centeredCircularRadius + STEP_TIER_OFFSET * s
          : centeredCircularRadius * (centeredCircularOrdinal / centeredCircularStepCount);
      const isDiagonalNarrow = (params?.stepShape === "diagonal" || params?.stepShape === "circular") && !isBenchSeat && layout.position !== "center";
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
          const customRun = getStepsOnlyStepRunOverride(params, s);
          if (customRun !== null) {
            stepRun = customRun;
            if (isDiagonalNarrow) stepWidthForGeo = customRun;
          }
        }
      const distanceFromWall = isCenteredCircular
        ? ((stepBenchMode === "bench" && stepCount > 1 && s > 1 ? bench2Extension : 0) + stepRun * 0.5)
        : (stepBenchMode === "stepsOnly"
            ? stepRun * 0.5
            : (s <= 1
                ? stepRun * 0.5
                : bench2Extension + ((s - 2) * stepRun) + stepRun * 0.5));

      const wallFit = fitStepToPoolBoundary(
        stepWallFrame,
        distanceFromWall,
        layout,
        stepRun,
        stepWidthForGeo
      );
      if (wallFit) {
        layout = { ...layout, centerY: wallFit.centerY, width: wallFit.width };
        stepWidthForGeo = wallFit.width;
      }

      const floorDepthAtStep = getStepFootprintFloorDepth(
        stepWallFrame,
        distanceFromWall,
        layout.centerY,
        stepRun,
        stepWidthForGeo,
        getLockedFloorDepthAt
      );
      if (Number.isFinite(floorDepthAtStep)) {
        h = Math.max(0.05, floorDepthAtStep - topDepth);
      }

      const geo = createStepGeometry(stepRun, stepWidthForGeo, h, params, layout);
      const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });

      const step = new THREE.Mesh(geo, mat);

      const z = -(topDepth + h * 0.5);

      placeStepOnWall(step, stepWallFrame, distanceFromWall, layout.centerY, z);
      step.userData.isStep = true;
      step.userData.stepIndex = s;
      step.userData.stepPosition = layout.position;
      step.userData.stepWall = stepWallFrame.wall;
      step.userData.stepShape = (["diagonal", "circular", "radius"].includes(params?.stepShape)) ? params.stepShape : "rectangle";
      step.userData.stepWidth = stepWidthForGeo;
      step.userData.baseHeight = h;
      step.userData.floorDepth = topDepth + h;
      step.userData.stepRun = stepRun;
      step.castShadow = true;
      step.receiveShadow = true;

      group.add(step);
    }

    addStepBenchMeshes(
      group,
      params,
      narrowLayout,
      -width / 2,
      width / 2,
      -length / 2,
      STEP_LENGTH,
      STEP_TOP_OFFSET,
      stepDepth
    );
  }

  /* -------------------------------------------------------
     WATER
  ------------------------------------------------------- */
  const waterGeo = floorGeo.clone();
  for (let i = 0; i < waterGeo.attributes.position.count; i++) {
    waterGeo.attributes.position.setZ(i, -0.1);
  }
  waterGeo.computeVertexNormals();

  const water = createPoolWater(length, width, waterGeo);
  water.receiveShadow = true;
  if (water.material) {
    water.material.depthWrite = false;
  }
  water.renderOrder = 1;
  group.add(water);

  /* -------------------------------------------------------
     WALLS
  ------------------------------------------------------- */
  const wallThickness = 0.2; // fixed wall thickness
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  });

  const walls = [
    new THREE.Mesh(
      new THREE.BoxGeometry(length, wallThickness, clampedDeep),
      wallMat.clone()
    ), // 0: south
    new THREE.Mesh(
      new THREE.BoxGeometry(length, wallThickness, clampedDeep),
      wallMat.clone()
    ), // 1: north
    new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, width, clampedDeep),
      wallMat.clone()
    ), // 2: east
    new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, width, clampedDeep),
      wallMat.clone()
    ) // 3: west
  ];

  // Top of walls is at z = 0 (center at -clampedDeep/2 with height clampedDeep)
  walls[0].position.set(0, -width / 2 - wallThickness / 2, -clampedDeep / 2); // south
  walls[1].position.set(0, width / 2 + wallThickness / 2, -clampedDeep / 2);  // north
  walls[2].position.set(length / 2 + wallThickness / 2, 0, -clampedDeep / 2); // east
  walls[3].position.set(-length / 2 - wallThickness / 2, 0, -clampedDeep / 2); // west

  const wallSides = ["south", "north", "east", "west"];
  const wallEdgeIndices = [0, 2, 1, 3];

  walls.forEach((w, idx) => {
    w.castShadow = true;
    w.receiveShadow = true;

    w.userData.isWall = true;
    w.userData.baseHeight = clampedDeep;
    w.userData.extraHeight = 0;
    w.userData.side = wallSides[idx];
    w.userData.copingKey = wallSides[idx];
    w.userData.edgeIndex = wallEdgeIndices[idx];

    group.add(w);
  });

  /* -------------------------------------------------------
     COPING – 4 SEPARATE SEGMENTS (one per wall)
     PBR Travertine from textures/Coping/
  ------------------------------------------------------- */
  const poolPts = [
    new THREE.Vector2(-length / 2, -width / 2),
    new THREE.Vector2(length / 2, -width / 2),
    new THREE.Vector2(length / 2, width / 2),
    new THREE.Vector2(-length / 2, width / 2)
  ];
  group.userData.outerPts = poolPts; // used by ground void etc.
  group.userData.spaSnapEdges = [
    {
      p0: poolPts[0].clone(),
      p1: poolPts[3].clone(),
      normal: new THREE.Vector2(1, 0)
    },
    {
      p0: poolPts[2].clone(),
      p1: poolPts[1].clone(),
      normal: new THREE.Vector2(-1, 0)
    },
    {
      p0: poolPts[1].clone(),
      p1: poolPts[0].clone(),
      normal: new THREE.Vector2(0, 1)
    },
    {
      p0: poolPts[3].clone(),
      p1: poolPts[2].clone(),
      normal: new THREE.Vector2(0, -1)
    }
  ];

  const copingOverhang = 0.05;  // inward overhang toward water
  const copingDepth = 0.05;     // vertical thickness of coping (match all pool shapes)
  const zOffset = 0.001;        // small lift to avoid z-fighting

  const halfL = length / 2;
  const halfW = width / 2;

  const outerHalfL = halfL + wallThickness;
  const outerHalfW = halfW + wallThickness;

  const longX = outerHalfL * 2;
  const longY = outerHalfW * 2;
  const short = wallThickness + copingOverhang;

  // PBR textures
  const baseColorMap = loader.load(
    "textures/Coping/TilesTravertine001_COL_4K.jpg"
  );
  const normalMap = loader.load(
    "textures/Coping/TilesTravertine001_NRM_4K.jpg"
  );
  const roughnessMap = loader.load(
    "textures/Coping/TilesTravertine001_GLOSS_4K.jpg"
  );
  const aoMap = loader.load(
    "textures/Coping/TilesTravertine001_AO_4K.jpg"
  );

  [baseColorMap, normalMap, roughnessMap, aoMap].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
  });

  function makeCopingMat() {
    return new THREE.MeshStandardMaterial({
      map: baseColorMap,
      normalMap,
      roughnessMap,
      aoMap,
      metalness: 0.0,
      roughness: 1.0
    });
  }

  function addUV2(geo) {
    if (geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute(
        "uv2",
        new THREE.BufferAttribute(geo.attributes.uv.array, 2)
      );
    }
  }

  // SOUTH coping segment
  const copingSouthGeo = new THREE.BoxGeometry(longX, short, copingDepth);
  addUV2(copingSouthGeo);
  const copingSouth = new THREE.Mesh(copingSouthGeo, makeCopingMat());
  copingSouth.position.set(
    0,
    -halfW - wallThickness / 2 + copingOverhang / 2,
    copingDepth / 2 + zOffset
  );
  copingSouth.castShadow = true;
  copingSouth.receiveShadow = true;
  copingSouth.userData.isCoping = true;
  copingSouth.userData.baseZ = copingSouth.position.z;
  copingSouth.userData.side = "south";
  group.add(copingSouth);

  // NORTH coping segment
  const copingNorthGeo = new THREE.BoxGeometry(longX, short, copingDepth);
  addUV2(copingNorthGeo);
  const copingNorth = new THREE.Mesh(copingNorthGeo, makeCopingMat());
  copingNorth.position.set(
    0,
    halfW + wallThickness / 2 - copingOverhang / 2,
    copingDepth / 2 + zOffset
  );
  copingNorth.castShadow = true;
  copingNorth.receiveShadow = true;
  copingNorth.userData.isCoping = true;
  copingNorth.userData.baseZ = copingNorth.position.z;
  copingNorth.userData.side = "north";
  group.add(copingNorth);

  // EAST coping segment
  const copingEastGeo = new THREE.BoxGeometry(short, longY, copingDepth);
  addUV2(copingEastGeo);
  const copingEast = new THREE.Mesh(copingEastGeo, makeCopingMat());
  copingEast.position.set(
    halfL + wallThickness / 2 - copingOverhang / 2,
    0,
    copingDepth / 2 + zOffset
  );
  copingEast.castShadow = true;
  copingEast.receiveShadow = true;
  copingEast.userData.isCoping = true;
  copingEast.userData.baseZ = copingEast.position.z;
  copingEast.userData.side = "east";
  group.add(copingEast);

  // WEST coping segment
  const copingWestGeo = new THREE.BoxGeometry(short, longY, copingDepth);
  addUV2(copingWestGeo);
  const copingWest = new THREE.Mesh(copingWestGeo, makeCopingMat());
  copingWest.position.set(
    -halfL - wallThickness / 2 + copingOverhang / 2,
    0,
    copingDepth / 2 + zOffset
  );
  copingWest.castShadow = true;
  copingWest.receiveShadow = true;
  copingWest.userData.isCoping = true;
  copingWest.userData.baseZ = copingWest.position.z;
  copingWest.userData.side = "west";
  group.add(copingWest);

  group.userData.copingSegments = {
    south: copingSouth,
    north: copingNorth,
    east: copingEast,
    west: copingWest
  };

  /* -------------------------------------------------------
     METADATA / ANIMATION
  ------------------------------------------------------- */
  const animatables = [];
  group.traverse((o) => {
    if (o.userData && typeof o.userData.animate === "function") {
      animatables.push(o);
    }
  });

  group.userData.floorMesh = floor;
  group.userData.waterMesh = water;
  group.userData.water = water;
  group.userData.wallMeshes = walls;
  group.userData.wallThickness = wallThickness;
  group.userData.animatables = animatables;

  return group;
}
