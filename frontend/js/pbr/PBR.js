import * as THREE from "https://esm.sh/three@0.158.0";
import { spas } from "../pool/spa.js";

const TILE_SURFACE_SETTINGS = {
  floor: {
    roughness: 0.38,
    normalScale: 0.62,
    displacementScale: 0.0022,
    envMapIntensity: 0.84,
    clearcoat: 0.24,
    clearcoatRoughness: 0.28
  },
  wall: {
    roughness: 0.36,
    normalScale: 0.72,
    displacementScale: 0.0,
    envMapIntensity: 0.92,
    clearcoat: 0.3,
    clearcoatRoughness: 0.26
  },
  step: {
    roughness: 0.38,
    normalScale: 0.66,
    displacementScale: 0.0012,
    envMapIntensity: 0.86,
    clearcoat: 0.24,
    clearcoatRoughness: 0.3
  },
  spa: {
    roughness: 0.36,
    normalScale: 0.7,
    displacementScale: 0.0,
    envMapIntensity: 0.92,
    clearcoat: 0.3,
    clearcoatRoughness: 0.26
  },
  default: {
    roughness: 0.39,
    normalScale: 0.62,
    displacementScale: 0.0,
    envMapIntensity: 0.84,
    clearcoat: 0.22,
    clearcoatRoughness: 0.3
  }
};

const TILE_UV_STAGE2_PROFILES = {
  // Pool geometry UVs are meter-scaled using a 0.30 m texture span.
  // Each texture contains a 6 x 6 tile sheet, so repeat 1.0 gives a
  // true 50 mm module: 48 mm coloured tile face + 2 mm grout line.
  floor: { repeat: 1.0, groutBoost: 1.0 },
  wall: { repeat: 1.0, groutBoost: 1.08 },
  step: { repeat: 1.0, groutBoost: 1.02 },
  spa: { repeat: 1.0, groutBoost: 1.08 },
  default: { repeat: 1.0, groutBoost: 1.0 }
};


const TILE_LIBRARY_OPTIONS = [
  { key: "blue", label: "Blue", folder: "blue", colorA: "#1497c2", colorB: "#0a80ae", grout: "#8abec6" },
  { key: "white", label: "White", folder: "white", colorA: "#f6f7f2", colorB: "#dde3dc", grout: "#a4aaaa" },
  { key: "Antique Opal", label: "Antique Opal", folder: "Antique Opal", colorA: "#6b9a98", colorB: "#355f63", grout: "#a7c9c4" },
  { key: "Aqua Glass", label: "Aqua Glass", folder: "Aqua Glass", colorA: "#55c2d3", colorB: "#249aaa", grout: "#c8eef1" },
  { key: "Arctic Blue", label: "Arctic Blue", folder: "Arctic Blue", colorA: "#c8edf3", colorB: "#83ccd8", grout: "#7daeb7" },
  { key: "Cobalt Blue", label: "Cobalt Blue", folder: "Cobalt Blue", colorA: "#125e9f", colorB: "#0a4380", grout: "#83b8d7" },
  { key: "Deep Ocean", label: "Deep Ocean", folder: "Deep Ocean", colorA: "#06445f", colorB: "#032a3c", grout: "#5f9cad" },
  { key: "Lagoon", label: "Lagoon", folder: "Lagoon", colorA: "#15a7b0", colorB: "#087d88", grout: "#a3dfe2" },
  { key: "Turquoise", label: "Turquoise", folder: "Turquoise", colorA: "#21b7a8", colorB: "#0b8b83", grout: "#b6e6df" },
  { key: "Emerald", label: "Emerald", folder: "Emerald", colorA: "#0b8c6e", colorB: "#04634f", grout: "#8bc9b8" },
  { key: "Seafoam", label: "Seafoam", folder: "Seafoam", colorA: "#a9d8ce", colorB: "#6bb6a9", grout: "#6b948d" },
  { key: "Pearl", label: "Pearl", folder: "Pearl", colorA: "#f0eee4", colorB: "#d6d2c4", grout: "#9e9a90" },
  { key: "Silver Grey", label: "Silver Grey", folder: "Silver Grey", colorA: "#bfc6c8", colorB: "#8f9a9d", grout: "#646d70" },
  { key: "Graphite", label: "Graphite", folder: "Graphite", colorA: "#3b4448", colorB: "#1e2528", grout: "#7b8588" },
  { key: "Midnight", label: "Midnight", folder: "Midnight", colorA: "#061b2f", colorB: "#020a14", grout: "#496b83" },
  { key: "Sandstone", label: "Sandstone", folder: "Sandstone", colorA: "#d1b98f", colorB: "#ac8f62", grout: "#8f7d62" },
  { key: "Travertine", label: "Travertine", folder: "Travertine", colorA: "#cdb48d", colorB: "#a98f68", grout: "#88745b" },
  { key: "Jade", label: "Jade", folder: "Jade", colorA: "#4fa98d", colorB: "#2f8069", grout: "#a6d3c4" },
  { key: "Opal Blue", label: "Opal Blue", folder: "Opal Blue", colorA: "#8dc9d6", colorB: "#559eaf", grout: "#d2edf0" }
];

const TILE_LIBRARY_BY_KEY = Object.fromEntries(TILE_LIBRARY_OPTIONS.map((tile) => [tile.key, tile]));

function encodePathSegmentPath(path = "") {
  return String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

// A 6 x 6 sheet over 0.30 m means each mosaic module is 50 mm.
// TILE_GROUT_WIDTH is half the grout line in cell units; 0.02 on each side
// of the seam produces a total 0.04-cell gap = 2 mm grout between 48 mm faces.
const TILE_SOURCE_GRID = 6;
const TILE_GROUT_WIDTH = 0.02;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function seededTileVariation(ix, iy, seed = 0) {
  const n = Math.sin((ix * 127.1 + iy * 311.7 + seed * 43.3)) * 43758.5453;
  return n - Math.floor(n);
}


function hexToRgb(hex, fallback = [40, 120, 150]) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length !== 6) return fallback;
  const n = parseInt(clean, 16);
  if (!Number.isFinite(n)) return fallback;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function makeProceduralTileCanvas(tileKey = "blue", size = 512) {
  if (typeof document === "undefined") return null;
  const tile = TILE_LIBRARY_BY_KEY[tileKey] || TILE_LIBRARY_OPTIONS[0];
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const a = hexToRgb(tile.colorA);
  const b = hexToRgb(tile.colorB, a);
  const grout = hexToRgb(tile.grout, [150, 165, 170]);
  const tiles = 6;
  const cell = size / tiles;
  // Keep generated previews/fallback textures at 48 mm colour + 2 mm grout.
  // The gap is half the grout line on each side of a tile face.
  const gap = Math.max(1, Math.round(cell * 0.02));
  const seed = String(tileKey).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  ctx.fillStyle = `rgb(${grout[0]},${grout[1]},${grout[2]})`;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const rnd = seededTileVariation(x, y, seed);
      const rgb = mixRgb(a, b, rnd * 0.85);
      const x0 = Math.round(x * cell + gap);
      const y0 = Math.round(y * cell + gap);
      const w = Math.round(cell - gap * 2);
      const h = Math.round(cell - gap * 2);

      const grad = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
      const hi = mixRgb(rgb, [255, 255, 255], 0.08 + rnd * 0.06);
      const lo = mixRgb(rgb, [0, 0, 0], 0.08 + (1 - rnd) * 0.04);
      grad.addColorStop(0, `rgb(${hi[0]},${hi[1]},${hi[2]})`);
      grad.addColorStop(1, `rgb(${lo[0]},${lo[1]},${lo[2]})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, w, h);
    }
  }

  return canvas;
}

function createProceduralTileTexture(tileKey = "blue") {
  const canvas = makeProceduralTileCanvas(tileKey, 512);
  if (!canvas) return null;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 12;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createTilePreviewDataUrl(tileKey = "blue") {
  const canvas = makeProceduralTileCanvas(tileKey, 192);
  return canvas ? canvas.toDataURL("image/jpeg", 0.88) : "";
}

function cloneTextureForSurface(tex, profile) {
  if (!tex) return null;
  const cloned = tex.clone();
  const repeat = Number.isFinite(profile?.repeat) ? profile.repeat : 1;
  cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
  cloned.repeat.set(repeat, repeat);
  cloned.needsUpdate = true;
  return cloned;
}

function createStage2BaseColorTexture(sourceTex, tileKey = "tile") {
  const image = sourceTex?.image;
  const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!image || !width || !height || typeof document === "undefined") return sourceTex;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return sourceTex;

    ctx.drawImage(image, 0, 0, width, height);
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    const seed = String(tileKey).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

    // Work out whether the selected tile is a light tile set.
    // The previous Stage 2 pass treated most low-saturation/light pixels as grout,
    // which made the white tile render as a flat grey sheet. This samples the
    // texture first, then only draws grout on the actual grid lines.
    let lumaSum = 0;
    let sampleCount = 0;
    const stride = Math.max(1, Math.floor((width * height) / 6000));
    for (let i = 0; i < data.length; i += 4 * stride) {
      lumaSum += (data[i] / 255) * 0.2126 + (data[i + 1] / 255) * 0.7152 + (data[i + 2] / 255) * 0.0722;
      sampleCount++;
    }
    const averageLuma = sampleCount ? lumaSum / sampleCount : 0.5;
    const isLightTile = averageLuma > 0.55;
    const groutValue = isLightTile ? 0.42 : 0.82;
    const groutMix = isLightTile ? 0.72 : 0.58;
    const variationStrength = isLightTile ? 0.026 : 0.075;
    const microStrength = isLightTile ? 0.008 : 0.016;
    const contrast = isLightTile ? 1.018 : 1.04;

    for (let y = 0; y < height; y++) {
      const gy = (y / height) * TILE_SOURCE_GRID;
      const fy = gy - Math.floor(gy);
      const iy = Math.floor(gy);
      const horizontalDist = Math.min(fy, 1 - fy);
      const nearHorizontalGrout = horizontalDist < TILE_GROUT_WIDTH;

      for (let x = 0; x < width; x++) {
        const gx = (x / width) * TILE_SOURCE_GRID;
        const fx = gx - Math.floor(gx);
        const ix = Math.floor(gx);
        const verticalDist = Math.min(fx, 1 - fx);
        const nearVerticalGrout = verticalDist < TILE_GROUT_WIDTH;
        const idx = (y * width + x) * 4;

        let r = data[idx] / 255;
        let g = data[idx + 1] / 255;
        let b = data[idx + 2] / 255;

        if (nearVerticalGrout || nearHorizontalGrout) {
          const lineStrength = Math.max(
            nearVerticalGrout ? 1 - verticalDist / TILE_GROUT_WIDTH : 0,
            nearHorizontalGrout ? 1 - horizontalDist / TILE_GROUT_WIDTH : 0
          );
          const mix = groutMix * Math.pow(lineStrength, 0.72);
          r = r * (1 - mix) + groutValue * mix;
          g = g * (1 - mix) + groutValue * mix;
          b = b * (1 - mix) + groutValue * mix;
        } else {
          const variation = (seededTileVariation(ix, iy, seed) - 0.5) * variationStrength;
          const micro = (seededTileVariation(x >> 4, y >> 4, seed + 7) - 0.5) * microStrength;
          r = clamp01((r - 0.5) * contrast + 0.5 + variation + micro);
          g = clamp01((g - 0.5) * contrast + 0.5 + variation + micro);
          b = clamp01((b - 0.5) * contrast + 0.5 + variation + micro);
        }

        data[idx] = Math.round(clamp01(r) * 255);
        data[idx + 1] = Math.round(clamp01(g) * 255);
        data[idx + 2] = Math.round(clamp01(b) * 255);
      }
    }

    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = sourceTex.anisotropy || 12;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { ...(sourceTex.userData || {}), isStage2EnhancedTileBaseColor: true };
    return tex;
  } catch (err) {
    console.warn("Stage 2 tile enhancement skipped for", tileKey, err);
    return sourceTex;
  }
}

function createStage3SupportTextureSet(baseTex, tileKey = "tile") {
  const image = baseTex?.image;
  const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!image || !width || !height || typeof document === "undefined") return null;

  try {
    const seed = String(tileKey).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

    const roughCanvas = document.createElement("canvas");
    const normalCanvas = document.createElement("canvas");
    const aoCanvas = document.createElement("canvas");
    const dispCanvas = document.createElement("canvas");
    roughCanvas.width = normalCanvas.width = aoCanvas.width = dispCanvas.width = width;
    roughCanvas.height = normalCanvas.height = aoCanvas.height = dispCanvas.height = height;

    const roughCtx = roughCanvas.getContext("2d", { willReadFrequently: true });
    const normalCtx = normalCanvas.getContext("2d", { willReadFrequently: true });
    const aoCtx = aoCanvas.getContext("2d", { willReadFrequently: true });
    const dispCtx = dispCanvas.getContext("2d", { willReadFrequently: true });
    if (!roughCtx || !normalCtx || !aoCtx || !dispCtx) return null;

    const roughImg = roughCtx.createImageData(width, height);
    const normalImg = normalCtx.createImageData(width, height);
    const aoImg = aoCtx.createImageData(width, height);
    const dispImg = dispCtx.createImageData(width, height);

    // The base tile photos are 6 x 6 mosaics. This height-field adds a real
    // recessed grout bevel while keeping each tile face mostly flat/glazed.
    const groutWidth = TILE_GROUT_WIDTH;
    const bevelWidth = groutWidth * 1.9;

    for (let y = 0; y < height; y++) {
      const gy = (y / height) * TILE_SOURCE_GRID;
      const fy = gy - Math.floor(gy);
      const iy = Math.floor(gy);
      const distY = Math.min(fy, 1 - fy);

      for (let x = 0; x < width; x++) {
        const gx = (x / width) * TILE_SOURCE_GRID;
        const fx = gx - Math.floor(gx);
        const ix = Math.floor(gx);
        const distX = Math.min(fx, 1 - fx);
        const distToGrout = Math.min(distX, distY);
        const groutCore = distToGrout < groutWidth;
        const bevel = clamp01(1 - (distToGrout - groutWidth) / Math.max(0.0001, bevelWidth - groutWidth));
        const groutMask = groutCore ? 1 : Math.pow(bevel, 1.4);
        const faceMask = 1 - groutMask;
        const tileRand = seededTileVariation(ix, iy, seed);
        const micro = seededTileVariation(x >> 4, y >> 4, seed + 19);

        const idx = (y * width + x) * 4;

        // Roughness: glossy tile face, rougher grout. This makes the grout stop
        // reflecting like glass and helps tile faces catch highlights.
        const faceRough = 0.28 + tileRand * 0.08 + (micro - 0.5) * 0.025;
        const groutRough = 0.76 + (micro - 0.5) * 0.04;
        const rough = clamp01(faceRough * faceMask + groutRough * groutMask);
        roughImg.data[idx] = roughImg.data[idx + 1] = roughImg.data[idx + 2] = Math.round(rough * 255);
        roughImg.data[idx + 3] = 255;

        // AO: subtle contact darkness inside grout grooves.
        const ao = clamp01(0.98 - groutMask * 0.28 - (groutCore ? 0.08 : 0));
        aoImg.data[idx] = aoImg.data[idx + 1] = aoImg.data[idx + 2] = Math.round(ao * 255);
        aoImg.data[idx + 3] = 255;

        // Displacement/height: white = tile face high, dark = recessed grout.
        const heightVal = clamp01(0.72 + faceMask * 0.22 - groutMask * 0.32 + (tileRand - 0.5) * 0.012);
        dispImg.data[idx] = dispImg.data[idx + 1] = dispImg.data[idx + 2] = Math.round(heightVal * 255);
        dispImg.data[idx + 3] = 255;

        // Normal: approximate beveled groove normal from distance-to-grout. The
        // center stays neutral, bevel edges lean away from the groove.
        let nx = 0;
        let ny = 0;
        if (distX < bevelWidth) nx = fx < 0.5 ? -1 : 1;
        if (distY < bevelWidth) ny = fy < 0.5 ? -1 : 1;
        const edgeStrength = clamp01(groutMask * 0.56 + (groutCore ? 0.08 : 0));
        const len = Math.sqrt((nx * edgeStrength) ** 2 + (ny * edgeStrength) ** 2 + 1);
        const nnx = (nx * edgeStrength) / len;
        const nny = (ny * edgeStrength) / len;
        const nnz = 1 / len;
        normalImg.data[idx] = Math.round((nnx * 0.5 + 0.5) * 255);
        normalImg.data[idx + 1] = Math.round((nny * 0.5 + 0.5) * 255);
        normalImg.data[idx + 2] = Math.round((nnz * 0.5 + 0.5) * 255);
        normalImg.data[idx + 3] = 255;
      }
    }

    roughCtx.putImageData(roughImg, 0, 0);
    normalCtx.putImageData(normalImg, 0, 0);
    aoCtx.putImageData(aoImg, 0, 0);
    dispCtx.putImageData(dispImg, 0, 0);

    const makeLinear = (canvas, tag) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 12;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.userData = { isStage3ProceduralTileMap: true, stage3MapType: tag };
      return tex;
    };

    return {
      normalMap: makeLinear(normalCanvas, "normal"),
      roughnessMap: makeLinear(roughCanvas, "roughness"),
      aoMap: makeLinear(aoCanvas, "ao"),
      displacementMap: makeLinear(dispCanvas, "displacement")
    };
  } catch (err) {
    console.warn("Stage 3 procedural tile maps skipped for", tileKey, err);
    return null;
  }
}



/**
 * PBRManager
 * Uses geometry UVs that are already meter-scaled.
 * No UV scaling here — avoids cross-mesh texture bleed.
 */
export class PBRManager {
  constructor(poolParamsRef, tileSize, causticsSystem) {
    this.poolParamsRef = poolParamsRef;
    this.tileSize = tileSize;
    this.caustics = causticsSystem;

    this.loader = new THREE.TextureLoader();
    this.tileLibrary = {};
    this.currentTileKey = "blue";
    this.poolGroup = null;
  }

  setPoolGroup(group) {
    this.poolGroup = group;
  }

  updatePoolParamsRef(ref) {
    this.poolParamsRef = ref;
  }

  renderTileSelector() {
    const grid = document.getElementById("tile-grid") || document.getElementById("tile-options");
    if (!grid) return Array.from(document.querySelectorAll(".tile-btn"));

    // Build the selector from the same library the loader uses. This keeps the UI,
    // file paths, and selected tile keys in sync whenever new PBR colours are added.
    grid.innerHTML = "";

    TILE_LIBRARY_OPTIONS.forEach((tile) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tile-btn";
      if (tile.key === this.currentTileKey) button.classList.add("active");
      button.dataset.tile = tile.key;
      button.title = tile.label;
      button.setAttribute("aria-label", tile.label);

      // Use a generated preview instead of relying only on external preview.jpg files.
      // This keeps the expanded colour library visible even if the new pbr_tiles
      // folders have not been copied to the deployed server yet.
      const previewDataUrl = createTilePreviewDataUrl(tile.key);
      button.style.backgroundImage = previewDataUrl ? `url("${previewDataUrl}")` : "";
      button.style.backgroundColor = tile.colorA || "#0b8fbd";

      const label = document.createElement("span");
      label.className = "tile-btn-label";
      label.textContent = tile.label;
      button.appendChild(label);

      grid.appendChild(button);
    });

    return Array.from(grid.querySelectorAll(".tile-btn"));
  }

  async initButtons(initialPoolGroup) {
    this.poolGroup = initialPoolGroup;

    const buttons = this.renderTileSelector();
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const nextTile = btn.dataset.tile;
        if (!nextTile || nextTile === this.currentTileKey) return;

        this.currentTileKey = nextTile;
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        btn.classList.add("loading");
        try {
          await this.applyCurrentToGroup();
        } finally {
          btn.classList.remove("loading");
        }
      });
    });

    await this.applyCurrentToGroup();
  }

  loadTexture(path, isColor = false) {
    return new Promise((resolve) => {
      if (!path) return resolve(null);

      this.loader.load(
        path,
        (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(1, 1);
          tex.anisotropy = 12;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = isColor
            ? THREE.SRGBColorSpace
            : THREE.NoColorSpace;
          resolve(tex);
        },
        undefined,
        (err) => {
          console.warn("Failed to load tile texture:", path, err);
          resolve(null);
        }
      );
    });
  }

  tileBaseUrl(tileKey) {
    const tile = TILE_LIBRARY_BY_KEY[tileKey] || { folder: tileKey };
    return new URL(`../../../pbr_tiles/${encodePathSegmentPath(tile.folder)}/`, import.meta.url).href;
  }

  async ensureTileLoaded(tileKey) {
    if (this.tileLibrary[tileKey]) return this.tileLibrary[tileKey];

    const base = this.tileBaseUrl(tileKey);
    const [map, normalMap, roughnessMap, aoMap, displacementMap] = await Promise.all([
      this.loadTexture(base + "basecolor.jpg", true),
      this.loadTexture(base + "normal.jpg"),
      this.loadTexture(base + "roughness.jpg"),
      this.loadTexture(base + "ao.jpg"),
      this.loadTexture(base + "displacement.jpg")
    ]);

    const baseMap = map || createProceduralTileTexture(tileKey);
    const enhancedMap = createStage2BaseColorTexture(baseMap, tileKey);
    const stage3Maps = createStage3SupportTextureSet(enhancedMap || baseMap, tileKey);
    const maps = {
      map: enhancedMap || baseMap,
      normalMap: stage3Maps?.normalMap || normalMap,
      roughnessMap: stage3Maps?.roughnessMap || roughnessMap,
      aoMap: stage3Maps?.aoMap || aoMap,
      displacementMap: stage3Maps?.displacementMap || displacementMap
    };

    if (!maps.map) {
      console.warn(`Tile set '${tileKey}' could not be loaded from`, base);
    }

    this.tileLibrary[tileKey] = maps;
    return maps;
  }

  getSurfaceKind(mesh, fallback = "default") {
    const data = mesh?.userData || {};
    if (data.isFloor || data.type === "floor") return "floor";
    if (data.isStep || data.type === "step") return "step";
    if (data.isWall || data.type === "wall" || data.forceVerticalUV) return "wall";
    return fallback;
  }

  ensureAoUv(mesh) {
    if (!mesh?.geometry?.attributes?.uv) return;
    if (!mesh.geometry.attributes.uv2) {
      mesh.geometry.setAttribute("uv2", mesh.geometry.attributes.uv.clone());
    }
  }

  disposePreviousMaterial(mesh) {
    const oldMat = mesh?.material;
    if (!oldMat || oldMat.userData?.keepAlive) return;
    if (Array.isArray(oldMat)) oldMat.forEach((m) => m?.dispose?.());
    else oldMat.dispose?.();
  }

  buildTileMaterial(maps, mesh, surfaceKind = "default") {
    const settings = TILE_SURFACE_SETTINGS[surfaceKind] || TILE_SURFACE_SETTINGS.default;
    const profile = TILE_UV_STAGE2_PROFILES[surfaceKind] || TILE_UV_STAGE2_PROFILES.default;
    const surfaceMaps = {
      map: cloneTextureForSurface(maps.map, profile),
      normalMap: cloneTextureForSurface(maps.normalMap, profile),
      roughnessMap: cloneTextureForSurface(maps.roughnessMap, profile),
      aoMap: cloneTextureForSurface(maps.aoMap, profile),
      displacementMap: cloneTextureForSurface(maps.displacementMap, profile)
    };
    const hasRoughnessMap = Boolean(surfaceMaps.roughnessMap);
    const hasNormalMap = Boolean(surfaceMaps.normalMap);
    const useDisplacement = Boolean(surfaceMaps.displacementMap && settings.displacementScale > 0);

    const mat = new THREE.MeshPhysicalMaterial({
      map: surfaceMaps.map,
      normalMap: hasNormalMap ? surfaceMaps.normalMap : null,
      roughnessMap: hasRoughnessMap ? surfaceMaps.roughnessMap : null,
      aoMap: surfaceMaps.aoMap || null,
      displacementMap: useDisplacement ? surfaceMaps.displacementMap : null,
      displacementScale: useDisplacement ? settings.displacementScale : 0,
      metalness: 0.0,
      roughness: hasRoughnessMap ? settings.roughness : Math.min(0.58, settings.roughness + 0.12),
      envMapIntensity: settings.envMapIntensity,
      clearcoat: settings.clearcoat,
      clearcoatRoughness: settings.clearcoatRoughness,
      reflectivity: 0.36,
      sheen: 0.0
    });

    if (hasNormalMap) {
      const boostedNormal = settings.normalScale * (profile.groutBoost || 1);
      mat.normalScale = new THREE.Vector2(boostedNormal, boostedNormal);
    }

    // Realistic underwater tint: keep the water plane mostly clear, then tint
    // the underwater tile material based on world height. This avoids the old
    // flat left-to-right water-plane gradient while keeping the effect natural.
    const tintConfigBySurface = {
      floor: {
        shallowMultiplier: new THREE.Vector3(0.86, 1.08, 1.18),
        deepMultiplier: new THREE.Vector3(0.28, 0.68, 1.28),
        shallowAmount: 0.26,
        deepAmount: 0.78,
        brighten: 0.09
      },
      wall: {
        shallowMultiplier: new THREE.Vector3(0.88, 1.06, 1.16),
        deepMultiplier: new THREE.Vector3(0.38, 0.72, 1.22),
        shallowAmount: 0.20,
        deepAmount: 0.62,
        brighten: 0.06
      },
      step: {
        shallowMultiplier: new THREE.Vector3(0.88, 1.06, 1.15),
        deepMultiplier: new THREE.Vector3(0.50, 0.82, 1.18),
        shallowAmount: 0.22,
        deepAmount: 0.46,
        brighten: 0.07
      },
      spa: {
        shallowMultiplier: new THREE.Vector3(0.88, 1.06, 1.15),
        deepMultiplier: new THREE.Vector3(0.40, 0.74, 1.20),
        shallowAmount: 0.20,
        deepAmount: 0.56,
        brighten: 0.05
      },
      default: {
        shallowMultiplier: new THREE.Vector3(0.88, 1.06, 1.15),
        deepMultiplier: new THREE.Vector3(0.40, 0.74, 1.20),
        shallowAmount: 0.18,
        deepAmount: 0.54,
        brighten: 0.045
      }
    };
    const tintCfg = tintConfigBySurface[surfaceKind] || tintConfigBySurface.default;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPoolTintShallowMultiplier = { value: tintCfg.shallowMultiplier.clone() };
      shader.uniforms.uPoolTintDeepMultiplier = { value: tintCfg.deepMultiplier.clone() };
      shader.uniforms.uPoolTintShallowAmount = { value: tintCfg.shallowAmount };
      shader.uniforms.uPoolTintDeepAmount = { value: tintCfg.deepAmount };
      shader.uniforms.uPoolTintBrighten = { value: tintCfg.brighten };

      const poolTintVarying = "varying vec3 vPoolTileWorldPos;\n";
      const poolTintVertexChunk = [
        "#include <begin_vertex>",
        "vec4 poolTileWorldPosition = modelMatrix * vec4(transformed, 1.0);",
        "vPoolTileWorldPos = poolTileWorldPosition.xyz;"
      ].join("\n");
      const poolTintFragmentHeader = [
        "uniform vec3 uPoolTintShallowMultiplier;",
        "uniform vec3 uPoolTintDeepMultiplier;",
        "uniform float uPoolTintShallowAmount;",
        "uniform float uPoolTintDeepAmount;",
        "uniform float uPoolTintBrighten;",
        "varying vec3 vPoolTileWorldPos;",
        ""
      ].join("\n");
      const poolTintFragmentChunk = [
        "#include <map_fragment>",
        "float poolDepthFromZ = smoothstep(-0.10, -2.35, vPoolTileWorldPos.z);",
        "float poolDepthFromY = smoothstep(-0.10, -2.35, vPoolTileWorldPos.y);",
        "float poolDepthTintFactor = max(poolDepthFromZ, poolDepthFromY);",
        "vec3 poolTintMultiplier = mix(uPoolTintShallowMultiplier, uPoolTintDeepMultiplier, poolDepthTintFactor);",
        "float poolTintAmount = mix(uPoolTintShallowAmount, uPoolTintDeepAmount, poolDepthTintFactor);",
        "vec3 tintedPoolColour = mix(diffuseColor.rgb, diffuseColor.rgb * poolTintMultiplier, clamp(poolTintAmount, 0.0, 1.0));",
        "vec3 waterBodyColour = mix(vec3(0.22, 0.95, 1.0), vec3(0.00, 0.18, 0.86), poolDepthTintFactor);",
        "tintedPoolColour = mix(tintedPoolColour, waterBodyColour, clamp(poolTintAmount * 0.34, 0.08, 0.28));",
        "float poolShallowLift = uPoolTintBrighten * (1.0 - poolDepthTintFactor);",
        "tintedPoolColour += vec3(0.02, 0.035, 0.05) * poolShallowLift;",
        "diffuseColor.rgb = clamp(tintedPoolColour, 0.0, 1.0);"
      ].join("\n");

      shader.vertexShader = poolTintVarying + shader.vertexShader.replace(
        "#include <begin_vertex>",
        poolTintVertexChunk
      );
      shader.fragmentShader = poolTintFragmentHeader + shader.fragmentShader.replace(
        "#include <map_fragment>",
        poolTintFragmentChunk
      );
    };
    mat.userData.isOption1DepthTintOverlayMaterial = true;
    mat.userData.isOption1DepthTintOverlayMaterialV2 = true;
    mat.userData.isOption1DepthTintOverlayRealistic = true;
    mat.userData.isRealisticPoolTileMaterial = true;
    mat.userData.isStage2TileRealismMaterial = true;
    mat.userData.isStage3TileRealismMaterial = true;
    mat.userData.surfaceKind = surfaceKind;
    mat.userData.stage2TextureRepeat = profile.repeat;
    return mat;
  }

  async applyCurrentToGroup(group = null) {
    if (group) this.poolGroup = group;
    if (!this.poolGroup) return;

    const maps = await this.ensureTileLoaded(this.currentTileKey);
    if (!maps || !maps.map) return;

    this.caustics?.reset?.();

    this.poolGroup.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry) return;
      if (mesh.userData?.isCoping) return;
      if (mesh === this.poolGroup.userData?.waterMesh) return;

      const surfaceKind = this.getSurfaceKind(mesh, "default");
      this.ensureAoUv(mesh);
      const mat = this.buildTileMaterial(maps, mesh, surfaceKind);

      this.caustics?.addToMaterial?.(mat);

      this.disposePreviousMaterial(mesh);
      mesh.material = mat;
      mesh.material.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    spas.forEach((spa) => this.applyTilesToSpa(spa));
  }

  async applyTilesToSpa(spa) {
    if (!spa) return;

    const maps = await this.ensureTileLoaded(this.currentTileKey);
    if (!maps || !maps.map) return;

    spa.traverse((mesh) => {
      if (!mesh.isMesh || mesh.userData?.isSpaWater) return;

      const surfaceKind = this.getSurfaceKind(mesh, "spa");
      this.ensureAoUv(mesh);
      const mat = this.buildTileMaterial(maps, mesh, surfaceKind);

      this.caustics?.addToMaterial?.(mat);

      this.disposePreviousMaterial(mesh);
      mesh.material = mat;
      mesh.material.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }
}
