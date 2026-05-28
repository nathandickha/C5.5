// js/pool/shapes/kidneyPool.js
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

function applyStraightWallSpanFromBoundary(frame) {
  // Keep stair/bench spans on the actual selected wall face instead of the
  // overall pool bounding box. For rounded-corner pools this prevents the
  // bench from trying to run around the curved corner returns, which caused
  // twisted/wedge geometry. On fully curved shapes, keep the original span.
  if (!frame?.boundaryPoints) return frame;
  const spanMin = Number(frame.spanMin);
  const spanMax = Number(frame.spanMax);
  const wallCoord = Number(frame.wallCoord);
  if (!Number.isFinite(spanMin) || !Number.isFinite(spanMax) || !Number.isFinite(wallCoord) || spanMax <= spanMin) return frame;

  const samples = 96;
  const candidates = [];
  const spanLen = spanMax - spanMin;
  const tol = Math.max(0.08, spanLen * 0.012);

  for (let i = 0; i <= samples; i += 1) {
    const along = spanMin + spanLen * (i / samples);
    const coord = getBoundaryWallCoord(frame, along, NaN);
    if (!Number.isFinite(coord)) continue;
    const delta = Math.abs(coord - wallCoord);
    if (delta <= tol) candidates.push(along);
  }

  if (candidates.length < 4) return frame;
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < spanLen * 0.25) return frame;

  const inset = Math.min(0.03, (max - min) * 0.02);
  return { ...frame, spanMin: min + inset, spanMax: max - inset };
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


function makeStepExtrudedGeometry(pointsOrShape, height) {
  const shapePath = pointsOrShape instanceof THREE.Shape
    ? pointsOrShape
    : new THREE.Shape(pointsOrShape);
  const geo = new THREE.ExtrudeGeometry(shapePath, {
    depth: height,
    bevelEnabled: false,
    steps: 1
  });
  geo.translate(0, 0, -height * 0.5);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  if (geo.attributes.uv && !geo.attributes.uv2) {
    geo.setAttribute("uv2", geo.attributes.uv.clone());
  }
  return geo;
}

function createBoundaryClippedRectStepGeometry(runLength, stepWidth, height, layout) {
  const clip = layout?.boundaryClip;
  const frame = clip?.frame;
  if (!frame?.boundaryPoints) return null;

  const run = Math.max(0.05, Number(runLength) || 0.05);
  const width = Math.max(0.05, Number(stepWidth) || 0.05);
  const distanceFromWall = Math.max(0.025, Number(clip.distanceFromWall) || run * 0.5);
  const alongCenter = Number(clip.alongCenter);
  if (!Number.isFinite(alongCenter)) return null;

  const centerWallCoord = getBoundaryWallCoord(frame, alongCenter, frame.wallCoord);
  if (!Number.isFinite(centerWallCoord)) return null;
  const runCenter = centerWallCoord + frame.inwardSign * distanceFromWall;

  const sampleCount = Math.max(8, Math.min(64, Math.ceil(width / 0.12)));
  const backPts = [];
  const frontPts = [];
  const insideMargin = 0.012;

  for (let i = 0; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const localY = -width * 0.5 + width * t;
    const along = alongCenter + localY;
    const wallCoord = getBoundaryWallCoord(frame, along, NaN);
    if (!Number.isFinite(wallCoord)) continue;

    // Convert the real pool wall coordinate into the step mesh's local X axis.
    // This makes the wall-side edge of the step follow curved/irregular walls
    // instead of staying on the old rectangular bounding-box chord.
    let localBackX = (wallCoord - runCenter) * frame.inwardSign + insideMargin;
    let localFrontX = localBackX + run;

    // Check the front point remains in the same interior interval. If the pool
    // pinches in sharply, pull the front edge back instead of letting it pass
    // through the wall.
    const frontAxisCoord = runCenter + frame.inwardSign * localFrontX;
    const intervals = getBoundaryIntervals(frame.boundaryPoints, frame.axis, frontAxisCoord);
    const chosen = chooseBoundaryInterval(intervals, along);
    if (!chosen || along < chosen.min - 1e-5 || along > chosen.max + 1e-5) {
      const midAxisCoord = runCenter + frame.inwardSign * (localBackX + run * 0.5);
      const midIntervals = getBoundaryIntervals(frame.boundaryPoints, frame.axis, midAxisCoord);
      const midChosen = chooseBoundaryInterval(midIntervals, along);
      if (!midChosen || along < midChosen.min - 1e-5 || along > midChosen.max + 1e-5) continue;
      localFrontX = localBackX + run * 0.5;
    }

    if (localFrontX - localBackX < 0.04) continue;
    backPts.push(new THREE.Vector2(localBackX, localY));
    frontPts.push(new THREE.Vector2(localFrontX, localY));
  }

  if (backPts.length < 2 || frontPts.length < 2) return null;
  const points = [...backPts, ...frontPts.reverse()];
  if (points.length < 3) return null;
  return makeStepExtrudedGeometry(new THREE.Shape(points), height);
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
  const clippedRectGeo = createBoundaryClippedRectStepGeometry(runLength, stepWidth, height, layout);
  if (clippedRectGeo) return clippedRectGeo;

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

/* -------------------------------------------------------
   UV GENERATOR
------------------------------------------------------- */
function generateUVsForShapeGeometry(geo) {
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const bbox = geo.boundingBox;

  const minX = bbox.min.x;
  const minY = bbox.min.y;
  const sizeX = Math.max(1e-6, bbox.max.x - bbox.min.x);
  const sizeY = Math.max(1e-6, bbox.max.y - bbox.min.y);

  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uvs[i * 2] = (x - minX) / sizeX;
    uvs[i * 2 + 1] = (y - minY) / sizeY;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

/* -------------------------------------------------------
   CHAIKIN SMOOTHING
------------------------------------------------------- */
function chaikinSmooth(points, iterations = 2) {
  let pts = points.map((p) => p.clone());

  for (let it = 0; it < iterations; it++) {
    const newPts = [];
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % n];

      newPts.push(
        new THREE.Vector2(0.75 * p0.x + 0.25 * p1.x, 0.75 * p0.y + 0.25 * p1.y),
        new THREE.Vector2(0.25 * p0.x + 0.75 * p1.x, 0.25 * p0.y + 0.75 * p1.y)
      );
    }
    pts = newPts;
  }

  return pts;
}

/* -------------------------------------------------------
   KIDNEY OUTLINE
------------------------------------------------------- */
function generateKidneyOutline(L, W, params) {
  const leftR = THREE.MathUtils.clamp((params.kidneyLeftRadius ?? 2.0) / W, 0.02, 4.0);
  const rightR = THREE.MathUtils.clamp((params.kidneyRightRadius ?? 3.0) / W, 0.02, 5.0);
  const neck = THREE.MathUtils.clamp((params.kidneyOffset ?? 1.0) / L, 0.0, 2.0);

  const leftInfl = (leftR - 0.33) * 0.4;
  const rightInfl = (rightR - 0.5) * 0.4;
  const neckInfl = (neck - 0.45) * 0.5;

  const base = [
    new THREE.Vector2(-1.05, 0.25),
    new THREE.Vector2(-0.35, 0.52),
    new THREE.Vector2(0.55, 0.55),
    new THREE.Vector2(1.05, 0.3),
    new THREE.Vector2(1.1, 0.0),
    new THREE.Vector2(0.8, -0.38),
    new THREE.Vector2(0.35, -0.48),
    new THREE.Vector2(-0.1, -0.4),
    new THREE.Vector2(-0.85, -0.3),
    new THREE.Vector2(-1.1, -0.05)
  ];

  const adjusted = base.map((p, idx) => {
    const v = p.clone();
    if ([0, 1, 8, 9].includes(idx)) {
      v.x *= 1.0 + leftInfl * 0.6;
      v.y *= 1.0 + leftInfl * 0.4;
    }
    if ([2, 3, 4, 5, 6].includes(idx)) {
      v.x *= 1.0 + rightInfl * 0.7;
      v.y *= 1.0 + rightInfl * 0.4;
    }
    if (idx === 7) {
      v.y = -0.4 + -0.35 * neckInfl;
      v.x += neckInfl * 0.35;
    }
    return v;
  });

  const smoothed = chaikinSmooth(adjusted, 2);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  smoothed.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const sx = L / (maxX - minX || 1);
  const sy = W / (maxY - minY || 1);

  smoothed.forEach(p => {
    p.x = (p.x - cx) * sx;
    p.y = (p.y - cy) * sy;
  });

  return smoothed;
}

/* -------------------------------------------------------
   MAIN BUILDER
------------------------------------------------------- */
export function createKidneyPool(params, tileSize = 0.3) {
  const {
    length: L,
    width: W,
    shallow,
    deep,
    shallowFlat,
    deepFlat,
    stepCount,
    stepDepth
  } = params;

  const STEP_LENGTH = 0.3;
  const STEP_TOP_OFFSET = 0.25;

  const group = new THREE.Group();
  group.userData.poolParams = { ...params };
  group.userData.params = { ...group.userData.poolParams };

  const shallowZ = Math.max(0.5, shallow);
  const deepZ = Math.max(shallowZ, deep);

  /* -------------------------------------------------------
     OUTLINE
  ------------------------------------------------------- */
  const outline = generateKidneyOutline(L, W, params);
  const shape = new THREE.Shape(outline);
  // -------------------------------------------------------
  // OUTLINE EXTENTS (for bbox-based floor + steps)
  // -------------------------------------------------------
  let minXOutline = Infinity;
  let maxXOutline = -Infinity;
  let minYOutline = Infinity;
  let maxYOutline = -Infinity;

  for (const p of outline) {
    if (p.x < minXOutline) minXOutline = p.x;
    if (p.x > maxXOutline) maxXOutline = p.x;
    if (p.y < minYOutline) minYOutline = p.y;
    if (p.y > maxYOutline) maxYOutline = p.y;
  }



  /* -------------------------------------------------------
     FLOOR  (BBOX-RECTANGLE PLANE)
  ------------------------------------------------------- */
  const bb2 = new THREE.Box2();
  for (const p of outline) bb2.expandByPoint(p);

  const wallMinX = bb2.min.x;
  const wallMaxX = bb2.max.x;
  const wallMinY = bb2.min.y;
  const wallMaxY = bb2.max.y;

  const bbLen = Math.max(0.01, wallMaxX - wallMinX);
  const bbWid = Math.max(0.01, wallMaxY - wallMinY);
  const cx = (wallMinX + wallMaxX) * 0.5;
  const cy = (wallMinY + wallMaxY) * 0.5;

  const segX = Math.max(2, Math.min(260, Math.ceil(bbLen / tileSize)));
  const segY = Math.max(2, Math.min(260, Math.ceil(bbWid / tileSize)));

  const floorGeo = new THREE.PlaneGeometry(bbLen, bbWid, segX, segY);
  const pos = floorGeo.attributes.position;

  const stepFootprintLen = stepCount > 0 ? getStepFootprintLength(params, stepCount, STEP_LENGTH) : 0;
  const floorStepWallFrame = getStepWallFrame({ ...params, stepWall: "west" }, wallMinX, wallMaxX, wallMinY, wallMaxY);
  const originCoord = floorStepWallFrame.wallCoord + floorStepWallFrame.inwardSign * stepFootprintLen;
  let originX = wallMinX;
  if (stepCount > 0 && floorStepWallFrame.axis === "x" && floorStepWallFrame.inwardSign > 0) originX = wallMinX + stepFootprintLen;

  const axisLen = floorStepWallFrame.axis === "x" ? (wallMaxX - wallMinX) : (wallMaxY - wallMinY);
  const fullLen = Math.max(0.01, axisLen - stepFootprintLen);
  group.userData.stepFootprintLen = stepFootprintLen;
  group.userData.originX = originX;
  group.userData.stepWall = floorStepWallFrame.wall;

  let sFlat = shallowFlat || 0;
  let dFlat = deepFlat || 0;

  const maxFlats = Math.max(0, fullLen - 0.1);
  if (sFlat + dFlat > maxFlats) {
    const scale = maxFlats / (sFlat + dFlat);
    sFlat *= scale;
    dFlat *= scale;
  }

  const slopeLen = Math.max(0.01, fullLen - sFlat - dFlat);

  for (let i = 0; i < pos.count; i++) {
    const worldX = pos.getX(i) + cx;
    const worldY = pos.getY(i) + cy;
    const axisCoord = floorStepWallFrame.axis === "x" ? worldX : worldY;

    let dx = floorStepWallFrame.inwardSign * (axisCoord - originCoord);
    if (dx < 0) dx = 0;

    let z;
    if (dx <= sFlat) z = -shallowZ;
    else if (dx >= fullLen - dFlat) z = -deepZ;
    else {
      const t = (dx - sFlat) / slopeLen;
      z = -(shallowZ + t * (deepZ - shallowZ));
    }

    pos.setZ(i, z);
  }

  pos.needsUpdate = true;
  floorGeo.computeVertexNormals();

  const floor = new THREE.Mesh(
    floorGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  floor.receiveShadow = true;
  floor.position.set(cx, cy, 0);
  floor.userData.isFloor = true;
  floor.userData.type = "floor";
  group.add(floor);


  const getLockedFloorDepthAt = (worldX, worldY) => {
    const axisCoord = floorStepWallFrame.axis === "x" ? worldX : worldY;
    let dx = floorStepWallFrame.inwardSign * (axisCoord - originCoord);
    if (dx < 0) dx = 0;

    if (dx <= sFlat) return shallowZ;
    if (dx >= fullLen - dFlat) return deepZ;
    const t = (dx - sFlat) / slopeLen;
    return shallowZ + t * (deepZ - shallowZ);
  };

  /* -------------------------------------------------------
     STEPS (RESTORED)
  ------------------------------------------------------- */
  if (stepCount > 0) {
    const stepWallFrame = getStepWallFrame(params, wallMinX, wallMaxX, wallMinY, wallMaxY);
    stepWallFrame.boundaryPoints = outline;
    Object.assign(stepWallFrame, applyStraightWallSpanFromBoundary(stepWallFrame));
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
      const topDepth = Math.max(0, Math.min(shallowZ - 0.05, STEP_TOP_OFFSET + stepDepth * s));
      let h = Math.max(0.05, shallowZ - topDepth);

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

      // Keep the full-width bench spanning the selected wall.
      // Do not fit/shrink it to the narrowest chord of a curved wall.
      if (!isBenchSeat) {
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
      }

      const floorDepthAtStep = getStepFootprintFloorDepth(
        stepWallFrame,
        distanceFromWall,
        layout.centerY,
        stepRun,
        stepWidthForGeo,
        getLockedFloorDepthAt
      );
      if (Number.isFinite(floorDepthAtStep) && floorDepthAtStep > topDepth + 0.05) {
        h = Math.max(0.05, floorDepthAtStep - topDepth);
      }

      const geo = createStepGeometry(stepRun, stepWidthForGeo, h, params, layout);
      const step = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));

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
      step.userData.minXStep = minXOutline;

      step.castShadow = true;
      step.receiveShadow = true;
      group.add(step);
    }

    addStepBenchMeshes(
      group,
      params,
      narrowLayout,
      wallMinY,
      wallMaxY,
      wallMinX,
      STEP_LENGTH,
      STEP_TOP_OFFSET,
      stepDepth
    );
  }

  /* -------------------------------------------------------
     WATER
  ------------------------------------------------------- */
  const water = createPoolWater(L, W);
  const waterGeo = new THREE.ShapeGeometry(shape, 96);
  generateUVsForShapeGeometry(waterGeo);
  water.geometry = waterGeo;
  water.position.z = -0.10;
  water.renderOrder = 1;
  if (water.material) water.material.depthWrite = false;
  group.add(water);

  /* -------------------------------------------------------
     WALLS (CONTINUOUS)
  ------------------------------------------------------- */
  const wallThickness = 0.2;
  const pts2D = outline.map(p => new THREE.Vector2(p.x, p.y));

  function polygonSignedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a * 0.5;
  }

  function outwardNormals(pts) {
    const ccw = polygonSignedArea(pts) > 0;
    return pts.map((p, i) => {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p2 = pts[(i + 1) % pts.length];
      const e0 = p.clone().sub(p0);
      const e1 = p2.clone().sub(p);
      const n0 = ccw ? new THREE.Vector2(e0.y, -e0.x) : new THREE.Vector2(-e0.y, e0.x);
      const n1 = ccw ? new THREE.Vector2(e1.y, -e1.x) : new THREE.Vector2(-e1.y, e1.x);
      n0.normalize(); n1.normalize();
      return n0.add(n1).normalize();
    });
  }

  const normals = outwardNormals(pts2D);
  const outerPts = pts2D.map((p, i) =>
    p.clone().add(normals[i].clone().multiplyScalar(wallThickness))
  );

  const wallShape = new THREE.Shape(outerPts);
  wallShape.holes.push(new THREE.Path(pts2D.slice().reverse()));

  const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
    depth: deepZ,
    bevelEnabled: false,
    curveSegments: 96
  });

  wallGeo.translate(0, 0, -deepZ * 0.5);
  wallGeo.computeVertexNormals();

  const wallMesh = new THREE.Mesh(
    wallGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );

  wallMesh.position.z = -deepZ * 0.5;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.userData.isWall = true;
  wallMesh.userData.baseHeight = deepZ;
  wallMesh.userData.currentHeight = deepZ;
  wallMesh.userData.extraHeight = 0;

  group.add(wallMesh);

  /* -------------------------------------------------------
     COPING
  ------------------------------------------------------- */
  const copingOverhang = 0.05;
  const copingDepth = 0.05;
  const zOffset = 0.001;

  const innerPts = pts2D.map((p, i) =>
    p.clone().add(normals[i].clone().multiplyScalar(-copingOverhang))
  );

  const copingShape = new THREE.Shape(outerPts);
  copingShape.holes.push(new THREE.Path(innerPts.slice().reverse()));

  const copingGeo = new THREE.ExtrudeGeometry(copingShape, {
    depth: copingDepth,
    bevelEnabled: false,
    curveSegments: 48
  });

  const tex = new THREE.TextureLoader().load(
    "textures/Coping/TilesTravertine001_COL_4K.jpg"
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);

  const copingMesh = new THREE.Mesh(
    copingGeo,
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide
    })
  );

  copingMesh.position.z = zOffset;
  copingMesh.renderOrder = 3;
  copingMesh.userData.isCoping = true;
  group.add(copingMesh);

  /* -------------------------------------------------------
     USERDATA (RESTORED)
  ------------------------------------------------------- */
  group.userData.wallMeshes = [wallMesh];
  group.userData.wallThickness = wallThickness;
  group.userData.floorMesh = floor;
  group.userData.water = water;
  group.userData.waterMesh = water;
  group.userData.copingMesh = copingMesh;
  group.userData.outerPts = outline;
  group.userData.spaSnapEdges = buildSpaSnapEdgesFromPoints(outline);

  if (water.userData?.animate) {
    group.userData.animatables = [water];
  }

  if (water.userData?.triggerRipple) {
    group.userData.triggerRipple = water.userData.triggerRipple;
  }

  return group;
}
