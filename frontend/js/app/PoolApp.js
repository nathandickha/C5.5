// js/app/PoolApp.js
import * as THREE from "https://esm.sh/three@0.158.0";
import {
  initScene,
  updateGroundVoid,
  updatePoolWaterVoid,
  updateGrassForPool,
  purgeDetachedSpaChannelArtifacts
} from "../scene.js";

import { createPoolGroup, previewUpdateDepths } from "../pool/pool.js";
import { EditablePolygon } from "../pool/editing/polygon.js";

import {
  createSpa,
  spas,
  setSelectedSpa,
  setSpaTopOffset,
  getSpaTopOffsetConstraints,
  updateSpa,
  snapToPool,
  disposeSpa
} from "../pool/spa.js";

import { PoolEditor } from "../pool/pool-editor.js";

import { setupSidePanels } from "../ui/UI.js";
import { setupPoolAssistant } from "../ui/Assistant.js";
import { PBRManager } from "../pbr/PBR.js";
import { CausticsSystem } from "../caustics/Caustics.js";
import { createRectanglePool } from "../pool/shapes/rectanglePool.js";
import { createOvalPool } from "../pool/shapes/ovalPool.js";
import { createKidneyPool } from "../pool/shapes/kidneyPool.js";
import { createLShapePool } from "../pool/shapes/lshapePool.js";


const STARTER_POOL_PRESETS = [
  {
    id: "rectangle-classic",
    title: "Rectangle Pool",
    description: "6 x 4 m rectangle starter with a 2 m rounded corner, bench seat and Arctic Blue tile.",
    preview: "rectangle",
    previewCamera: { direction: [1, 1, 0.75], target: "bounds" },
    params: {
      shape: "rectangular",
      length: 6,
      width: 4,
      shallow: 1.2,
      deep: 1.8,
      shallowFlat: 1,
      deepFlat: 1,
      stepCount: 3,
      stepDepth: 0.2,
      stepWidth: 0.9,
      stepExtension: 0.3,
      bench2Extension: 0.6,
      stepBenchMode: "bench",
      stepWall: "west",
      stepPosition: "left",
      stepShape: "radius",
      tileColor: "Arctic Blue"
    },
    customFootprint: { type: "rounded-corner-rectangle", radius: 2, corner: "back-right" },
    tileColor: "Arctic Blue",
    spa: null
  },
  {
    id: "rectangle-square-spa",
    title: "Rectangle + Square Spa",
    description: "Rectangle pool with a square spa ready to reposition.",
    preview: "rectangle",
    params: { shape: "rectangular", length: 9, width: 4.5, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2 },
    spa: { shape: "square", width: 2.0, length: 2.0, topHeight: 0 }
  },
  {
    id: "rectangle-circular-spa",
    title: "Rectangle + Circular Spa",
    description: "Rectangle pool with a circular spa preset.",
    preview: "rectangle",
    params: { shape: "rectangular", length: 9, width: 4.5, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2 },
    spa: { shape: "circular", width: 2.0, length: 2.0, topHeight: 0 }
  },
  {
    id: "l-shape",
    title: "L-Shape Pool",
    description: "L-shape starter using the notch length and width controls.",
    preview: "lshape",
    params: { shape: "L", length: 10, width: 5.5, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2, notchLengthX: 0.4, notchWidthY: 0.45 },
    spa: null
  },
  {
    id: "l-shape-spa",
    title: "L-Shape + Spa",
    description: "L-shape pool with a square spa preset.",
    preview: "lshape",
    params: { shape: "L", length: 10, width: 5.5, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2, notchLengthX: 0.4, notchWidthY: 0.45 },
    spa: { shape: "square", width: 2.0, length: 2.0, topHeight: 0 }
  },
  {
    id: "oval",
    title: "Oval Pool",
    description: "Soft oval pool starter for rounded designs.",
    preview: "oval",
    params: { shape: "oval", length: 8, width: 4, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2 },
    spa: null
  },
  {
    id: "kidney",
    title: "Kidney Pool",
    description: "Kidney-shaped starter with editable kidney settings.",
    preview: "oval",
    params: { shape: "kidney", length: 9, width: 4.8, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2, kidneyLeftRadius: 2.0, kidneyRightRadius: 3.0, kidneyOffset: 1.0 },
    spa: null
  },
  {
    id: "lap-pool",
    title: "Lap Pool",
    description: "Long narrow pool preset for lap-style layouts.",
    preview: "lap",
    params: { shape: "rectangular", length: 14, width: 3, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 3, stepDepth: 0.2 },
    spa: null
  },
  {
    id: "plunge-pool",
    title: "Plunge Pool",
    description: "Compact starter pool for small-space concepts.",
    preview: "plunge",
    params: { shape: "rectangular", length: 5, width: 3, shallow: 1.2, deep: 1.8, shallowFlat: 1, deepFlat: 1, stepCount: 2, stepDepth: 0.2 },
    spa: null
  }
];


export class PoolApp {
    constructor() {
    this.poolParams = {
      length: 10,
      width: 5,
      shallow: 1.2,
      deep: 2.5,
      shape: "rectangular",
      shallowFlat: 2,
      deepFlat: 2,
      stepCount: 3,
      stepDepth: 0.2,
      stepWidth: 0.9,
      bench2Extension: 0.6,
      diagonalStepSize: 0.45,
      stepWall: "west",
      stepPosition: "center",
      stepShape: "rectangle",
      stepBenchMode: "bench",

      notchLengthX: 0.4,
      notchWidthY: 0.45,

      kidneyLeftRadius: 2.0,
      kidneyRightRadius: 3.0,
      kidneyOffset: 1.0
    };

    this.tileSize = 0.3;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ground = null;
    this.controls = null;
    this.clock = null;

    this.editablePolygon = null;
    this.poolGroup = null;

    this.clearSpaHoverHighlight();
    this.clearSpaSelectedHighlight();
    this.spa = null;
    this.transformControls = null;
    this.selectedSpa = null;
    this.hoveredSpa = null;
    this.hoverSpaHighlight = null;
    this.selectedSpaHighlight = null;
    this.spaDrag = { active: false, offset: new THREE.Vector3(), plane: new THREE.Plane(), moved: false };

    this.poolEditor = null;
    this.pbrManager = null;
    this.caustics = null;

    this.sectionViewEnabled = false;
    this.sectionViewClipPlane = null;
    this.sectionViewSavedCamera = null;
    this.sectionViewOverlay = null;
    this.sectionViewRendererLocalClippingPrev = null;
    this.sectionViewSignature = "";
    this.sectionViewVoidBox = null;
    this.sectionViewRefreshSeq = 0;

    // Step interaction state
    this.selectedStep = null;
    this.hoveredStep = null;
    this.hoverHighlightMesh = null;
    this.selectedHighlightMesh = null;

    // Wall interaction state
    this.selectedWall = null;
    this.hoveredWall = null;
    this.hoverWallHighlightMesh = null;
    this.selectedWallHighlightMesh = null;

    this.customizeMode = false;
    this.customizeWallSelections = [];
    this.customizeSelectionHighlightMeshes = [];
    this.customizePreview = null;
    this.customizePreviewLine = null;
    this.customizeEditEdgeIndex = null;
    this.customizeRadius = 1.0;
    this.customizeRadiusBounds = { min: 1.0, max: 4.0 };

    this.undoStack = [];
    this.redoStack = [];
    this.undoLimit = 50;
    this.wallRaiseBySourceEdge = {};
    this.__buildTag = "confirm-undo-patched";

    this.baseShapeType = this.poolParams.shape;
    this.isCustomShape = false;

    this.dimensionHandles = {
      container: null,
      items: {},
      drag: null
    };
    this.spaDimensionHandles = {
      meshes: {},
      drag: null,
      raycaster: null,
      mouse: null
    };
    this.sectionDimensionHandles = {
      meshes: {},
      drag: null,
      raycaster: null,
      mouse: null
    };


    // -----------------------------
    // Live preview + debounced rebuild (performance)
    // -----------------------------
    this._live = {
      dragging: false,
      // throttle preview to ~20fps by default
      previewFps: 20,
      lastPreviewTs: 0,
      previewRaf: 0,
      lastInputTs: 0,
      previewStreamMs: 200,
      // debounce rebuild (ms)
      rebuildDebounceMs: 200,
      rebuildTimer: 0,
      // accurate live rebuilds for shapes whose topology changes during drag
      accuratePreviewFps: 12,
      lastAccuratePreviewTs: 0,
      accuratePreviewInFlight: false,
      accuratePreviewQueued: false,
      // dirty params since last preview/rebuild
      dirty: new Set(),
      // snapshot of params at time poolGroup was (last) rebuilt
      baseParams: null,
      // true whenever slider input has changed real geometry and an
      // accurate rebuild still needs to be committed on release
      commitNeeded: false
    };
  }


  


// -----------------------------
  // Dimension drag handles (freeform-style scene handles)
  // -----------------------------
  _markPoolParamDirty(id) {
    this._live.dirty.add(id);
    this._live.commitNeeded = true;
    this._live.lastInputTs = performance.now ? performance.now() : Date.now();
    this._schedulePreviewTick();
    this._scheduleRebuildDebounced();
  }

  _makeDimensionHandleMesh(key, arrow) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.stroke();

    ctx.fillStyle = "#1d1d1d";
    ctx.font = "700 46px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(arrow, size * 0.5, size * 0.52);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.62, 0.62, 0.62);
    sprite.renderOrder = 2100;
    sprite.frustumCulled = false;
    sprite.userData.handleKey = key;
    sprite.userData.isDimensionHandle = true;
    return sprite;
  }

  setupDimensionHandles() {
    if (this.dimensionHandles?.meshes && Object.keys(this.dimensionHandles.meshes).length) return;
    if (!this.scene || !this.renderer) return;

    const meshes = {
      top: this._makeDimensionHandleMesh("top", "↕"),
      bottom: this._makeDimensionHandleMesh("bottom", "↕"),
      left: this._makeDimensionHandleMesh("left", "↔"),
      right: this._makeDimensionHandleMesh("right", "↔"),
      notchLength: this._makeDimensionHandleMesh("notchLength", "↔"),
      notchWidth: this._makeDimensionHandleMesh("notchWidth", "↕")
    };

    Object.values(meshes).forEach((mesh) => this.scene.add(mesh));

    this.dimensionHandles = {
      meshes,
      drag: null,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2()
    };

    this._boundDimensionHandlePointerDown = (event) => this._onDimensionHandlePointerDown(event);
    this._boundDimensionHandlePointerMove = (event) => this._onDimensionHandlePointerMove(event);
    this._boundDimensionHandlePointerUp = () => this._onDimensionHandlePointerUp();

    this.renderer.domElement.addEventListener("pointerdown", this._boundDimensionHandlePointerDown);
    window.addEventListener("pointermove", this._boundDimensionHandlePointerMove);
    window.addEventListener("pointerup", this._boundDimensionHandlePointerUp);
    window.addEventListener("pointercancel", this._boundDimensionHandlePointerUp);
  }

  destroyDimensionHandles() {
    if (this._boundDimensionHandlePointerDown && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener("pointerdown", this._boundDimensionHandlePointerDown);
      this._boundDimensionHandlePointerDown = null;
    }
    if (this._boundDimensionHandlePointerMove) {
      window.removeEventListener("pointermove", this._boundDimensionHandlePointerMove);
      this._boundDimensionHandlePointerMove = null;
    }
    if (this._boundDimensionHandlePointerUp) {
      window.removeEventListener("pointerup", this._boundDimensionHandlePointerUp);
      window.removeEventListener("pointercancel", this._boundDimensionHandlePointerUp);
      this._boundDimensionHandlePointerUp = null;
    }

    const meshes = this.dimensionHandles?.meshes || {};
    Object.values(meshes).forEach((mesh) => {
      if (!mesh) return;
      mesh.parent?.remove?.(mesh);
      mesh.material?.map?.dispose?.();
      mesh.material?.dispose?.();
    });

    this.dimensionHandles = { meshes: {}, drag: null, raycaster: null, mouse: null };
  }

  _setDimensionHandleVisibility(visible) {
    const meshes = this.dimensionHandles?.meshes || {};
    Object.values(meshes).forEach((mesh) => {
      if (!mesh) return;
      mesh.visible = !!visible;
    });
  }

  _pointerToNDC(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  _screenToPlanePoint(clientX, clientY, planeZ = 0) {
    if (!this.camera || !this.renderer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  _projectWorldToScreen(point) {
    if (!point || !this.camera || !this.renderer) return null;
    const projected = point.clone().project(this.camera);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      rect
    };
  }

  _getDimensionHandleWorldTargets() {
    if (!this.poolGroup) return null;

    const shape = this.poolParams?.shape;
    const z = 0.0;
    const out = 0.01;

    if (shape === "L" && Array.isArray(this.poolGroup?.userData?.outerPts) && this.poolGroup.userData.outerPts.length >= 6) {
      const pts = this.poolGroup.userData.outerPts;
      const mid = (a, b) => new THREE.Vector3((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, z);

      const targets = {
        left: mid(pts[5], pts[0]),
        bottom: mid(pts[0], pts[1]),
        right: mid(pts[1], pts[2]),
        top: mid(pts[2], pts[3]),
        notchLength: mid(pts[3], pts[4]),
        notchWidth: mid(pts[4], pts[5])
      };

      targets.left.x -= out;
      targets.right.x += out;
      targets.bottom.y -= out;
      targets.top.y += out;
      targets.notchLength.x += out;
      targets.notchWidth.y += out;

      return targets;
    }

    const box = new THREE.Box3().setFromObject(this.poolGroup);
    if (!box || box.isEmpty()) return null;

    const center = box.getCenter(new THREE.Vector3());

    return {
      top: new THREE.Vector3(center.x, box.max.y + out, z),
      bottom: new THREE.Vector3(center.x, box.min.y - out, z),
      left: new THREE.Vector3(box.min.x - out, center.y, z),
      right: new THREE.Vector3(box.max.x + out, center.y, z)
    };
  }

  _onDimensionHandlePointerDown(event) {
    if (event.button !== 0) return;
    if (!this.poolGroup || this.poolParams.shape === "freeform") return;
    if (!this.dimensionHandles?.meshes) return;

    const ndc = this._pointerToNDC(event);
    this.dimensionHandles.mouse.set(ndc.x, ndc.y);
    this.dimensionHandles.raycaster.setFromCamera(this.dimensionHandles.mouse, this.camera);

    const meshes = Object.values(this.dimensionHandles.meshes).filter((m) => m?.visible);
    const hits = this.dimensionHandles.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;

    const handle = hits[0].object;
    const key = handle?.userData?.handleKey;
    if (!key) return;

    event.preventDefault();
    event.stopPropagation();

    const planeZ = 0;
    const point = this._screenToPlanePoint(event.clientX, event.clientY, planeZ);
    if (!point) return;

    const affectsLength = key === "left" || key === "right";
    const affectsNotchLength = key === "notchLength";
    const affectsNotchWidth = key === "notchWidth";
    const label = affectsLength ? "length" : affectsNotchLength ? "notch length" : affectsNotchWidth ? "notch width" : "width";
    this.captureUndoState(`Drag ${label} handle`);

    if (!this._live.baseParams) {
      this._live.baseParams = { ...(this.poolGroup?.userData?.poolParams || this.poolParams) };
    }

    this.dimensionHandles.drag = {
      key,
      pointerId: event.pointerId,
      handle,
      planeZ,
      startPoint: point.clone(),
      startLength: Number(this.poolParams.length) || 0,
      startWidth: Number(this.poolParams.width) || 0,
      startNotchLengthX: Number(this.poolParams.notchLengthX) || 0,
      startNotchWidthY: Number(this.poolParams.notchWidthY) || 0
    };

    handle.scale.set(0.68, 0.68, 0.68);
    if (this.controls) this.controls.enabled = false;
    this._setLiveDragging(true);
  }

  _onDimensionHandlePointerMove(event) {
    const drag = this.dimensionHandles?.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const point = this._screenToPlanePoint(event.clientX, event.clientY, drag.planeZ || 0);
    if (!point) return;

    const minSize = 2.0;
    if (drag.key === "left" || drag.key === "right") {
      const dx = point.x - drag.startPoint.x;
      const signedDelta = drag.key === "right" ? dx : -dx;
      const rawLength = Math.max(minSize, drag.startLength + signedDelta * 2);
      const nextLength = Math.round(rawLength / 0.05) * 0.05;
      if (Math.abs(nextLength - this.poolParams.length) > 1e-4) {
        this.poolParams.length = nextLength;
        this._markPoolParamDirty("length");
      }
    } else if (drag.key === "top" || drag.key === "bottom") {
      const dy = point.y - drag.startPoint.y;
      const signedDelta = drag.key === "top" ? dy : -dy;
      const rawWidth = Math.max(minSize, drag.startWidth + signedDelta * 2);
      const nextWidth = Math.round(rawWidth / 0.05) * 0.05;
      if (Math.abs(nextWidth - this.poolParams.width) > 1e-4) {
        this.poolParams.width = nextWidth;
        this._markPoolParamDirty("width");
      }
    } else if (drag.key === "notchLength") {
      const dx = point.x - drag.startPoint.x;
      const rawFrac = drag.startNotchLengthX - (dx / Math.max(0.001, drag.startLength));
      const nextFrac = Math.round(THREE.MathUtils.clamp(rawFrac, 0.1, 0.9) / 0.05) * 0.05;
      if (Math.abs(nextFrac - this.poolParams.notchLengthX) > 1e-4) {
        this.poolParams.notchLengthX = nextFrac;
        this._markPoolParamDirty("notchLengthX");
      }
    } else if (drag.key === "notchWidth") {
      const dy = point.y - drag.startPoint.y;
      const rawFrac = drag.startNotchWidthY - (dy / Math.max(0.001, drag.startWidth));
      const nextFrac = Math.round(THREE.MathUtils.clamp(rawFrac, 0.1, 0.9) / 0.05) * 0.05;
      if (Math.abs(nextFrac - this.poolParams.notchWidthY) > 1e-4) {
        this.poolParams.notchWidthY = nextFrac;
        this._markPoolParamDirty("notchWidthY");
      }
    }

    this.syncSlidersFromParams();
  }

  async _onDimensionHandlePointerUp() {
    const drag = this.dimensionHandles?.drag;
    if (!drag) return;
    drag.handle?.scale?.set?.(0.62, 0.62, 0.62);
    this.dimensionHandles.drag = null;
    if (this.controls) this.controls.enabled = true;
    await this._setLiveDragging(false);
    await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });
  }

  _updateDimensionHandles() {
    if (!this.dimensionHandles?.meshes || !this.camera || !this.renderer) return;

    const shouldShow =
      !!this.poolGroup &&
      !this.poolEditor &&
      !this.customizeMode &&
      !this.sectionViewEnabled &&
      this.poolParams.shape !== "freeform";

    if (!shouldShow) {
      this._setDimensionHandleVisibility(false);
      return;
    }

    const targets = this._getDimensionHandleWorldTargets();
    if (!targets) {
      this._setDimensionHandleVisibility(false);
      return;
    }

    const margin = 14;
    const isLShape = this.poolParams?.shape === "L";
    Object.entries(this.dimensionHandles.meshes).forEach(([key, mesh]) => {
      const point = targets[key];
      if (!mesh || !point || ((key === "notchLength" || key === "notchWidth") && !isLShape)) {
        if (mesh) mesh.visible = false;
        return;
      }

      mesh.position.copy(point);
      const screen = this._projectWorldToScreen(point);
      if (!screen) {
        mesh.visible = false;
        return;
      }

      mesh.visible =
        screen.x >= screen.rect.left + margin &&
        screen.x <= screen.rect.right - margin &&
        screen.y >= screen.rect.top + margin &&
        screen.y <= screen.rect.bottom - margin;
    });
  }


// -----------------------------
  // Spa dimension drag handles
  // -----------------------------
  setupSpaDimensionHandles() {
    if (this.spaDimensionHandles?.meshes && Object.keys(this.spaDimensionHandles.meshes).length) return;
    if (!this.scene || !this.renderer) return;

    const meshes = {
      top: this._makeDimensionHandleMesh("spaTop", "↕"),
      bottom: this._makeDimensionHandleMesh("spaBottom", "↕"),
      left: this._makeDimensionHandleMesh("spaLeft", "↔"),
      right: this._makeDimensionHandleMesh("spaRight", "↔")
    };

    Object.values(meshes).forEach((mesh) => this.scene.add(mesh));

    this.spaDimensionHandles = {
      meshes,
      drag: null,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2()
    };

    this._boundSpaHandlePointerDown = (event) => this._onSpaHandlePointerDown(event);
    this._boundSpaHandlePointerMove = (event) => this._onSpaHandlePointerMove(event);
    this._boundSpaHandlePointerUp = () => this._onSpaHandlePointerUp();

    this.renderer.domElement.addEventListener("pointerdown", this._boundSpaHandlePointerDown);
    window.addEventListener("pointermove", this._boundSpaHandlePointerMove);
    window.addEventListener("pointerup", this._boundSpaHandlePointerUp);
    window.addEventListener("pointercancel", this._boundSpaHandlePointerUp);
  }

  _getSpaHandleTargets() {
    if (!this.spa) return null;
    const cx = Number(this.spa.position.x) || 0;
    const cy = Number(this.spa.position.y) || 0;
    const z = 0;
    const out = 0.01;
    const length = Math.max(0.5, Number(this.spa.userData?.spaLength) || 2);
    const width = Math.max(0.5, Number(this.spa.userData?.spaWidth) || 2);

    return {
      top: new THREE.Vector3(cx, cy + width * 0.5 + out, z),
      bottom: new THREE.Vector3(cx, cy - width * 0.5 - out, z),
      left: new THREE.Vector3(cx - length * 0.5 - out, cy, z),
      right: new THREE.Vector3(cx + length * 0.5 + out, cy, z)
    };
  }

  _updateSpaHandleSliderUI() {
    const widthSlider = document.getElementById("spaWidth");
    const lengthSlider = document.getElementById("spaLength");
    const widthOut = document.getElementById("spaWidth-val");
    const lengthOut = document.getElementById("spaLength-val");
    const width = Number(this.spa?.userData?.spaWidth) || 0;
    const length = Number(this.spa?.userData?.spaLength) || 0;
    if (widthSlider) widthSlider.value = String(width);
    if (lengthSlider) lengthSlider.value = String(length);
    if (widthOut) widthOut.textContent = width.toFixed(2) + " m";
    if (lengthOut) lengthOut.textContent = length.toFixed(2) + " m";
  }

  _onSpaHandlePointerDown(event) {
    if (event.button !== 0) return;
    if (!this.spa || !this.spaDimensionHandles?.meshes) return;

    const ndc = this._pointerToNDC(event);
    this.spaDimensionHandles.mouse.set(ndc.x, ndc.y);
    this.spaDimensionHandles.raycaster.setFromCamera(this.spaDimensionHandles.mouse, this.camera);

    const meshes = Object.values(this.spaDimensionHandles.meshes).filter((m) => m?.visible);
    const hits = this.spaDimensionHandles.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;

    const handle = hits[0].object;
    const key = handle?.userData?.handleKey;
    if (!key) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const point = this._screenToPlanePoint(event.clientX, event.clientY, 0);
    if (!point) return;

    this.captureUndoState("Spa dimension handle drag");

    this.spaDimensionHandles.drag = {
      key,
      pointerId: event.pointerId,
      handle,
      startPoint: point.clone(),
      startLength: Number(this.spa.userData?.spaLength) || 2,
      startWidth: Number(this.spa.userData?.spaWidth) || 2
    };

    handle.scale.set(0.68, 0.68, 0.68);
    if (this.controls) this.controls.enabled = false;
  }

  _onSpaHandlePointerMove(event) {
    const drag = this.spaDimensionHandles?.drag;
    if (!drag || event.pointerId !== drag.pointerId || !this.spa) return;

    const point = this._screenToPlanePoint(event.clientX, event.clientY, 0);
    if (!point) return;

    const spaShape = this.spa.userData?.spaShape || this.getSelectedSpaShape();
    const snap = (v) => Math.round(Math.max(0.5, v) / 0.05) * 0.05;

    if (drag.key === "spaLeft" || drag.key === "spaRight") {
      const dx = point.x - drag.startPoint.x;
      const signedDelta = drag.key === "spaRight" ? dx : -dx;
      const nextLength = snap(drag.startLength + signedDelta * 2);
      if (spaShape === "circular") {
        this.spa.userData.spaLength = nextLength;
        this.spa.userData.spaWidth = nextLength;
      } else {
        this.spa.userData.spaLength = nextLength;
      }
    } else {
      const dy = point.y - drag.startPoint.y;
      const signedDelta = drag.key === "spaTop" ? dy : -dy;
      const nextWidth = snap(drag.startWidth + signedDelta * 2);
      if (spaShape === "circular") {
        this.spa.userData.spaLength = nextWidth;
        this.spa.userData.spaWidth = nextWidth;
      } else {
        this.spa.userData.spaWidth = nextWidth;
      }
    }

    updateSpa(this.spa);
    if (this.poolGroup) {
      updatePoolWaterVoid(this.poolGroup, this.spa);
      updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
    }
    this._updateSpaHandleSliderUI();
  }

  async _onSpaHandlePointerUp() {
    const drag = this.spaDimensionHandles?.drag;
    if (!drag) return;
    drag.handle?.scale?.set?.(0.62, 0.62, 0.62);
    this.spaDimensionHandles.drag = null;
    if (this.controls) this.controls.enabled = true;
    if (this.spa) {
      updateSpa(this.spa);
      await this.pbrManager?.applyTilesToSpa?.(this.spa);
      this.refreshSpaTopOffsetSlider();
      if (this.poolGroup) {
        updatePoolWaterVoid(this.poolGroup, this.spa);
        updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
      }
    }
    await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });
  }

  _updateSpaDimensionHandles() {
    if (!this.spaDimensionHandles?.meshes || !this.camera || !this.renderer) return;

    const hideSpaHandles = () => {
      Object.values(this.spaDimensionHandles.meshes).forEach((mesh) => { if (mesh) mesh.visible = false; });
    };

    // Match the pool length/width handle behaviour: spa resize handles must not
    // appear or become clickable while section view is active. This guard is
    // intentionally inside the per-frame update so handles stay hidden after
    // rebuilds, selection changes, screenshot refreshes, and geometry edits.
    if (this.sectionViewEnabled) {
      hideSpaHandles();
      return;
    }

    if (!this.spa) {
      hideSpaHandles();
      return;
    }

    const targets = this._getSpaHandleTargets();
    if (!targets) return;

    const margin = 14;
    Object.entries(this.spaDimensionHandles.meshes).forEach(([key, mesh]) => {
      const point = targets[key.replace("spa","").toLowerCase()] || targets[key];
      if (!mesh || !point) {
        if (mesh) mesh.visible = false;
        return;
      }

      mesh.position.copy(point);
      const screen = this._projectWorldToScreen(point);
      if (!screen) {
        mesh.visible = false;
        return;
      }

      mesh.visible =
        screen.x >= screen.rect.left + margin &&
        screen.x <= screen.rect.right - margin &&
        screen.y >= screen.rect.top + margin &&
        screen.y <= screen.rect.bottom - margin;
    });
  }


// -----------------------------
  // Section dimension drag handles
  // -----------------------------
  setupSectionDimensionHandles() {
    if (this.sectionDimensionHandles?.meshes && Object.keys(this.sectionDimensionHandles.meshes).length) return;
    if (!this.scene || !this.renderer) return;

    const meshes = {
      shallow: this._makeDimensionHandleMesh("sectionShallow", "↕"),
      deep: this._makeDimensionHandleMesh("sectionDeep", "↕"),
      shallowFlat: this._makeDimensionHandleMesh("sectionShallowFlat", "↔"),
      deepFlat: this._makeDimensionHandleMesh("sectionDeepFlat", "↔")
    };

    Object.values(meshes).forEach((mesh) => this.scene.add(mesh));

    this.sectionDimensionHandles = {
      meshes,
      drag: null,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2()
    };

    this._boundSectionHandlePointerDown = (event) => this._onSectionHandlePointerDown(event);
    this._boundSectionHandlePointerMove = (event) => this._onSectionHandlePointerMove(event);
    this._boundSectionHandlePointerUp = () => this._onSectionHandlePointerUp();

    this.renderer.domElement.addEventListener("pointerdown", this._boundSectionHandlePointerDown);
    window.addEventListener("pointermove", this._boundSectionHandlePointerMove);
    window.addEventListener("pointerup", this._boundSectionHandlePointerUp);
    window.addEventListener("pointercancel", this._boundSectionHandlePointerUp);
  }

  destroySectionDimensionHandles() {
    if (this._boundSectionHandlePointerDown && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener("pointerdown", this._boundSectionHandlePointerDown);
      this._boundSectionHandlePointerDown = null;
    }
    if (this._boundSectionHandlePointerMove) {
      window.removeEventListener("pointermove", this._boundSectionHandlePointerMove);
      this._boundSectionHandlePointerMove = null;
    }
    if (this._boundSectionHandlePointerUp) {
      window.removeEventListener("pointerup", this._boundSectionHandlePointerUp);
      window.removeEventListener("pointercancel", this._boundSectionHandlePointerUp);
      this._boundSectionHandlePointerUp = null;
    }

    const meshes = this.sectionDimensionHandles?.meshes || {};
    Object.values(meshes).forEach((mesh) => {
      if (!mesh) return;
      mesh.parent?.remove?.(mesh);
      mesh.material?.map?.dispose?.();
      mesh.material?.dispose?.();
    });

    this.sectionDimensionHandles = { meshes: {}, drag: null, raycaster: null, mouse: null };
  }

  _setSectionDimensionHandleVisibility(visible) {
    const meshes = this.sectionDimensionHandles?.meshes || {};
    Object.values(meshes).forEach((mesh) => {
      if (!mesh) return;
      mesh.visible = !!visible;
    });
  }

  _getSectionDimensionProfile() {
    if (!this.poolGroup) return null;

    const params = this.poolParams || {};
    const length = Math.max(0.1, Number(params.length) || 0.1);
    const clampedShallow = Math.max(0.5, Number(params.shallow) || 1.2);
    const clampedDeep = Math.max(clampedShallow, Number(params.deep) || clampedShallow);
    const floorMeta = this.poolGroup?.userData?.floorMeta || {};
    const axisStartX = Number.isFinite(floorMeta.axisStartWallX) ? Number(floorMeta.axisStartWallX) : -(length * 0.5);
    const axisEndX = Number.isFinite(floorMeta.axisEndX) ? Number(floorMeta.axisEndX) : (length * 0.5);
    const stepFoot = Number(this.poolGroup?.userData?.stepFootprintLen) || 0;
    const rawOriginX = Number.isFinite(floorMeta.originX) ? Number(floorMeta.originX) : this.poolGroup?.userData?.originX;
    const originX = Number.isFinite(rawOriginX) ? Number(rawOriginX) : (axisStartX + stepFoot);
    const fullLen = Math.max(0.01, axisEndX - originX);

    let sFlat = Math.max(0, Number(params.shallowFlat) || 0);
    let dFlat = Math.max(0, Number(params.deepFlat) || 0);
    const maxFlats = Math.max(0, fullLen - 0.01);
    if (sFlat + dFlat > maxFlats) {
      const scale = maxFlats / Math.max(sFlat + dFlat, 0.0001);
      sFlat *= scale;
      dFlat *= scale;
    }

    const x0 = axisStartX;
    const x1 = originX + sFlat;
    const x2 = axisEndX - dFlat;
    const x3 = axisEndX;

    const bounds = new THREE.Box3().setFromObject(this.poolGroup);
    if (this.spa) bounds.expandByObject(this.spa);
    const center = bounds.getCenter(new THREE.Vector3());
    const sectionY = center.y;

    return {
      sectionY,
      x0,
      x1,
      x2,
      x3,
      originX,
      fullLen,
      maxFlats,
      shallow: clampedShallow,
      deep: clampedDeep
    };
  }

  _getSectionDimensionHandleTargets() {
    if (!this.sectionViewEnabled || !this.poolGroup) return null;
    const profile = this._getSectionDimensionProfile();
    if (!profile) return null;

    const { x0, x1, x2, x3, sectionY, shallow, deep } = profile;
    const zShallow = -shallow;
    const zDeep = -deep;
    const liftZ = 0.18;

    return {
      shallow: new THREE.Vector3(THREE.MathUtils.lerp(x0, x1, 0.5), sectionY, zShallow + liftZ),
      deep: new THREE.Vector3(THREE.MathUtils.lerp(x2, x3, 0.5), sectionY, zDeep + liftZ),
      shallowFlat: new THREE.Vector3(x1, sectionY, zShallow + liftZ),
      deepFlat: new THREE.Vector3(x2, sectionY, zDeep + liftZ)
    };
  }

  _screenToSectionPlanePoint(clientX, clientY, sectionY = 0) {
    if (!this.camera || !this.renderer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionY);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  _syncSectionDimensionSliderUI() {
    ["shallow", "deep", "shallowFlat", "deepFlat"].forEach((id) => {
      const slider = document.getElementById(id);
      const output = document.getElementById(`${id}-val`);
      const value = Number(this.poolParams?.[id]);
      if (!slider || !Number.isFinite(value)) return;
      slider.value = String(value);
      if (output) output.textContent = value.toFixed(2) + " m";
    });
  }

  _onSectionHandlePointerDown(event) {
    if (event.button !== 0) return;
    if (!this.sectionViewEnabled || !this.poolGroup || !this.sectionDimensionHandles?.meshes) return;

    const ndc = this._pointerToNDC(event);
    this.sectionDimensionHandles.mouse.set(ndc.x, ndc.y);
    this.sectionDimensionHandles.raycaster.setFromCamera(this.sectionDimensionHandles.mouse, this.camera);

    const meshes = Object.values(this.sectionDimensionHandles.meshes).filter((m) => m?.visible);
    const hits = this.sectionDimensionHandles.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;

    const handle = hits[0].object;
    const key = handle?.userData?.handleKey;
    const profile = this._getSectionDimensionProfile();
    if (!key || !profile) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const point = this._screenToSectionPlanePoint(event.clientX, event.clientY, profile.sectionY);
    if (!point) return;

    const labelMap = {
      sectionShallow: "shallow depth",
      sectionDeep: "deep depth",
      sectionShallowFlat: "shallow flat",
      sectionDeepFlat: "deep flat"
    };
    this.captureUndoState(`Drag ${labelMap[key] || "section"} handle`);

    if (!this._live.baseParams) {
      this._live.baseParams = { ...(this.poolGroup?.userData?.poolParams || this.poolParams) };
    }

    this.sectionDimensionHandles.drag = {
      key,
      pointerId: event.pointerId,
      handle,
      sectionY: profile.sectionY
    };

    handle.scale.set(0.68, 0.68, 0.68);
    if (this.controls) this.controls.enabled = false;
    this._setLiveDragging(true);
  }

  _onSectionHandlePointerMove(event) {
    const drag = this.sectionDimensionHandles?.drag;
    if (!drag || event.pointerId !== drag.pointerId || !this.poolGroup) return;

    const point = this._screenToSectionPlanePoint(event.clientX, event.clientY, drag.sectionY);
    if (!point) return;

    const profile = this._getSectionDimensionProfile();
    if (!profile) return;

    const snap = (v, min = 0) => Math.round(Math.max(min, v) / 0.05) * 0.05;
    const maxDepth = 4.0;

    if (drag.key === "sectionShallow") {
      const nextShallow = THREE.MathUtils.clamp(snap(-point.z, 0.5), 0.5, maxDepth);
      this.poolParams.shallow = nextShallow;
      if ((Number(this.poolParams.deep) || nextShallow) < nextShallow) {
        this.poolParams.deep = nextShallow;
        this._markPoolParamDirty("deep");
      }
      this._markPoolParamDirty("shallow");
    } else if (drag.key === "sectionDeep") {
      const minDeep = Math.max(0.5, Number(this.poolParams.shallow) || 0.5);
      const nextDeep = THREE.MathUtils.clamp(snap(-point.z, minDeep), minDeep, maxDepth);
      this.poolParams.deep = nextDeep;
      this._markPoolParamDirty("deep");
    } else if (drag.key === "sectionShallowFlat") {
      const maxShallowFlat = Math.max(0, profile.maxFlats - (Number(this.poolParams.deepFlat) || 0));
      const nextShallowFlat = THREE.MathUtils.clamp(snap(point.x - profile.originX, 0), 0, maxShallowFlat);
      this.poolParams.shallowFlat = nextShallowFlat;
      this._markPoolParamDirty("shallowFlat");
    } else if (drag.key === "sectionDeepFlat") {
      const maxDeepFlat = Math.max(0, profile.maxFlats - (Number(this.poolParams.shallowFlat) || 0));
      const nextDeepFlat = THREE.MathUtils.clamp(snap(profile.x3 - point.x, 0), 0, maxDeepFlat);
      this.poolParams.deepFlat = nextDeepFlat;
      this._markPoolParamDirty("deepFlat");
    } else {
      return;
    }

    this._syncSectionDimensionSliderUI();
  }

  async _onSectionHandlePointerUp() {
    const drag = this.sectionDimensionHandles?.drag;
    if (!drag) return;
    drag.handle?.scale?.set?.(0.62, 0.62, 0.62);
    this.sectionDimensionHandles.drag = null;
    if (this.controls) this.controls.enabled = true;
    await this._setLiveDragging(false);
    await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });
  }

  _updateSectionDimensionHandles() {
    if (!this.sectionDimensionHandles?.meshes || !this.camera || !this.renderer) return;

    const allow =
      !!this.sectionViewEnabled &&
      !!this.poolGroup &&
      this.poolParams?.shape !== "freeform" &&
      !this.dimensionHandles?.drag &&
      !this.spaDimensionHandles?.drag;

    if (!allow) {
      this._setSectionDimensionHandleVisibility(false);
      return;
    }

    const targets = this._getSectionDimensionHandleTargets();
    if (!targets) {
      this._setSectionDimensionHandleVisibility(false);
      return;
    }

    const margin = 14;
    Object.entries(this.sectionDimensionHandles.meshes).forEach(([key, mesh]) => {
      const point = targets[key];
      if (!mesh || !point) {
        if (mesh) mesh.visible = false;
        return;
      }

      mesh.position.copy(point);
      const screen = this._projectWorldToScreen(point);
      if (!screen) {
        mesh.visible = false;
        return;
      }

      mesh.visible =
        screen.x >= screen.rect.left + margin &&
        screen.x <= screen.rect.right - margin &&
        screen.y >= screen.rect.top + margin &&
        screen.y <= screen.rect.bottom - margin;
    });
  }

// -----------------------------
  // Caustics controls (called by UI)
  // -----------------------------
  setCausticsEnabled(enabled) {
    this.caustics?.setEnabled?.(enabled);
    // Re-attach (in case materials were rebuilt while disabled)
    if (enabled) this.caustics?.attachToGroup?.(this.poolGroup);
  }


  _forEachSectionMaterial(root, fn) {
    if (!root?.traverse) return;
    root.traverse((obj) => {
      if (!obj?.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => mat && fn(mat, obj));
    });
  }


  _ensureSectionUnderfloorClipMaterial(material) {
    if (!material) return;
    material.userData = material.userData || {};
    if (material.userData.__sectionUnderfloorClipPatched) return;

    material.userData.__sectionUnderfloorClipPatched = true;
    material.userData.__sectionUnderfloorClipUniforms = {
      sectionUnderfloorClipEnabled: { value: 0 },
      sectionUnderfloorCutY: { value: 0 },
      sectionUnderfloorHalfWidth: { value: 0.5 },
      sectionUnderfloorMinX: { value: 0 },
      sectionUnderfloorMaxX: { value: 0 },
      sectionUnderfloorX1: { value: 0 },
      sectionUnderfloorX2: { value: 0 },
      sectionUnderfloorTopZ0: { value: 0 },
      sectionUnderfloorTopZ1: { value: 0 },
      sectionUnderfloorTopZ2: { value: 0 },
      sectionUnderfloorBottomZ: { value: -10 }
    };

    const previousOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader) => {
      if (typeof previousOnBeforeCompile === 'function') previousOnBeforeCompile(shader);

      Object.assign(shader.uniforms, material.userData.__sectionUnderfloorClipUniforms);

      if (!shader.vertexShader.includes('vSectionUnderfloorWorldPos')) {
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vSectionUnderfloorWorldPos;'
          )
          .replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\n  vSectionUnderfloorWorldPos = worldPosition.xyz;'
          );
      }

      if (!shader.fragmentShader.includes('sectionUnderfloorClipEnabled')) {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vSectionUnderfloorWorldPos;\nuniform int sectionUnderfloorClipEnabled;\nuniform float sectionUnderfloorCutY;\nuniform float sectionUnderfloorHalfWidth;\nuniform float sectionUnderfloorMinX;\nuniform float sectionUnderfloorMaxX;\nuniform float sectionUnderfloorX1;\nuniform float sectionUnderfloorX2;\nuniform float sectionUnderfloorTopZ0;\nuniform float sectionUnderfloorTopZ1;\nuniform float sectionUnderfloorTopZ2;\nuniform float sectionUnderfloorBottomZ;'
          )
          .replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
  if (sectionUnderfloorClipEnabled == 1) {
    float clipDy = abs(vSectionUnderfloorWorldPos.y - sectionUnderfloorCutY);
    if (clipDy <= sectionUnderfloorHalfWidth &&
        vSectionUnderfloorWorldPos.x >= sectionUnderfloorMinX &&
        vSectionUnderfloorWorldPos.x <= sectionUnderfloorMaxX &&
        vSectionUnderfloorWorldPos.z >= sectionUnderfloorBottomZ) {
      float sectionTopZ = sectionUnderfloorTopZ0;
      if (vSectionUnderfloorWorldPos.x <= sectionUnderfloorX1) {
        sectionTopZ = sectionUnderfloorTopZ0;
      } else if (vSectionUnderfloorWorldPos.x >= sectionUnderfloorX2) {
        sectionTopZ = sectionUnderfloorTopZ2;
      } else {
        float t = (vSectionUnderfloorWorldPos.x - sectionUnderfloorX1) / max(sectionUnderfloorX2 - sectionUnderfloorX1, 1e-5);
        sectionTopZ = mix(sectionUnderfloorTopZ1, sectionUnderfloorTopZ2, clamp(t, 0.0, 1.0));
      }
      if (vSectionUnderfloorWorldPos.z <= sectionTopZ) discard;
    }
  }`
          );
      }
    };

    const previousCacheKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => {
      const prev = previousCacheKey ? previousCacheKey() : '';
      return `${prev}|section-underfloor-clip-v1`;
    };

    material.needsUpdate = true;
  }

  _setSectionUnderfloorClip(root, config) {
    if (!root) return;
    this._forEachSectionMaterial(root, (mat, obj) => {
      const isSectionShell = !!(
        obj.userData?.isWall ||
        obj.userData?.isFloor ||
        obj.userData?.isStep
      );
      if (!isSectionShell) return;
      this._ensureSectionUnderfloorClipMaterial(mat);
      const uniforms = mat.userData?.__sectionUnderfloorClipUniforms;
      if (!uniforms) return;
      if (config) {
        uniforms.sectionUnderfloorClipEnabled.value = 1;
        uniforms.sectionUnderfloorCutY.value = config.cutY ?? 0;
        uniforms.sectionUnderfloorHalfWidth.value = config.halfWidth ?? 0.5;
        uniforms.sectionUnderfloorMinX.value = config.minX ?? 0;
        uniforms.sectionUnderfloorMaxX.value = config.maxX ?? 0;
        uniforms.sectionUnderfloorX1.value = config.x1 ?? 0;
        uniforms.sectionUnderfloorX2.value = config.x2 ?? 0;
        uniforms.sectionUnderfloorTopZ0.value = config.topZ0 ?? 0;
        uniforms.sectionUnderfloorTopZ1.value = config.topZ1 ?? 0;
        uniforms.sectionUnderfloorTopZ2.value = config.topZ2 ?? 0;
        uniforms.sectionUnderfloorBottomZ.value = config.bottomZ ?? -10;
      } else {
        uniforms.sectionUnderfloorClipEnabled.value = 0;
      }
      mat.needsUpdate = true;
    });
  }

  _setSectionShellClip(root, plane) {
    if (!root) return;
    this._forEachSectionMaterial(root, (mat, obj) => {
      const isSectionShell = !!(
        obj.userData?.isWall ||
        obj.userData?.isCoping ||
        obj.userData?.isSpaWall ||
        obj.userData?.isFloor ||
        obj.userData?.isStep ||
        obj.userData?.isSpaFloor ||
        obj.userData?.isSpaSeat ||
        obj.userData?.isSpaSupport
      );
      if (!isSectionShell) return;

      if (plane) {
        if (!mat.userData.__sectionPrevClipping) {
          mat.userData.__sectionPrevClipping = mat.clippingPlanes ? [...mat.clippingPlanes] : [];
        }
        const prev = mat.userData.__sectionPrevClipping || [];
        mat.clippingPlanes = [...prev, plane];
        mat.clipShadows = true;
      } else if (mat.userData.__sectionPrevClipping) {
        mat.clippingPlanes = [...mat.userData.__sectionPrevClipping];
        delete mat.userData.__sectionPrevClipping;
      }
    });
  }

  _getSectionVoidClipRoots() {
    const roots = [
      this.poolGroup,
      this.spa,
      this.ground,
      this.poolGroup?.userData?.waterMesh,
      this.spa?.userData?.waterMesh,
      this.ground?.userData?.spaChannelGroup,
      this.ground?.userData?.spaChannelWaterGroup
    ].filter(Boolean);

    // Channel meshes are sometimes rebuilt/reattached outside the ground userData
    // reference. Include any live channel meshes/groups from the scene as a fallback
    // so floor, wall, coping and water are all cut by the section void box.
    this.scene?.traverse?.((obj) => {
      if (!obj) return;
      const n = String(obj.name || '').toLowerCase();
      const ud = obj.userData || {};
      const isSectionCuttable = !!(
        ud.isWall || ud.isCoping || ud.isFloor || ud.isStep ||
        ud.isSpaWall || ud.isSpaFloor || ud.isSpaSeat || ud.isSpaSupport ||
        ud.isSpaChannel || ud.isSpaChannelWater || ud.isSpaChannelFloor ||
        ud.isSpaChannelWall || ud.isSpaChannelCoping ||
        n === 'spachannelgroup' || n === 'spachannelwatergroup' ||
        n.includes('coping') || n.includes('channel')
      );
      if (isSectionCuttable) roots.push(obj);
    });

    return Array.from(new Set(roots));
  }

  _patchSectionVoidBoxMaterial(material) {
    if (!material || material.userData?.__sectionVoidBoxPatched) return;
    material.userData = material.userData || {};
    material.userData.__sectionVoidBoxPatched = true;
    material.userData.__sectionVoidBoxUniforms = {
      sectionVoidBoxClipEnabled: { value: 0 },
      sectionVoidBoxMin: { value: new THREE.Vector3() },
      sectionVoidBoxMax: { value: new THREE.Vector3() }
    };

    const prevOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      if (typeof prevOnBeforeCompile === 'function') prevOnBeforeCompile.call(material, shader, renderer);
      Object.assign(shader.uniforms, material.userData.__sectionVoidBoxUniforms);

      if (!shader.vertexShader.includes('vSectionVoidBoxWorldPos')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vSectionVoidBoxWorldPos;'
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSectionVoidBoxWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
      }

      if (!shader.fragmentShader.includes('sectionVoidBoxClipEnabled')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vSectionVoidBoxWorldPos;\nuniform int sectionVoidBoxClipEnabled;\nuniform vec3 sectionVoidBoxMin;\nuniform vec3 sectionVoidBoxMax;'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
  if (sectionVoidBoxClipEnabled == 1 &&
      vSectionVoidBoxWorldPos.x >= sectionVoidBoxMin.x && vSectionVoidBoxWorldPos.x <= sectionVoidBoxMax.x &&
      vSectionVoidBoxWorldPos.y >= sectionVoidBoxMin.y && vSectionVoidBoxWorldPos.y <= sectionVoidBoxMax.y &&
      vSectionVoidBoxWorldPos.z >= sectionVoidBoxMin.z && vSectionVoidBoxWorldPos.z <= sectionVoidBoxMax.z) {
    discard;
  }`
        );
      }
    };

    const prevKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => {
      const base = prevKey ? prevKey() : '';
      return `${base}|section-void-box-clip-v1`;
    };

    material.needsUpdate = true;
  }

  _setSectionVoidClip(plane = null, boxBounds = null) {
    const roots = this._getSectionVoidClipRoots();
    roots.forEach((root) => {
      this._forEachSectionMaterial(root, (mat) => {
        if (!mat) return;
        mat.userData = mat.userData || {};
        this._patchSectionVoidBoxMaterial(mat);

        const uniforms = mat.userData.__sectionVoidBoxUniforms;
        if (uniforms) {
          if (boxBounds) {
            uniforms.sectionVoidBoxClipEnabled.value = 1;
            uniforms.sectionVoidBoxMin.value.set(boxBounds.minX, boxBounds.minY, boxBounds.minZ);
            uniforms.sectionVoidBoxMax.value.set(boxBounds.maxX, boxBounds.maxY, boxBounds.maxZ);
          } else {
            uniforms.sectionVoidBoxClipEnabled.value = 0;
          }
        }

        // Important: section mode must NOT take ownership of material.clippingPlanes.
        // The spa yellow/blue throat voids use clippingPlanes + clipIntersection to
        // create the channel and trim the coping/wall correctly. Adding the section
        // plane into that same array changes the boolean logic and breaks the spa
        // voids in section view. The section cut is therefore handled only by the
        // shader discard volume above, leaving all existing spa void material state
        // untouched.
        delete mat.userData.__sectionVoidPlane;
        delete mat.userData.__sectionVoidPrevClipping;
        delete mat.userData.__sectionVoidPrevClipShadows;

        mat.needsUpdate = true;
      });
    });
  }

  _getSectionFaceOffset() {
    // Keep the visible void-box face and all generated section caps on one
    // shared Y coordinate. This replaces the previous separate cap offsets
    // (0.003, 0.004, 0.008, etc.) that could make caps appear slightly
    // inside or in front of the actual section cut.
    return 0.02;
  }

  _getSectionFaceY(sectionCutY) {
    const cutY = Number.isFinite(sectionCutY) ? sectionCutY : 0;
    return cutY + this._getSectionFaceOffset();
  }

  _getSectionVoidBoxBounds(sectionCutY) {
    const contentBounds = new THREE.Box3();
    const contentRoots = [
      this.poolGroup,
      this.spa,
      this.ground?.userData?.spaChannelGroup,
      this.ground?.userData?.spaChannelWaterGroup
    ].filter(Boolean);

    this.scene?.traverse?.((obj) => {
      if (!obj) return;
      const n = String(obj.name || '').toLowerCase();
      const ud = obj.userData || {};
      const isSectionBoundsObject = !!(
        ud.isWall || ud.isCoping || ud.isFloor || ud.isStep ||
        ud.isSpaWall || ud.isSpaFloor || ud.isSpaSeat || ud.isSpaSupport ||
        ud.isSpaChannel || ud.isSpaChannelWater || ud.isSpaChannelFloor ||
        ud.isSpaChannelWall || ud.isSpaChannelCoping ||
        n === 'spachannelgroup' || n === 'spachannelwatergroup' ||
        n.includes('coping') || n.includes('channel')
      );
      if (isSectionBoundsObject) contentRoots.push(obj);
    });

    Array.from(new Set(contentRoots)).forEach((root) => contentBounds.expandByObject(root));
    if (contentBounds.isEmpty()) return null;

    let groundBounds = null;
    if (this.ground) {
      const gb = new THREE.Box3().setFromObject(this.ground);
      if (!gb.isEmpty()) groundBounds = gb;
    }

    const minY = contentBounds.min.y;
    const maxY = this._getSectionFaceY(sectionCutY);
    const widthY = maxY - minY;
    if (!Number.isFinite(widthY) || widthY <= 1e-4) return null;

    const xPad = Math.max(1.0, contentBounds.getSize(new THREE.Vector3()).x * 0.08);
    const yPad = 0.08;
    // Keep the active section void tall/deep enough to catch raised coping,
    // channel coping and foreground wall pieces after edits/rebuilds.
    const topPad = 2.0;
    const bottomPad = 2.0;
    const sceneBottomZ = groundBounds ? Math.min(contentBounds.min.z, groundBounds.min.z) : contentBounds.min.z;
    const sceneTopZ = groundBounds ? Math.max(contentBounds.max.z, groundBounds.max.z) : contentBounds.max.z;

    return {
      minX: contentBounds.min.x - xPad,
      maxX: contentBounds.max.x + xPad,
      minY: minY - yPad,
      maxY,
      minZ: sceneBottomZ - bottomPad,
      maxZ: sceneTopZ + topPad
    };
  }

  _updateSectionVoidBox(sectionCutY) {
    this._removeSectionVoidBox();
    if (!this.scene) return;

    const bounds = this._getSectionVoidBoxBounds(sectionCutY);
    if (!bounds) return;

    const size = new THREE.Vector3(
      Math.max(0.05, bounds.maxX - bounds.minX),
      Math.max(0.05, bounds.maxY - bounds.minY),
      Math.max(0.05, bounds.maxZ - bounds.minZ)
    );
    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) * 0.5,
      (bounds.minY + bounds.maxY) * 0.5,
      (bounds.minZ + bounds.maxZ) * 0.5
    );

    const group = new THREE.Group();
    group.name = 'SectionVoidBox';
    group.renderOrder = 999;

    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.12,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    fill.position.copy(center);
    fill.renderOrder = 999;
    fill.visible = false; // keep section void active but hide the debug fill box
    group.add(fill);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
      new THREE.LineBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        depthWrite: false
      })
    );
    edges.position.copy(center);
    edges.renderOrder = 1000;
    edges.visible = false; // keep section void active but hide the debug outline box
    group.add(edges);

    group.userData.sectionCutY = sectionCutY;
    this.scene.add(group);
    this.sectionViewVoidBox = group;
  }

  _removeSectionVoidBox() {
    if (!this.sectionViewVoidBox) return;
    this.sectionViewVoidBox.traverse?.((obj) => {
      if (obj.geometry?.dispose) obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
      else mat?.dispose?.();
    });
    this.sectionViewVoidBox.parent?.remove?.(this.sectionViewVoidBox);
    this.sectionViewVoidBox = null;
  }

  _refreshSpaVoidsForSection() {
    try { updatePoolWaterVoid(this.poolGroup, this.spa); } catch (_) {}
    try { updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa); } catch (_) {}
    try { this.spa?.userData?.poolGroup && updatePoolWaterVoid(this.spa.userData.poolGroup, this.spa); } catch (_) {}
  }

  _enableSectionVoidClip(sectionCutY) {
    if (!this.renderer) return null;
    if (this.sectionViewRendererLocalClippingPrev === null) {
      this.sectionViewRendererLocalClippingPrev = !!this.renderer.localClippingEnabled;
    }
    this.renderer.localClippingEnabled = true;
    this.sectionViewClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionCutY);
    const sectionVoidBounds = this._getSectionVoidBoxBounds(sectionCutY);
    this._setSectionVoidClip(this.sectionViewClipPlane, sectionVoidBounds);
    this._updateSectionVoidBox(sectionCutY);
    return this.sectionViewClipPlane;
  }

  _disableSectionVoidClip() {
    this._setSectionVoidClip(null);
    this._removeSectionVoidBox();
    if (this.renderer && this.sectionViewRendererLocalClippingPrev !== null) {
      this.renderer.localClippingEnabled = this.sectionViewRendererLocalClippingPrev;
    }
    this.sectionViewRendererLocalClippingPrev = null;
    this.sectionViewClipPlane = null;
  }

  _setSectionHidden(root, hidden) {
    if (!root?.traverse) return;
    root.traverse((obj) => {
      if (!obj?.isMesh) return;
      if (hidden) {
        if (obj.userData.__sectionPrevVisible === undefined) obj.userData.__sectionPrevVisible = obj.visible;
        obj.visible = false;
      } else if (obj.userData.__sectionPrevVisible !== undefined) {
        obj.visible = obj.userData.__sectionPrevVisible;
        delete obj.userData.__sectionPrevVisible;
      }
    });
  }


  _setSectionWaterClip(root, cutY = null) {
    if (!root?.traverse) return;
    root.traverse((obj) => {
      if (!obj?.isMesh) return;
      if (typeof obj.userData?.setSectionClipY === 'function') {
        obj.userData.setSectionClipY(cutY);
      } else {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          const uniforms = mat?.uniforms;
          if (!uniforms?.sectionClipEnabled || !uniforms?.sectionClipY) return;
          if (typeof cutY === 'number' && Number.isFinite(cutY)) {
            uniforms.sectionClipEnabled.value = 1.0;
            uniforms.sectionClipY.value = cutY;
          } else {
            uniforms.sectionClipEnabled.value = 0.0;
          }
          mat.needsUpdate = true;
        });
      }
    });
  }

  _setSectionFrontShellHidden(centerY, hidden) {
    const roots = this._getSectionVoidClipRoots ? this._getSectionVoidClipRoots() : [this.poolGroup, this.spa, this.ground?.userData?.spaChannelGroup].filter(Boolean);
    const EPS = 1e-4;
    const poolBounds = new THREE.Box3();
    if (this.poolGroup) poolBounds.expandByObject(this.poolGroup);
    const spaBounds = new THREE.Box3();
    if (this.spa) spaBounds.expandByObject(this.spa);
    const snapSide = String(this.spa?.userData?.snapSide || '').toLowerCase();
    const spaCutsPoolWall = !!(
      this.spa?.userData?.isHalfwayInWall ||
      this.spa?.userData?.channelEnabled ||
      String(this.spa?.userData?.snapVariant || '').toLowerCase() !== 'inner-flush'
    );

    roots.forEach((root) => {
      root.traverse((obj) => {
        if (!obj?.isMesh) return;
        const isSectionShell = !!(
          obj.userData?.isWall ||
          obj.userData?.isCoping ||
          obj.userData?.isSpaWall ||
          obj.userData?.isSpaChannel
        );
        if (!isSectionShell) return;

        obj.updateMatrixWorld?.(true);
        const box = new THREE.Box3().setFromObject(obj);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());

        const restore = () => {
          if (!hidden && obj.userData.__sectionPrevVisible !== undefined) {
            obj.visible = obj.userData.__sectionPrevVisible;
            delete obj.userData.__sectionPrevVisible;
          }
        };
        const hideNow = () => {
          if (hidden) {
            if (obj.userData.__sectionPrevVisible === undefined) obj.userData.__sectionPrevVisible = obj.visible;
            obj.visible = false;
          } else if (obj.userData.__sectionPrevVisible !== undefined) {
            obj.visible = obj.userData.__sectionPrevVisible;
            delete obj.userData.__sectionPrevVisible;
          }
        };

        const thinX = size.x <= Math.max(0.35, size.y * 0.4);
        const thinY = size.y <= Math.max(0.35, size.x * 0.4);
        const intersectsFrontHalf = box.min.y < (centerY - EPS);
        const overlapsSpaY = !spaBounds.isEmpty() && !(box.max.y < (spaBounds.min.y - EPS) || box.min.y > (spaBounds.max.y + EPS));
        const overlapsSpaX = !spaBounds.isEmpty() && !(box.max.x < (spaBounds.min.x - EPS) || box.min.x > (spaBounds.max.x + EPS));

        // Do not hide whole coping meshes here. Original coping may be a single
        // long ring/segment that crosses both the kept and removed halves. The
        // active section void shader now trims only the portion inside the void
        // box; hiding the whole mesh would delete the visible rear/top coping.

        // When the spa is pushed into or beyond the pool wall, remove the
        // pool shell that still sits in front of the section line on that spa
        // side. This hides both the thin end wall itself and any short return
        // pieces that continue past the cut. Leave spa/channel geometry alone
        // so their own section faces remain visible.
        if (root === this.poolGroup && intersectsFrontHalf && !spaBounds.isEmpty() && !poolBounds.isEmpty()) {
          const spaOverlapPad = 0.12;
          const overlapsSpaPlan = !(
            box.max.x < (spaBounds.min.x - spaOverlapPad) ||
            box.min.x > (spaBounds.max.x + spaOverlapPad) ||
            box.max.y < (spaBounds.min.y - spaOverlapPad) ||
            box.min.y > (spaBounds.max.y + spaOverlapPad)
          );

          if ((snapSide === 'right' || snapSide === 'left') && overlapsSpaY) {
            const onSpaSide = snapSide === 'right'
              ? box.max.x > (poolBounds.max.x - 0.3)
              : box.min.x < (poolBounds.min.x + 0.3);
            const shouldHide = onSpaSide && (
              thinX ||
              (spaCutsPoolWall && thinY && overlapsSpaPlan)
            );
            if (shouldHide) {
              hideNow();
              return;
            }
          }
          if ((snapSide === 'front' || snapSide === 'back') && overlapsSpaX) {
            const onSpaSide = snapSide === 'front'
              ? box.max.y > (poolBounds.max.y - 0.3)
              : box.min.y < (poolBounds.min.y + 0.3);
            const shouldHide = onSpaSide && (
              thinY ||
              (spaCutsPoolWall && thinX && overlapsSpaPlan)
            );
            if (shouldHide) {
              hideNow();
              return;
            }
          }
        }

        // Standard front-shell hide path.
        if (!thinY) {
          restore();
          return;
        }
        if (!intersectsFrontHalf) {
          restore();
          return;
        }
        hideNow();
      });
    });
  }

  _setSectionOverlay(bounds, enabled, cutY = null, wallThickness = 0.2) {
    if (!this.scene) return;
    if (this.sectionViewOverlay) {
      this.sectionViewOverlay.traverse?.((obj) => {
        if (obj?.geometry) obj.geometry.dispose?.();
        if (obj?.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m?.dispose?.());
        }
      });
      this.sectionViewOverlay.parent?.remove?.(this.sectionViewOverlay);
      this.sectionViewOverlay = null;
      this.sectionViewSignature = "";
    }
    if (!enabled || !bounds || bounds.isEmpty() || !this.poolGroup) return;

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const group = new THREE.Group();
    group.name = 'SectionOverlayGroup';

    let sectionFloorCenterY = center.y;
    let sectionFloorWidth = size.y;
    const floorMesh = this.poolGroup?.userData?.floorMesh || null;
    if (floorMesh?.isMesh) {
      floorMesh.updateMatrixWorld?.(true);
      const floorBounds = new THREE.Box3().setFromObject(floorMesh);
      if (!floorBounds.isEmpty()) {
        const floorCenter = floorBounds.getCenter(new THREE.Vector3());
        const floorSize = floorBounds.getSize(new THREE.Vector3());
        if (Number.isFinite(floorCenter.y)) sectionFloorCenterY = floorCenter.y;
        if (Number.isFinite(floorSize.y) && floorSize.y > 0.001) sectionFloorWidth = floorSize.y;
      }
    }

    const sectionY = Number.isFinite(cutY) ? cutY : (bounds.min.y + wallThickness + 0.002);
    const sectionFaceY = this._getSectionFaceY(sectionY);
    const capY = sectionFaceY + 0.001;
    const localCutY = sectionY - (this.poolGroup.position?.y || 0);
    const safeWallThickness = Math.max(0.05, this.poolGroup?.userData?.wallThickness || wallThickness || 0.2);
    const copingInset = 0.05;

    const makeBasicMat = (color, opacity = 0.95) => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });

    

const makeConcreteHatchTexture = () => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Light concrete base inspired by the supplied reference image.
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-randomness keeps the texture stable across
  // section overlay rebuilds.
  let seed = 975318642;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const fillCircle = (x, y, r, color) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const drawBlob = (cx, cy, r, aspect = 1) => {
    const pts = 5 + Math.floor(rand() * 6);
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const ang = (Math.PI * 2 * i) / pts;
      const rr = r * (0.45 + rand() * 0.8);
      const px = cx + Math.cos(ang) * rr * aspect;
      const py = cy + Math.sin(ang) * rr / Math.max(aspect, 0.001);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,' + (0.28 + rand() * 0.28) + ')';
    ctx.fill();
  };

  const drawChip = (cx, cy, length, width, angle) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-length * 0.5, -width * 0.35);
    ctx.lineTo(length * 0.30, -width * 0.5);
    ctx.lineTo(length * 0.5, -width * 0.05);
    ctx.lineTo(length * 0.15, width * 0.45);
    ctx.lineTo(-length * 0.45, width * 0.25);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,' + (0.25 + rand() * 0.28) + ')';
    ctx.fill();
    ctx.restore();
  };

  const drawArcCluster = (cx, cy, baseR, dotCount, angleStart, angleSweep) => {
    for (let i = 0; i < dotCount; i++) {
      const t = dotCount <= 1 ? 0 : i / (dotCount - 1);
      const ang = angleStart + angleSweep * t + (rand() - 0.5) * 0.10;
      const rr = baseR + (rand() - 0.5) * 2.5;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      const r = 0.25 + rand() * 0.55;
      fillCircle(x, y, r, 'rgba(0,0,0,' + (0.18 + rand() * 0.20) + ')');
    }
  };

  // Dense fine peppering.
  for (let i = 0; i < 2600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.12 + rand() * 0.48;
    fillCircle(x, y, r, 'rgba(0,0,0,' + (0.05 + rand() * 0.14) + ')');
  }

  // Small aggregate marks. Kept deliberately small so the caps do not get
  // large dirty-looking blotches when viewed in section.
  for (let i = 0; i < 140; i++) {
    drawBlob(
      rand() * size,
      rand() * size,
      0.55 + rand() * 1.9,
      0.65 + rand() * 1.35
    );
  }

  // Fine elongated chips/flecks.
  for (let i = 0; i < 120; i++) {
    drawChip(
      rand() * size,
      rand() * size,
      1.5 + rand() * 4.2,
      0.35 + rand() * 1.2,
      rand() * Math.PI * 2
    );
  }

  // Subtle dotted curved clusters from the reference image.
  for (let i = 0; i < 38; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const baseRot = rand() * Math.PI * 2;
    const arcs = 1 + Math.floor(rand() * 3);
    for (let a = 0; a < arcs; a++) {
      const start = baseRot + (Math.PI * 2 * a) / arcs + (rand() - 0.5) * 0.6;
      const sweep = 0.28 + rand() * 0.75;
      const dots = 5 + Math.floor(rand() * 10);
      drawArcCluster(cx, cy, 5 + rand() * 9, dots, start, sweep);
    }
  }

  // Only a few slightly stronger marks, still much smaller than before.
  for (let i = 0; i < 18; i++) {
    if (rand() < 0.55) {
      drawBlob(rand() * size, rand() * size, 1.8 + rand() * 2.4, 0.6 + rand() * 1.3);
    } else {
      drawChip(rand() * size, rand() * size, 4 + rand() * 5, 0.8 + rand() * 1.4, rand() * Math.PI * 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;

  // Higher repeat = smaller, finer concrete marks on the section caps.
  tex.repeat.set(0.75, 0.75);

  tex.needsUpdate = true;
  return tex;
};

const concreteHatchTex = makeConcreteHatchTexture();

    const makeConcreteCapMat = () => new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: concreteHatchTex || null,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });

    const poolOuterPts = Array.isArray(this.poolGroup?.userData?.outerPts)
      ? this.poolGroup.userData.outerPts
          .map((p) => (p?.isVector2 ? p.clone() : new THREE.Vector2(Number(p?.x) || 0, Number(p?.y) || 0)))
          .filter(Boolean)
      : [];

    const intersectPolygonAtY = (pts, y) => {
      const xs = [];
      if (!Array.isArray(pts) || pts.length < 2) return xs;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (!a || !b) continue;
        const ay = a.y;
        const by = b.y;
        const crosses = ((ay <= y) && (by > y)) || ((by <= y) && (ay > y));
        if (!crosses) continue;
        const dy = by - ay;
        if (Math.abs(dy) < 1e-8) continue;
        const t = (y - ay) / dy;
        xs.push(a.x + (b.x - a.x) * t);
      }
      xs.sort((a, b) => a - b);
      const deduped = [];
      for (const x of xs) {
        if (!deduped.length || Math.abs(x - deduped[deduped.length - 1]) > 1e-5) deduped.push(x);
      }
      return deduped;
    };

    const polygonBounds = (() => {
      const bb = new THREE.Box2();
      if (poolOuterPts.length) {
        poolOuterPts.forEach((p) => bb.expandByPoint(p));
      } else {
        bb.min.set(bounds.min.x - (this.poolGroup.position?.x || 0), bounds.min.y - (this.poolGroup.position?.y || 0));
        bb.max.set(bounds.max.x - (this.poolGroup.position?.x || 0), bounds.max.y - (this.poolGroup.position?.y || 0));
      }
      return bb;
    })();

    const floorMetaForProfile = this.poolGroup?.userData?.floorMeta || {};
    const axisStartX = Number.isFinite(floorMetaForProfile.axisStartWallX) ? Number(floorMetaForProfile.axisStartWallX) : polygonBounds.min.x;
    const axisEndX = Number.isFinite(floorMetaForProfile.axisEndX) ? Number(floorMetaForProfile.axisEndX) : polygonBounds.max.x;
    const stepFoot = Number(this.poolGroup?.userData?.stepFootprintLen) || 0;
    const rawOriginX = Number.isFinite(floorMetaForProfile.originX) ? Number(floorMetaForProfile.originX) : this.poolGroup?.userData?.originX;
    const originX = Number.isFinite(rawOriginX) ? Number(rawOriginX) : (axisStartX + stepFoot);
    const fullLen = Math.max(0.01, axisEndX - originX);
    const clampedShallow = Math.max(0.5, this.poolParams.shallow || 1.2);
    const clampedDeep = Math.max(clampedShallow, this.poolParams.deep || clampedShallow);
    let sFlat = this.poolParams.shallowFlat || 0;
    let dFlat = this.poolParams.deepFlat || 0;
    const maxFlats = Math.max(0, fullLen - 0.01);
    if (sFlat + dFlat > maxFlats) {
      const scale = maxFlats / Math.max(sFlat + dFlat, 0.0001);
      sFlat *= scale;
      dFlat *= scale;
    }
    const slopeLen = Math.max(0.01, fullLen - sFlat - dFlat);
    const x1 = originX + sFlat;
    const x2 = axisEndX - dFlat;
    const depthAtX = (x) => {
      let dx = x - originX;
      if (dx < 0) dx = 0;
      if (dx <= sFlat) return -clampedShallow;
      if (dx >= fullLen - dFlat) return -clampedDeep;
      const t = (dx - sFlat) / slopeLen;
      return -(clampedShallow + t * (clampedDeep - clampedShallow));
    };

    const intervals = [];
    // Section caps must use the same lengthwise profile as the standard rectangle pool.
    // Curved/custom/L-shape footprints still use their visual footprint in 3D, but the
    // section view is a side elevation through the pool centreline. Using polygon
    // intersections here made the cap change shape whenever the cut line hit a curve,
    // notch, or freeform edge. Keep one rectangle-style band from the profiled floor
    // start to the profiled floor end so every pool type shares the rectangle cap logic.
    const rectangleCapStartX = Number.isFinite(axisStartX) ? axisStartX : polygonBounds.min.x;
    const rectangleCapEndX = Number.isFinite(axisEndX) ? axisEndX : polygonBounds.max.x;
    if (Number.isFinite(rectangleCapStartX) && Number.isFinite(rectangleCapEndX) && rectangleCapEndX - rectangleCapStartX > 1e-4) {
      intervals.push([rectangleCapStartX, rectangleCapEndX]);
    }

    const floorMatBase = makeConcreteCapMat();
    const wallCapMatBase = makeConcreteCapMat();
    const copingCapMatBase = makeBasicMat(0xe3ddd2, 0.98);
    const waterTintMatBase = new THREE.MeshBasicMaterial({
      color: 0x9cc6dc,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    });

    const buildExactFloorSectionProfile = (x0, x3) => {
      const mesh = this.poolGroup?.userData?.floorMesh;
      const geom = mesh?.geometry;
      const posAttr = geom?.attributes?.position;
      if (!mesh?.isMesh || !geom || !posAttr || posAttr.count < 3) return null;

      mesh.updateMatrixWorld?.(true);
      this.poolGroup.updateMatrixWorld?.(true);
      const toPoolLocal = new THREE.Matrix4()
        .copy(this.poolGroup.matrixWorld)
        .invert()
        .multiply(mesh.matrixWorld);

      const idx = geom.index;
      const epsY = 1e-5;
      const epsX = 1e-4;
      const p0 = new THREE.Vector3();
      const p1 = new THREE.Vector3();
      const p2 = new THREE.Vector3();
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const points = [];

      const pushIfOnCut = (p) => {
        if (Math.abs(p.y - localCutY) > epsY) return;
        if (p.x < x0 - 0.05 || p.x > x3 + 0.05) return;
        points.push({ x: p.x, z: p.z });
      };

      const edgeIntersect = (u, v) => {
        const dy = v.y - u.y;
        if (Math.abs(dy) < epsY) {
          pushIfOnCut(u);
          pushIfOnCut(v);
          return;
        }
        const t = (localCutY - u.y) / dy;
        if (t < -epsY || t > 1 + epsY) return;
        const clampedT = Math.min(1, Math.max(0, t));
        const x = u.x + (v.x - u.x) * clampedT;
        if (x < x0 - 0.05 || x > x3 + 0.05) return;
        const z = u.z + (v.z - u.z) * clampedT;
        points.push({ x, z });
      };

      const triCount = idx ? idx.count / 3 : posAttr.count / 3;
      for (let i = 0; i < triCount; i++) {
        const ia = idx ? idx.getX(i * 3 + 0) : i * 3 + 0;
        const ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
        const ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
        p0.fromBufferAttribute(posAttr, ia).applyMatrix4(toPoolLocal);
        p1.fromBufferAttribute(posAttr, ib).applyMatrix4(toPoolLocal);
        p2.fromBufferAttribute(posAttr, ic).applyMatrix4(toPoolLocal);
        a.copy(p0); b.copy(p1); edgeIntersect(a, b);
        a.copy(p1); b.copy(p2); edgeIntersect(a, b);
        a.copy(p2); b.copy(p0); edgeIntersect(a, b);
      }

      if (points.length < 2) return null;
      points.sort((m, n) => (m.x - n.x) || (m.z - n.z));

      const merged = [];
      for (const p of points) {
        const last = merged[merged.length - 1];
        if (!last || Math.abs(p.x - last.x) > epsX) {
          merged.push({ x: p.x, z: p.z, n: 1 });
        } else {
          // Use the highest cut surface at this x (closest to water plane).
          last.z = Math.max(last.z, p.z);
          last.n += 1;
        }
      }

      const profile = merged
        .filter((p) => p.x >= x0 - 0.01 && p.x <= x3 + 0.01)
        .map((p) => new THREE.Vector2(THREE.MathUtils.clamp(p.x, x0, x3), p.z));

      if (profile.length < 2) return null;
      if (profile[0].x > x0 + 0.01) profile.unshift(new THREE.Vector2(x0, profile[0].y));
      if (profile[profile.length - 1].x < x3 - 0.01) profile.push(new THREE.Vector2(x3, profile[profile.length - 1].y));
      return profile;
    };

    const addProjectedCapFromBounds = (box, matBase, renderOrder = 997, yOffset = 0.006) => {
      if (!box || box.isEmpty()) return;
      if (sectionY < box.min.y - 1e-4 || sectionY > box.max.y + 1e-4) return;
      if ((box.max.x - box.min.x) <= 1e-4 || (box.max.z - box.min.z) <= 1e-4) return;

      const shape = new THREE.Shape([
        new THREE.Vector2(box.min.x, box.max.z),
        new THREE.Vector2(box.max.x, box.max.z),
        new THREE.Vector2(box.max.x, box.min.z),
        new THREE.Vector2(box.min.x, box.min.z)
      ]);
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), matBase.clone());
      cap.rotation.x = Math.PI * 0.5;
      cap.position.set(0, capY, 0);
      cap.renderOrder = renderOrder;
      group.add(cap);
    };

    const addProjectedCapFromMesh = (mesh, matBase, renderOrder = 997, yOffset = 0.006) => {
      if (!mesh?.isMesh || mesh.visible === false) return null;
      mesh.updateMatrixWorld?.(true);
      const box = new THREE.Box3().setFromObject(mesh);
      if (box.isEmpty()) return null;
      addProjectedCapFromBounds(box, matBase, renderOrder, yOffset);
      return box;
    };

    const addSpaSectionCaps = () => {
      const spa = this.spa;
      if (!spa?.traverse) return;
      if ((spa.userData?.spaShape || 'square') === 'circular') return;

      let spaFloorBox = null;
      let spaSupportBox = null;
      const spaWallBoxes = [];
      const spaSeatBoxes = [];

      spa.traverse((obj) => {
        if (!obj?.isMesh) return;
        if (obj.userData?.isSpaFloor) {
          // Keep the floor bounds only. Do not add a separate projected floor
          // cap, because that overlay reads as a false centre band through the
          // spa section.
          if (obj.visible !== false) {
            obj.updateMatrixWorld?.(true);
            const box = new THREE.Box3().setFromObject(obj);
            if (!box.isEmpty()) spaFloorBox = box;
          }
          return;
        }
        if (obj.userData?.isSpaSeat) {
          if (obj.visible !== false) {
            obj.updateMatrixWorld?.(true);
            const box = new THREE.Box3().setFromObject(obj);
            if (!box.isEmpty()) spaSeatBoxes.push(box);
          }
          return;
        }
        if (obj.userData?.isSpaSupport) {
          if (obj.visible !== false) {
            obj.updateMatrixWorld?.(true);
            const box = new THREE.Box3().setFromObject(obj);
            if (!box.isEmpty()) spaSupportBox = box;
          }
          return;
        }
        if (obj.userData?.isSpaWall) {
          const wallBox = addProjectedCapFromMesh(obj, wallCapMatBase, 999, 0.008);
          if (wallBox) spaWallBoxes.push(wallBox);
        }
      });

      // Main spa cap: keep the existing top, align it to the spa floor top,
      // and stretch it 200 mm further downward. This makes the cap taller
      // instead of simply reading as shifted down.
      if (spaSupportBox && !spaSupportBox.isEmpty()) {
        const mainCapBox = spaSupportBox.clone();
        if (spaFloorBox && !spaFloorBox.isEmpty()) {
          mainCapBox.max.z = Math.max(mainCapBox.max.z, spaFloorBox.max.z);
        }
        mainCapBox.min.z -= 0.2;
        addProjectedCapFromBounds(mainCapBox, wallCapMatBase, 1000, 0.009);
      }

      // Restore seat caps, but clamp them to the spa floor top so they run
      // down to the floor and no further.
      if (spaFloorBox && !spaFloorBox.isEmpty() && spaSeatBoxes.length) {
        const floorTopZ = spaFloorBox.max.z;
        spaSeatBoxes.forEach((seatBox) => {
          if (!seatBox || seatBox.isEmpty()) return;
          if (sectionY < seatBox.min.y - 1e-4 || sectionY > seatBox.max.y + 1e-4) return;
          const trimmed = seatBox.clone();
          trimmed.min.z = Math.max(trimmed.min.z, floorTopZ);
          if ((trimmed.max.x - trimmed.min.x) <= 1e-4 || (trimmed.max.z - trimmed.min.z) <= 1e-4) return;
          addProjectedCapFromBounds(trimmed, wallCapMatBase, 1001, 0.010);
        });
      }


      // Do not fabricate a solid under-spa block here. The square spa model
      // only has walls, seats and a floor slab, so the section overlay should
      // cap the actual cut faces only. Filling the full cavity below the spa
      // floor makes the section read as a solid plinth that does not exist in
      // the geometry.
    };

    const addSpaChannelSectionCaps = () => {
      const channelGroup = this.ground?.userData?.spaChannelGroup;
      if (!channelGroup?.traverse) return;

      // Channel floor section-cap adjustments. Positive dimensions are metres.
      // Lift the previous 200 mm drop back up by 50 mm, so the net floor-cap
      // drop is now 150 mm. Pull only the pool-inner edge in by 200 mm while
      // keeping the outside edge fixed.
      const CHANNEL_FLOOR_CAP_DROP = 0.15;
      const CHANNEL_FLOOR_CAP_INNER_TRIM = 0.0;
      const CHANNEL_FLOOR_CAP_OUTER_EXTEND = 0.2;

      const getAdjustedChannelFloorCapBox = (box) => {
        if (!box || box.isEmpty()) return null;
        const adjusted = box.clone();

        adjusted.min.z -= CHANNEL_FLOOR_CAP_DROP;
        adjusted.max.z -= CHANNEL_FLOOR_CAP_DROP;

        const snapSide = String(this.spa?.userData?.snapSide || '').toLowerCase();
        const widthX = adjusted.max.x - adjusted.min.x;
        const trim = Math.min(CHANNEL_FLOOR_CAP_INNER_TRIM, Math.max(0, widthX - 0.02));

        if (snapSide === 'right') {
          // Right-wall spa: keep the pool-inner/left edge as-is and extend only
          // the outside/right edge in the red-arrow direction.
          adjusted.min.x += trim;
          adjusted.max.x += CHANNEL_FLOOR_CAP_OUTER_EXTEND;
        } else if (snapSide === 'left') {
          // Left-wall spa: mirror the same behaviour. Keep the pool-inner/right
          // edge as-is and extend only the outside/left edge.
          adjusted.max.x -= trim;
          adjusted.min.x -= CHANNEL_FLOOR_CAP_OUTER_EXTEND;
        } else {
          // Fallback only for older snap metadata.
          adjusted.min.x += trim * 0.5 - CHANNEL_FLOOR_CAP_OUTER_EXTEND * 0.5;
          adjusted.max.x -= trim * 0.5 + CHANNEL_FLOOR_CAP_OUTER_EXTEND * 0.5;
        }

        return adjusted;
      };

      const addChannelFloorUndersideCap = (box) => {
        const adjusted = getAdjustedChannelFloorCapBox(box);
        if (!adjusted || adjusted.isEmpty()) return;
        if (sectionY < adjusted.min.y - 1e-4 || sectionY > adjusted.max.y + 1e-4) return;
        if ((adjusted.max.x - adjusted.min.x) <= 1e-4) return;
        const bottomZ = adjusted.min.z;
        const topZ = bottomZ + safeWallThickness;
        const shape = new THREE.Shape([
          new THREE.Vector2(adjusted.min.x, topZ),
          new THREE.Vector2(adjusted.max.x, topZ),
          new THREE.Vector2(adjusted.max.x, bottomZ),
          new THREE.Vector2(adjusted.min.x, bottomZ)
        ]);
        const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMatBase.clone());
        cap.rotation.x = Math.PI * 0.5;
        cap.position.set(0, capY, 0);
        cap.renderOrder = 995;
        group.add(cap);
      };

      channelGroup.traverse((obj) => {
        if (!obj?.isMesh || obj.visible === false || !obj.userData?.isSpaChannel) return;
        const part = String(obj.userData?.spaChannelPart || '').toLowerCase();
        if (part !== 'floor' && part !== 'wall') return;
        const matBase = part === 'floor' ? floorMatBase : wallCapMatBase;
        const renderOrder = part === 'floor' ? 996 : 997;
        const yOffset = part === 'floor' ? 0.006 : 0.007;

        if (part === 'floor') {
          obj.updateMatrixWorld?.(true);
          const floorBox = new THREE.Box3().setFromObject(obj);
          const adjustedFloorBox = getAdjustedChannelFloorCapBox(floorBox);
          if (adjustedFloorBox && !adjustedFloorBox.isEmpty()) {
            addProjectedCapFromBounds(adjustedFloorBox, matBase, renderOrder, yOffset);
          }
          addChannelFloorUndersideCap(floorBox);
          return;
        }

        addProjectedCapFromMesh(obj, matBase, renderOrder, yOffset);
      });
    };

    const addStepSectionCaps = () => {
      if (!this.poolGroup?.traverse) return;

      const stepBoxes = [];
      this.poolGroup.traverse((obj) => {
        if (!obj?.isMesh || obj.visible === false || !obj.userData?.isStep) return;
        // Steps are separate solid meshes. The section overlay needs a face cap
        // where the void cuts through each tread/riser volume.
        const box = addProjectedCapFromMesh(obj, wallCapMatBase, 999, 0.008);
        if (box && !box.isEmpty()) stepBoxes.push(box);
      });

      // Also extend the stair cap down to the pool floor so the section reads
      // as a continuous stepped mass rather than stopping at each tread block.
      // Use the runtime pool depth profile (not the locally raised floor under
      // the step footprint) so the cap reaches the actual pool floor level.
      stepBoxes.forEach((box) => {
        if (!box || box.isEmpty()) return;
        const centerX = (box.min.x + box.max.x) * 0.5;
        const floorTopZ = depthAtX(centerX);
        if (!Number.isFinite(floorTopZ)) return;
        if (floorTopZ >= box.min.z - 1e-4) return;
        const extended = box.clone();
        extended.min.z = floorTopZ;
        addProjectedCapFromBounds(extended, wallCapMatBase, 998, 0.0075);
      });
    };

    const shouldHideSpaSidePoolWallCap = (() => {
      const spa = this.spa;
      if (!spa) return { left: false, right: false };
      const snapSide = String(spa.userData?.snapSide || '').toLowerCase();
      const hideOnSpaSide = !!(
        spa.userData?.isHalfwayInWall ||
        spa.userData?.channelEnabled ||
        String(spa.userData?.snapVariant || '').toLowerCase() !== 'inner-flush'
      );
      if (!hideOnSpaSide) return { left: false, right: false };
      const spaBounds = new THREE.Box3().setFromObject(spa);
      const intersectsSection = !spaBounds.isEmpty() && sectionY >= (spaBounds.min.y - 1e-4) && sectionY <= (spaBounds.max.y + 1e-4);
      if (!intersectsSection) return { left: false, right: false };
      return {
        left: snapSide === 'left',
        right: snapSide === 'right'
      };
    })();

    const addSectionBand = (x0, x3, includeWaterTint = true) => {
      const leftDepth = depthAtX(x0);
      const rightDepth = depthAtX(x3);
      const slabExtend = 0.0;
      const x0Ext = x0 - slabExtend;
      const x3Ext = x3 + slabExtend;
      // Match the standard rectangle pool cap path for every pool shape.
      // Do not sample the clipped/custom floor mesh here: sparse/curved/freeform
      // floor meshes can return irregular section points and make the concrete
      // cap drift away from the intended 1 m flat + slope + 1 m flat profile.
      const sampleCount = Math.max(12, Math.min(64, Math.ceil((x3Ext - x0Ext) / 0.2)));
      const topProfile = [];
      for (let i = 0; i <= sampleCount; i++) {
        const t = i / sampleCount;
        const x = THREE.MathUtils.lerp(x0Ext, x3Ext, t);
        topProfile.push(new THREE.Vector2(x, depthAtX(x)));
      }

      if (includeWaterTint) {
        const waterTintShape = new THREE.Shape([
          new THREE.Vector2(x0Ext, 0),
          new THREE.Vector2(x3Ext, 0),
          ...topProfile.slice().reverse()
        ]);
        const waterTint = new THREE.Mesh(new THREE.ShapeGeometry(waterTintShape), waterTintMatBase.clone());
        waterTint.rotation.x = Math.PI * 0.5;
        waterTint.position.set(0, sectionFaceY + 0.0005, 0);
        waterTint.renderOrder = 994;
        group.add(waterTint);
      }

      const exactLeftDepth = topProfile[0]?.y;
      const exactRightDepth = topProfile[topProfile.length - 1]?.y;
      const resolvedLeftDepth = Number.isFinite(exactLeftDepth) ? exactLeftDepth : leftDepth;
      const resolvedRightDepth = Number.isFinite(exactRightDepth) ? exactRightDepth : rightDepth;

      const floorProfile = [
        ...topProfile,
        ...topProfile.slice().reverse().map((p) => new THREE.Vector2(p.x, p.y - safeWallThickness))
      ];
      const floorCap = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(floorProfile)), floorMatBase.clone());
      floorCap.rotation.x = Math.PI * 0.5;
      floorCap.position.set(0, capY, 0);
      floorCap.renderOrder = 996;
      group.add(floorCap);


      const leftWallShape = new THREE.Shape([
        new THREE.Vector2(x0 - safeWallThickness, 0),
        new THREE.Vector2(x0, 0),
        new THREE.Vector2(x0, resolvedLeftDepth - safeWallThickness),
        new THREE.Vector2(x0 - safeWallThickness, resolvedLeftDepth - safeWallThickness)
      ]);
      if (!shouldHideSpaSidePoolWallCap.left) {
        const leftWallCap = new THREE.Mesh(new THREE.ShapeGeometry(leftWallShape), wallCapMatBase.clone());
        leftWallCap.rotation.x = Math.PI * 0.5;
        leftWallCap.position.set(0, capY, 0);
        leftWallCap.renderOrder = 997;
        group.add(leftWallCap);
      }

      const rightWallShape = new THREE.Shape([
        new THREE.Vector2(x3, 0),
        new THREE.Vector2(x3 + safeWallThickness, 0),
        new THREE.Vector2(x3 + safeWallThickness, resolvedRightDepth - safeWallThickness),
        new THREE.Vector2(x3, resolvedRightDepth - safeWallThickness)
      ]);
      if (!shouldHideSpaSidePoolWallCap.right) {
        const rightWallCap = new THREE.Mesh(new THREE.ShapeGeometry(rightWallShape), wallCapMatBase.clone());
        rightWallCap.rotation.x = Math.PI * 0.5;
        rightWallCap.position.set(0, capY, 0);
        rightWallCap.renderOrder = 997;
        group.add(rightWallCap);
      }

      const copingLeftShape = new THREE.Shape([
        new THREE.Vector2(x0 - safeWallThickness, 0),
        new THREE.Vector2(Math.min(x0 + copingInset, x3), 0),
        new THREE.Vector2(Math.min(x0 + copingInset, x3), 0.05),
        new THREE.Vector2(x0 - safeWallThickness, 0.05)
      ]);
      if (!shouldHideSpaSidePoolWallCap.left) {
        const copingLeftCap = new THREE.Mesh(new THREE.ShapeGeometry(copingLeftShape), copingCapMatBase.clone());
        copingLeftCap.rotation.x = Math.PI * 0.5;
        copingLeftCap.position.set(0, capY, 0);
        copingLeftCap.renderOrder = 998;
        group.add(copingLeftCap);
      }

      const copingRightShape = new THREE.Shape([
        new THREE.Vector2(Math.max(x3 - copingInset, x0), 0),
        new THREE.Vector2(x3 + safeWallThickness, 0),
        new THREE.Vector2(x3 + safeWallThickness, 0.05),
        new THREE.Vector2(Math.max(x3 - copingInset, x0), 0.05)
      ]);
      if (!shouldHideSpaSidePoolWallCap.right) {
        const copingRightCap = new THREE.Mesh(new THREE.ShapeGeometry(copingRightShape), copingCapMatBase.clone());
        copingRightCap.rotation.x = Math.PI * 0.5;
        copingRightCap.position.set(0, capY, 0);
        copingRightCap.renderOrder = 998;
        group.add(copingRightCap);
      }
    };

    if (intervals.length) {
      intervals.forEach(([x0, x3]) => addSectionBand(x0, x3, true));
      const minIntervalX = Math.min(...intervals.map((p) => p[0]));
      const maxIntervalX = Math.max(...intervals.map((p) => p[1]));
      const underFloorMaskBottom = -Math.max(clampedDeep, 1) - safeWallThickness - 2;
      this.sectionUnderfloorClipConfig = {
        cutY: sectionY,
        halfWidth: Math.max(0.15, (sectionFloorWidth || size.y || 0.6) * 0.5 + 0.35),
        minX: minIntervalX - safeWallThickness - 0.05,
        maxX: maxIntervalX + safeWallThickness + 0.05,
        x1,
        x2,
        topZ0: -clampedShallow - safeWallThickness + 0.01,
        topZ1: -clampedShallow - safeWallThickness + 0.01,
        topZ2: -clampedDeep - safeWallThickness + 0.01,
        bottomZ: underFloorMaskBottom
      };
    } else {
      this.sectionUnderfloorClipConfig = null;
    }

    addStepSectionCaps();
    addSpaSectionCaps();
    addSpaChannelSectionCaps();

    this.scene.add(group);
    this.sectionViewOverlay = group;
  }


  _getSectionCutY() {
    // Use the pool floor centreline as the section cut reference for every pool
    // type. Expanding the whole poolGroup can include handles, stairs, custom
    // curved edges, or L-shape notches and can shift the cut line away from the
    // rectangle pool's normal centre section.
    const floorMesh = this.poolGroup?.userData?.floorMesh || null;
    if (floorMesh?.isMesh) {
      floorMesh.updateMatrixWorld?.(true);
      const floorBounds = new THREE.Box3().setFromObject(floorMesh);
      if (!floorBounds.isEmpty()) {
        return floorBounds.getCenter(new THREE.Vector3()).y;
      }
    }

    const outerPts = Array.isArray(this.poolGroup?.userData?.outerPts) ? this.poolGroup.userData.outerPts : [];
    if (outerPts.length) {
      const bb = new THREE.Box2();
      outerPts.forEach((p) => {
        if (!p) return;
        bb.expandByPoint(p?.isVector2 ? p : new THREE.Vector2(Number(p.x) || 0, Number(p.y) || 0));
      });
      if (Number.isFinite(bb.min.y) && Number.isFinite(bb.max.y)) {
        return ((bb.min.y + bb.max.y) * 0.5) + (this.poolGroup?.position?.y || 0);
      }
    }

    const bounds = new THREE.Box3();
    if (this.poolGroup) bounds.expandByObject(this.poolGroup);
    if (bounds.isEmpty()) {
      const fallback = new THREE.Box3();
      if (this.poolGroup) fallback.expandByObject(this.poolGroup);
      if (this.spa) fallback.expandByObject(this.spa);
      if (fallback.isEmpty()) return 0;
      return fallback.getCenter(new THREE.Vector3()).y;
    }
    return bounds.getCenter(new THREE.Vector3()).y;
  }

  _trimPoolWallOnSpaSideAtSection(sectionY, enabled) {
    if (!this.poolGroup?.traverse) return;

    const spa = this.spa;
    const snapSide = String(spa?.userData?.snapSide || '').toLowerCase();
    const spaCutsPoolWall = !!(
      spa?.userData?.isHalfwayInWall ||
      spa?.userData?.channelEnabled ||
      String(spa?.userData?.snapVariant || '').toLowerCase() !== 'inner-flush'
    );

    this.poolGroup.traverse((obj) => {
      if (!obj?.isMesh) return;
      if (!obj.userData?.isWall) return;

      const side = String(obj.userData?.side || '').toLowerCase();
      const isTarget =
        (snapSide === 'left' && side === 'west') ||
        (snapSide === 'right' && side === 'east') ||
        (snapSide === 'front' && side === 'south') ||
        (snapSide === 'back' && side === 'north');

      if (!obj.userData.__sectionOriginalGeometry) {
        obj.userData.__sectionOriginalGeometry = obj.geometry;
        obj.userData.__sectionOriginalPosition = obj.position.clone();
      }

      const restore = () => {
        if (obj.userData.__sectionOriginalGeometry && obj.geometry !== obj.userData.__sectionOriginalGeometry) {
          obj.geometry.dispose?.();
          obj.geometry = obj.userData.__sectionOriginalGeometry;
        }
        if (obj.userData.__sectionOriginalPosition) {
          obj.position.copy(obj.userData.__sectionOriginalPosition);
        }
        obj.visible = true;
      };

      if (!enabled || !spaCutsPoolWall || !isTarget) {
        restore();
        return;
      }

      const originalGeo = obj.userData.__sectionOriginalGeometry;
      originalGeo.computeBoundingBox?.();
      const bb = originalGeo.boundingBox;
      if (!bb) {
        restore();
        return;
      }

      // Only east/west walls need shortening along local Y to match the section cut.
      // North/south walls are already handled by the front-shell hide path.
      if (!(side === 'west' || side === 'east')) {
        restore();
        return;
      }

      const parent = obj.parent;
      if (!parent) {
        restore();
        return;
      }

      const cutLocal = parent.worldToLocal(new THREE.Vector3(0, sectionY, 0)).y;
      const minY = bb.min.y;
      const maxY = bb.max.y;

      // Keep only the half behind the section cut: local Y >= cutLocal.
      const keepMinY = Math.max(minY, cutLocal);
      const keepMaxY = maxY;
      const keptWidthY = keepMaxY - keepMinY;

      if (!(keptWidthY > 1e-4)) {
        obj.visible = false;
        return;
      }

      const sizeX = bb.max.x - bb.min.x;
      const sizeZ = bb.max.z - bb.min.z;

      const trimmedGeo = new THREE.BoxGeometry(sizeX, keptWidthY, sizeZ);
      if (obj.geometry !== originalGeo) {
        obj.geometry.dispose?.();
      }
      obj.geometry = trimmedGeo;

      if (obj.userData.__sectionOriginalPosition) {
        obj.position.copy(obj.userData.__sectionOriginalPosition);
      }
      obj.position.y = (keepMinY + keepMaxY) * 0.5;
      obj.visible = true;
    });
  }

  _getSectionPresentationBounds() {
    const bounds = new THREE.Box3();
    [
      this.poolGroup,
      this.spa,
      this.ground?.userData?.spaChannelGroup,
      this.ground?.userData?.spaChannelWaterGroup
    ].filter(Boolean).forEach((root) => bounds.expandByObject(root));
    return bounds;
  }

  _moveCameraToCurrentSectionPosition(duration = 0.45) {
    if (!this.camera || !this.controls) return;
    const bounds = this._getSectionPresentationBounds();
    if (bounds.isEmpty()) return;
    const fit = this._getSectionCameraFit(bounds);
    this._setSectionControlsLocked(false);
    this.animateCameraTo(fit.position, fit.target, duration, () => {
      if (this.sectionViewEnabled) this._setSectionControlsLocked(true, fit.distance);
    });
  }

  setSectionViewEnabled(enabled) {
    if (!this.renderer || !this.camera || !this.controls) return;
    if (enabled === this.sectionViewEnabled) {
      // Re-clicking/opening the dimensions panel while section mode is already
      // active should still force the camera back to the section view. This fixes
      // the intermittent case where the section/caps are active but the pool stays
      // in the previous camera position.
      if (enabled) {
        this._refreshSectionViewPresentation();
        this._moveCameraToCurrentSectionPosition(0.35);
      }
      return;
    }

    const waters = [
      this.poolGroup?.userData?.waterMesh,
      this.spa?.userData?.waterMesh,
      this.ground?.userData?.spaChannelWaterGroup
    ].filter(Boolean);

    if (enabled) {
      const bounds = this._getSectionPresentationBounds();
      if (bounds.isEmpty()) return;

      const center = bounds.getCenter(new THREE.Vector3());
      this.sectionViewSavedCamera = {
        position: this.camera.position.clone(),
        target: this.controls.target.clone()
      };

      // Keep the live model and add the current section void box on top of
      // the existing spa void system. Re-enable only the section cap/floor-mask
      // helpers from the C4.3 trim patch so cut faces and floor masking are restored.
      this._setSectionOverlay(null, false);
      this._setSectionUnderfloorClip(this.poolGroup, null);
      this._setSectionFrontShellHidden(0, false);
      this._trimPoolWallOnSpaSideAtSection(0, false);
      waters.forEach((root) => this._setSectionHidden(root, false));
      waters.forEach((root) => this._setSectionWaterClip(root, null));
      const wallThickness = Math.max(0.05, this.poolGroup?.userData?.wallThickness || 0.2);
      const sectionCutY = this._getSectionCutY();
      // TEST: do not rebuild spa wall/channel voids during section entry.
      // Spa-in-wall placement already applied these voids before section mode;
      // rebuilding them here can replace channel meshes/material clipping mid-toggle.
      // this._refreshSpaVoidsForSection();
      this._enableSectionVoidClip(sectionCutY);
      this._setSectionFrontShellHidden(sectionCutY, true);
      this._trimPoolWallOnSpaSideAtSection(sectionCutY, true);
      this._setSectionOverlay(bounds, true, sectionCutY, wallThickness);
      this._setSectionUnderfloorClip(this.poolGroup, this.sectionUnderfloorClipConfig || null);
      this.sectionViewSignature = this._getSectionViewSignature();

      const fit = this._getSectionCameraFit(bounds);
      this._setSectionControlsLocked(false);
      this.animateCameraTo(fit.position, fit.target, 0.6, () => {
        if (this.sectionViewEnabled) this._setSectionControlsLocked(true, fit.distance);
      });
    } else {
      this._setSectionControlsLocked(false);
      waters.forEach((root) => {
        this._setSectionWaterClip(root, null);
        this._setSectionHidden(root, false);
      });
      [this.poolGroup, this.spa, this.ground?.userData?.spaChannelGroup].filter(Boolean).forEach((root) => this._setSectionShellClip(root, null));
      this._disableSectionVoidClip();
      this._trimPoolWallOnSpaSideAtSection(0, false);
      this._setSectionUnderfloorClip(this.poolGroup, null);
      this._setSectionFrontShellHidden(0, false);
      this._setSectionOverlay(null, false);
      if (this.sectionViewSavedCamera) {
        this.animateCameraTo(this.sectionViewSavedCamera.position, this.sectionViewSavedCamera.target, 0.45);
      }
      this.sectionViewClipPlane = null;
      this.sectionViewSignature = "";
    }

    this.sectionViewEnabled = enabled;
    this._syncSectionSelectionEffects();
  }

  _getSectionViewSignature() {
    const p = this.poolParams || {};
    return [
      this.poolGroup?.uuid || '',
      this.spa?.uuid || '',
      p.shape || '',
      p.length ?? '',
      p.width ?? '',
      p.shallow ?? '',
      p.deep ?? '',
      p.shallowFlat ?? '',
      p.deepFlat ?? '',
      p.stepCount ?? '',
      p.stepDepth ?? '',
      p.stepWidth ?? '',
      p.stepPosition ?? '',
      p.stepWall ?? '',
      p.stepShape ?? '',
      p.stepBenchMode ?? ''
    ].join('|');
  }

  _refreshSectionViewPresentation() {
    if (!this.sectionViewEnabled || !this.poolGroup) return;
    const bounds = this._getSectionPresentationBounds();
    if (bounds.isEmpty()) return;

    const sectionCutY = this._getSectionCutY();
    const waters = [
      this.poolGroup?.userData?.waterMesh,
      this.spa?.userData?.waterMesh,
      this.ground?.userData?.spaChannelWaterGroup
    ].filter(Boolean);

    // Refresh the additive section void while preserving normal spa voids,
    // then rebuild only the caps/floor mask/trim helpers from the C4.3 patch.
    this._setSectionOverlay(null, false);
    this._setSectionUnderfloorClip(this.poolGroup, null);
    this._setSectionFrontShellHidden(0, false);
    this._trimPoolWallOnSpaSideAtSection(0, false);
    waters.forEach((root) => this._setSectionHidden(root, false));
    waters.forEach((root) => this._setSectionWaterClip(root, null));
    const wallThickness = Math.max(0.05, this.poolGroup?.userData?.wallThickness || 0.2);
    // TEST: do not rebuild spa wall/channel voids during section refresh.
    // this._refreshSpaVoidsForSection();
    this._enableSectionVoidClip(sectionCutY);
    this._setSectionFrontShellHidden(sectionCutY, true);
    this._trimPoolWallOnSpaSideAtSection(sectionCutY, true);
    this._setSectionOverlay(bounds, true, sectionCutY, wallThickness);
    this._setSectionUnderfloorClip(this.poolGroup, this.sectionUnderfloorClipConfig || null);
    this.sectionViewSignature = this._getSectionViewSignature();
  }


  async _refreshSectionViewAfterGeometryEdit({ moveCamera = false, fullReset = false } = {}) {
    if (!this.sectionViewEnabled || !this.poolGroup) return;
    const seq = ++this.sectionViewRefreshSeq;

    const waitFrame = () => new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });

    const teardownSectionPresentation = () => {
      const waters = [
        this.poolGroup?.userData?.waterMesh,
        this.spa?.userData?.waterMesh,
        this.ground?.userData?.spaChannelWaterGroup
      ].filter(Boolean);

      this._setSectionOverlay(null, false);
      this._setSectionUnderfloorClip(this.poolGroup, null);
      this._setSectionFrontShellHidden(0, false);
      this._trimPoolWallOnSpaSideAtSection(0, false);
      waters.forEach((root) => {
        this._setSectionWaterClip(root, null);
        this._setSectionHidden(root, false);
      });
      this._disableSectionVoidClip();
    };

    const applySectionPresentation = () => {
      if (seq !== this.sectionViewRefreshSeq || !this.sectionViewEnabled || !this.poolGroup) return;
      // TEST: avoid spa wall/channel void rebuild while section presentation is active.
      // The live spa void state is preserved; only section caps/void-box are refreshed.
      // try { updatePoolWaterVoid(this.poolGroup, this.spa); } catch (_) {}
      // try { updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa); } catch (_) {}
      // try { this._refreshSpaVoidsForSection(); } catch (_) {}
      try { this._refreshSectionViewPresentation(); } catch (_) {}
      try { this._syncSectionSelectionEffects(); } catch (_) {}
      try { this._updateSectionDimensionHandles(); } catch (_) {}
      try { this._updateSpaDimensionHandles(); } catch (_) {}
      if (moveCamera) {
        try { this._moveCameraToCurrentSectionPosition(0.25); } catch (_) {}
      }
    };

    // For edits made while section view is active, a light uniform update is not
    // enough: pool/spa/channel rebuilds can replace meshes/materials after the
    // first pointer-up tick. Fully tear down the section-only helpers, let the
    // rebuild/material swaps settle, then rebuild the section presentation from
    // the current live geometry.
    if (fullReset) {
      teardownSectionPresentation();
      await waitFrame();
      if (seq !== this.sectionViewRefreshSeq) return;
      applySectionPresentation();
      await waitFrame();
      if (seq !== this.sectionViewRefreshSeq) return;
      applySectionPresentation();
      return;
    }

    applySectionPresentation();
    await waitFrame();
    if (seq !== this.sectionViewRefreshSeq) return;
    applySectionPresentation();
  }

  _getSectionCameraFit(bounds, padding = 1.18) {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const cam = this.camera;
    const aspect = Math.max(0.01, cam?.aspect || (this.renderer?.domElement?.clientWidth || 1) / Math.max(1, this.renderer?.domElement?.clientHeight || 1));
    const vFovRad = THREE.MathUtils.degToRad(Math.max(1, cam?.fov || 45));
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad * 0.5) * aspect);
    const halfWidth = Math.max(0.5, size.x * 0.5);
    const halfHeight = Math.max(0.5, size.z * 0.5);
    const distForWidth = halfWidth / Math.max(Math.tan(hFovRad * 0.5), 1e-4);
    const distForHeight = halfHeight / Math.max(Math.tan(vFovRad * 0.5), 1e-4);
    const distance = Math.max(4.5, distForWidth, distForHeight) * padding;
    const target = new THREE.Vector3(center.x, center.y, center.z);
    const position = new THREE.Vector3(center.x, bounds.min.y - distance, center.z);
    return { position, target, distance };
  }

  _setSectionControlsLocked(locked, lockedDistance = null) {
    const ctrl = this.controls;
    if (!ctrl) return;

    if (!ctrl.userData) ctrl.userData = {};

    // In section view we want the camera framing to stay stable.
    // Lock orbit controls by disabling rotate/pan and clamping zoom to the
    // current camera-target distance. We keep zoom "enabled" so wheel/touch
    // events are still captured (preventing page scroll), but distance cannot
    // actually change while locked.
    const cam = this.camera;
    const currentDistance = Number.isFinite(lockedDistance)
      ? lockedDistance
      : ((cam && ctrl.target)
        ? cam.position.distanceTo(ctrl.target)
        : null);

    if (locked) {
      if (!ctrl.userData.__sectionLockPrev) {
        ctrl.userData.__sectionLockPrev = {
          enabled: ctrl.enabled,
          enablePan: ctrl.enablePan,
          enableRotate: ctrl.enableRotate,
          enableZoom: ctrl.enableZoom,
          minDistance: ctrl.minDistance,
          maxDistance: ctrl.maxDistance,
          mouseButtons: { ...(ctrl.mouseButtons || {}) },
          touches: { ...(ctrl.touches || {}) },
          keys: Array.isArray(ctrl.keys) ? [...ctrl.keys] : ctrl.keys
        };
      }

      // Hard lock interaction.
      ctrl.enabled = true;
      ctrl.enablePan = false;
      ctrl.enableRotate = false;

      // Clamp zoom to current distance so wheel/touch doesn't move the page,
      // but camera distance stays fixed.
      if (currentDistance != null && Number.isFinite(currentDistance)) {
        ctrl.enableZoom = true;
        ctrl.minDistance = currentDistance;
        ctrl.maxDistance = currentDistance;
      }

      ctrl.mouseButtons = {
        LEFT: -1,
        MIDDLE: -1,
        RIGHT: -1
      };
      if (ctrl.touches) {
        ctrl.touches = {
          ONE: -1,
          // Keep TWO mapped so touchmove is captured (but zoom is clamped).
          TWO: THREE.TOUCH.DOLLY_PAN
        };
      }
      if (Array.isArray(ctrl.keys)) ctrl.keys = [];
    } else if (ctrl.userData.__sectionLockPrev) {
      const prev = ctrl.userData.__sectionLockPrev;
      if (prev.enabled !== undefined) ctrl.enabled = prev.enabled;
      ctrl.enablePan = prev.enablePan;
      ctrl.enableRotate = prev.enableRotate;
      if (prev.enableZoom !== undefined) ctrl.enableZoom = prev.enableZoom;
      if (prev.minDistance !== undefined) ctrl.minDistance = prev.minDistance;
      if (prev.maxDistance !== undefined) ctrl.maxDistance = prev.maxDistance;
      if (prev.mouseButtons) ctrl.mouseButtons = { ...prev.mouseButtons };
      if (prev.touches) ctrl.touches = { ...prev.touches };
      if (prev.keys !== undefined) ctrl.keys = Array.isArray(prev.keys) ? [...prev.keys] : prev.keys;
      delete ctrl.userData.__sectionLockPrev;
    }

    ctrl.update?.();
  }

  animateCameraTo(newPos, newTarget, duration = 0.8, onComplete = null) {
    const cam = this.camera;
    const ctrl = this.controls;
    if (!cam || !ctrl || !newPos || !newTarget) return;

    const startPos = cam.position.clone();
    const startTarget = ctrl.target.clone();
    const startTime = performance.now();

    const animateCam = (now) => {
      const t = Math.min(1, (now - startTime) / (duration * 1000));
      const k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      cam.position.lerpVectors(startPos, newPos, k);
      ctrl.target.lerpVectors(startTarget, newTarget, k);
      ctrl.update();

      if (t < 1) {
        requestAnimationFrame(animateCam);
      } else if (typeof onComplete === 'function') {
        onComplete();
      }
    };

    requestAnimationFrame(animateCam);
  }

  focusCameraOnPoolShape() {
    if (!this.poolGroup || !this.camera || !this.controls) return;

    const bounds = new THREE.Box3().setFromObject(this.poolGroup);
    if (bounds.isEmpty()) return;

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    const halfVFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const halfHFov = Math.atan(Math.tan(halfVFov) * this.camera.aspect);

    const fitX = (size.x * 0.5) / Math.max(Math.tan(halfHFov), 0.01);
    const fitY = (size.y * 0.5) / Math.max(Math.tan(halfVFov), 0.01);
    const distance = Math.max(fitX, fitY) * 1.3 + Math.max(size.z, 1.5);
    const tinyYOffset = Math.max(size.y * 0.002, 0.01);

    const target = center.clone();
    const newPos = new THREE.Vector3(center.x, center.y - tinyYOffset, center.z + distance);

    this.animateCameraTo(newPos, target, 0.8);
  }

  getStarterModelViewBounds() {
    const bounds = new THREE.Box3();
    let hasBounds = false;

    const expandByObject = (obj) => {
      if (!obj) return;
      const objBounds = new THREE.Box3().setFromObject(obj);
      if (objBounds.isEmpty()) return;
      bounds.union(objBounds);
      hasBounds = true;
    };

    expandByObject(this.poolGroup);
    expandByObject(this.spa);

    return hasBounds ? bounds : null;
  }

  focusCameraLikeStarterPreview(preset = null, { animate = false } = {}) {
    if (!this.camera || !this.controls) return;

    const bounds = this.getStarterModelViewBounds();
    if (!bounds) return;

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z, 1);
    const directionValues = preset?.previewCamera?.direction || [1, -1, 0.75];
    const direction = new THREE.Vector3(
      Number(directionValues[0]) || 1,
      Number(directionValues[1]) || -1,
      Number(directionValues[2]) || 0.75
    ).normalize();

    // Axonometric-style opening view: keep the same direction as the starter
    // cards, but use a very narrow perspective lens and a much longer camera
    // distance so the model reads like a parallel/orthographic axonometric
    // projection when the pool first opens.
    if (this.camera.isPerspectiveCamera) {
      this.camera.fov = 10;
      this.camera.aspect = Math.max(0.01, this.renderer?.domElement?.clientWidth || window.innerWidth) /
        Math.max(1, this.renderer?.domElement?.clientHeight || window.innerHeight);
    }
    const halfVFov = THREE.MathUtils.degToRad((this.camera.fov || 10) * 0.5);
    const distance = Math.max(maxSize * 0.92, (maxSize * 0.58) / Math.max(Math.tan(halfVFov), 0.01));
    const offset = direction.clone().multiplyScalar(distance);
    const target = center.clone();
    const newPos = new THREE.Vector3(
      center.x + offset.x,
      center.y + offset.y,
      center.z + offset.z
    );

    this.camera.up.set(0, 0, 1);
    this.camera.near = 0.05;
    this.camera.far = Math.max(500, distance * 10);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();

    if (animate) {
      this.animateCameraTo(newPos, target, 0.45);
    } else {
      this.camera.position.copy(newPos);
      this.camera.lookAt(target);
      this.controls.target.copy(target);
      this.controls.update();
    }
  }

  openStarterModelView(preset = null) {
    if (this.sectionViewEnabled) {
      try { this.setSectionViewEnabled(false); } catch (_) {}
    }

    if (typeof window.closePanelsFromCode === "function") {
      window.closePanelsFromCode();
    } else {
      document.querySelectorAll(".side-panel.open").forEach((panel) => panel.classList.remove("open"));
      document.querySelectorAll(".icon-btn.active").forEach((button) => button.classList.remove("active"));
      document.dispatchEvent(new CustomEvent("activePanelChanged", { detail: { panelName: null } }));
    }

    this.focusCameraLikeStarterPreview(preset, { animate: false });
  }


  focusCameraOnWall(wall) {
    if (!wall || !this.poolGroup || !this.camera || !this.controls) return;

    const wallBounds = new THREE.Box3().setFromObject(wall);
    const poolBounds = new THREE.Box3().setFromObject(this.poolGroup);
    if (wallBounds.isEmpty() || poolBounds.isEmpty()) return;

    const wallCenter = wallBounds.getCenter(new THREE.Vector3());
    const wallSize = wallBounds.getSize(new THREE.Vector3());
    const poolCenter = poolBounds.getCenter(new THREE.Vector3());

    const posAttr = wall.geometry?.attributes?.position;
    let tangent2 = null;
    if (posAttr && posAttr.count >= 2) {
      let meanX = 0;
      let meanY = 0;
      for (let i = 0; i < posAttr.count; i++) {
        const wp = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(wall.matrixWorld);
        meanX += wp.x;
        meanY += wp.y;
      }
      meanX /= posAttr.count;
      meanY /= posAttr.count;

      let xx = 0;
      let xy = 0;
      let yy = 0;
      for (let i = 0; i < posAttr.count; i++) {
        const wp = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(wall.matrixWorld);
        const dx = wp.x - meanX;
        const dy = wp.y - meanY;
        xx += dx * dx;
        xy += dx * dy;
        yy += dy * dy;
      }

      const trace = xx + yy;
      const det = xx * yy - xy * xy;
      const disc = Math.max(0, trace * trace * 0.25 - det);
      const lambda = trace * 0.5 + Math.sqrt(disc);
      tangent2 = Math.abs(xy) > 1e-8
        ? new THREE.Vector2(lambda - yy, xy)
        : (xx >= yy ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1));

      if (tangent2.lengthSq() > 1e-8) tangent2.normalize();
      else tangent2 = null;
    }

    if (!tangent2) {
      const dx = wallSize.x;
      const dy = wallSize.y;
      tangent2 = dx >= dy ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1);
    }

    let inward2 = new THREE.Vector2(-tangent2.y, tangent2.x);
    const toPoolCenter2 = new THREE.Vector2(poolCenter.x - wallCenter.x, poolCenter.y - wallCenter.y);
    if (toPoolCenter2.lengthSq() > 1e-8 && inward2.dot(toPoolCenter2) < 0) {
      inward2.multiplyScalar(-1);
    }
    if (inward2.lengthSq() < 1e-8) inward2.set(0, -1);
    inward2.normalize();

    const poolSize = poolBounds.getSize(new THREE.Vector3());

    // Estimate the visible wall span in plan from the tangent direction
    const wallSpan =
      Math.abs(tangent2.x) * wallSize.x +
      Math.abs(tangent2.y) * wallSize.y;

    // Camera-fit distance from FOV so the full wall is visible
    const halfVFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const halfHFov = Math.atan(Math.tan(halfVFov) * this.camera.aspect);

    const fitByWidth = (wallSpan * 0.5) / Math.max(Math.tan(halfHFov), 0.01);
    const fitByHeight = (Math.max(wallSize.z, 1.2) * 0.5) / Math.max(Math.tan(halfVFov), 0.01);

    // Match the wider full-wall framing from the 2.8 reference, but keep a slightly raised viewpoint
    const standoff = Math.max(
      6.5,
      Math.min(Math.max(fitByWidth, fitByHeight) * 2.2, 14.0)
    );

    // Slightly higher camera with a gentle downward look
    const eyeHeight = Math.max(0.90, Math.min(1.45, wallSize.z * 0.38));
    const targetHeight = Math.max(
      wallBounds.min.z + wallSize.z * 0.20,
      Math.min(wallBounds.min.z + wallSize.z * 0.30, 0.70)
    );

    const target = new THREE.Vector3(wallCenter.x, wallCenter.y, targetHeight);
    const newPos = new THREE.Vector3(
      wallCenter.x + inward2.x * standoff,
      wallCenter.y + inward2.y * standoff,
      eyeHeight
    );

    this.animateCameraTo(newPos, target, 0.55);
  }

  setCausticsSizeMultiplier(mult) {
    this.caustics?.setSizeMultiplier?.(mult);
  }

  setCausticsSpeedMultiplier(mult) {
    this.caustics?.setSpeedMultiplier?.(mult);
  }

  setCausticsIntensity(intensity) {
    this.caustics?.setIntensity?.(intensity);
  }


  // --------------------------------------------------------------
  // INTERNAL: remove poolGroup safely without disposing PBR-managed textures
  // (dispose geometry only; PBRManager owns texture/material lifecycle)
  // --------------------------------------------------------------
  _removePoolGroupSafely(group) {
    if (!group) return;

    try {
      if (group.parent) group.parent.remove(group);
      else if (this.scene) this.scene.remove(group);
    } catch (_) {}

    // Dispose geometries only (avoid disposing materials/textures that may be re-used)
    group.traverse((o) => {
      if (!o || !o.isMesh) return;
      try { o.geometry?.dispose?.(); } catch (_) {}
    });
  }

  // --------------------------------------------------------------
  // INTERNAL: coalesce expensive PBR re-application so we do not race
  // against rapid polygon edits (prevents tiles disappearing after edits)
  // --------------------------------------------------------------
  _schedulePBRApply() {
    if (!this.pbrManager || !this.poolGroup) return;

    const token = (this._pbrApplyToken = (this._pbrApplyToken || 0) + 1);
    const targetGroup = this.poolGroup;

    requestAnimationFrame(async () => {
      if (token !== this._pbrApplyToken) return;
      if (!this.pbrManager || this.poolGroup !== targetGroup) return;

      this.pbrManager.setPoolGroup(this.poolGroup);
      this.pbrManager.updatePoolParamsRef(this.poolParams);

      try {
        await this.pbrManager.applyCurrentToGroup();
      
        // Ensure caustics are attached after PBR materials are created/updated
        this.caustics?.attachToGroup?.(this.poolGroup);
} catch (_) {}

      if (token !== this._pbrApplyToken) return;

      if (this.spa) {
        try {
          this.spa.userData.poolGroup = this.poolGroup || null;
          this.spa.userData.poolParams = this.poolParams;
          snapToPool(this.spa);
          updateSpa(this.spa);
          await this.pbrManager.applyTilesToSpa(this.spa);
      // Attach caustics to spa interior too
      try { this.caustics?.attachToGroup?.(this.spa); } catch (e) {}
          
        // Ensure caustics are attached to spa materials as well
        this.caustics?.attachToGroup?.(this.spa);
updatePoolWaterVoid(this.poolGroup, this.spa);
          updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
        } catch (_) {}
      }
    });
  }


  
  // --------------------------------------------------------------
  // UV / GROUT ALIGNMENT HELPERS
  //  - Keeps tile density fixed when meshes are scaled (steps/walls)
  //  - Snaps step grout across treads + risers
  //  - Snaps floor grout to a stable origin per-shape rebuild
  // --------------------------------------------------------------
  computeAndStoreUVOrigins() {
    if (!this.poolGroup) return;

    // Ensure matrices are up to date
    this.poolGroup.updateMatrixWorld?.(true);

    // Floor origin: prefer the tagged floor mesh, else use poolGroup bounds
    let floorOrigin = null;

    const floors = [];
    this.poolGroup.traverse((o) => o.userData?.isFloor && floors.push(o));

    const tmpBox = new THREE.Box3();

    if (floors.length) {
      tmpBox.setFromObject(floors[0]);
      floorOrigin = { x: tmpBox.min.x, y: tmpBox.min.y };
    } else {
      tmpBox.setFromObject(this.poolGroup);
      floorOrigin = { x: tmpBox.min.x, y: tmpBox.min.y };
    }

    this.poolGroup.userData.floorUVOrigin = floorOrigin;

    // Step origin: left-most edge across all step meshes (treads/risers)
    const steps = [];
    this.poolGroup.traverse((o) => o.userData?.isStep && !o.userData?.isStepAddon && steps.push(o));

    if (steps.length) {
      let minEdgeX = Infinity;

      steps.forEach((s) => {
        if (!s.geometry?.boundingBox) s.geometry?.computeBoundingBox?.();
        const bb = s.geometry?.boundingBox;
        if (!bb) return;

        const baseLen = (bb.max.x - bb.min.x) || 0;
        const len = baseLen * (s.scale?.x || 1);
        const left = (s.position?.x || 0) - len * 0.5;
        if (left < minEdgeX) minEdgeX = left;
      });

      if (isFinite(minEdgeX)) {
        this.poolGroup.userData.stepUVOriginX = minEdgeX;
        // z=0 is the pool datum (coping level) in your builders
        this.poolGroup.userData.stepUVOriginZ = 0;
      }
    }
  }

  rebakePoolTilingUVs() {
    if (!this.poolGroup) return;

    // Recompute origins each rebuild (shape changes shift bounds)
    this.computeAndStoreUVOrigins();

    // Update UVs on any mesh that relies on fixed-density tiling
    this.poolGroup.traverse((o) => {
      if (!o?.isMesh) return;

      // Floors, walls, steps (treads + risers) are the main targets
      if (o.userData?.isFloor || o.userData?.isWall || o.userData?.isStep || o.userData?.forceVerticalUV) {
        this.updateScaledBoxTilingUVs(o);
      }
    });
  }

  updateScaledBoxTilingUVs(mesh) {
    if (!mesh?.isMesh || !mesh.geometry?.attributes?.position) return;

    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    if (!nrm) return;

    const tile = this.tileSize || 0.3;

    // Per-group origins for grout snapping
    const g = mesh.parent?.userData || this.poolGroup?.userData || {};
    const stepOriginX = (g.stepUVOriginX ?? 0);
    const stepOriginZ = (g.stepUVOriginZ ?? 0);
    const floorOrigin = g.floorUVOrigin ?? { x: 0, y: 0 };

    // Effective scale relative to the pool group.
    // This keeps tile density stable during live preview when the whole
    // poolGroup is scaled for length/width dragging, while still respecting
    // per-mesh scaling for step extension / wall raise.
    let sx = 1, sy = 1, sz = 1;
    let cur = mesh;
    while (cur) {
      sx *= cur.scale?.x ?? 1;
      sy *= cur.scale?.y ?? 1;
      sz *= cur.scale?.z ?? 1;
      if (cur === this.poolGroup) break;
      cur = cur.parent;
    }

    const uvs = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
      // Local vertex scaled to match world-space tiling density
      const lx = pos.getX(i) * sx;
      const ly = pos.getY(i) * sy;
      const lz = pos.getZ(i) * sz;

      const ax = Math.abs(nrm.getX(i));
      const ay = Math.abs(nrm.getY(i));
      const az = Math.abs(nrm.getZ(i));

      let u = 0, v = 0;

      // RISERS: vertical faces must use Z for vertical grout density
      // (older mapping used Y, which collapses grout on risers)
      if (mesh.userData?.forceVerticalUV || mesh.userData?.isRiser) {
        if (ax >= ay && ax >= az) {
          // normal ~X => plane is YZ
          u = (ly + (mesh.position?.y || 0) - floorOrigin.y) / tile;
          v = (lz + (mesh.position?.z || 0) - stepOriginZ) / tile;
        } else if (ay >= ax && ay >= az) {
          // normal ~Y => plane is XZ
          u = (lx + (mesh.position?.x || 0) - stepOriginX) / tile;
          v = (lz + (mesh.position?.z || 0) - stepOriginZ) / tile;
        } else {
          // fallback
          u = (lx + (mesh.position?.x || 0) - stepOriginX) / tile;
          v = (ly + (mesh.position?.y || 0) - floorOrigin.y) / tile;
        }

      // STEP TREADS: align along X from step origin, and along Y from floor origin
      } else if (mesh.userData?.isStep && az >= ax && az >= ay) {
        u = (lx + (mesh.position?.x || 0) - stepOriginX) / tile;
        v = (ly + (mesh.position?.y || 0) - floorOrigin.y) / tile;

      // POOL FLOOR: align to floor origin in XY
      } else if (mesh.userData?.isFloor && az >= ax && az >= ay) {
        u = (lx + (mesh.position?.x || 0) - floorOrigin.x) / tile;
        v = (ly + (mesh.position?.y || 0) - floorOrigin.y) / tile;

      // WALLS (vertical): lock grout to floor origin horizontally, and Z vertically
      } else if (mesh.userData?.isWall) {
        if (ax >= ay && ax >= az) {
          // plane YZ
          u = (ly + (mesh.position?.y || 0) - floorOrigin.y) / tile;
          v = (lz + (mesh.position?.z || 0)) / tile;
        } else {
          // plane XZ
          u = (lx + (mesh.position?.x || 0) - floorOrigin.x) / tile;
          v = (lz + (mesh.position?.z || 0)) / tile;
        }

      // Fallback triplanar-ish projection
      } else {
        if (az >= ax && az >= ay) {
          u = (lx + (mesh.position?.x || 0)) / tile;
          v = (ly + (mesh.position?.y || 0)) / tile;
        } else if (ay >= ax && ay >= az) {
          u = (lx + (mesh.position?.x || 0)) / tile;
          v = (lz + (mesh.position?.z || 0)) / tile;
        } else {
          u = (ly + (mesh.position?.y || 0)) / tile;
          v = (lz + (mesh.position?.z || 0)) / tile;
        }
      }

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }

    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    // If a material uses uv2 (AO), keep it in sync
    if (geo.attributes.uv2) {
      geo.setAttribute("uv2", geo.attributes.uv.clone());
    }

    geo.attributes.uv.needsUpdate = true;
  }

// --------------------------------------------------------------
  // WATER GHOST MODE

  // --------------------------------------------------------------
  // FLOOR REPROFILE AFTER STEP EXTENSION
  // - Moves slope origin to the runtime end of steps run
  // - Raises (cuts out) the floor under step footprints to meet step bottoms
  // --------------------------------------------------------------
  updateFloorAfterStepExtension(steps, originX) {
    if (!this.poolGroup || !Array.isArray(steps) || steps.length === 0) return;
    if (!isFinite(originX)) return;

    // Find the floor mesh (prefer tagged isFloor)
    let floor = null;
    this.poolGroup.traverse((o) => {
      if (!floor && o?.isMesh && o.userData?.isFloor) floor = o;
    });
    floor = floor || this.poolGroup.userData?.floorMesh;
    if (!floor?.geometry?.attributes?.position) return;

    // Use the live app params first. poolGroup.userData.poolParams is a build-time
    // snapshot and can lag behind the active Bench Seat / Steps Only toggle during
    // slider previews.
    const params = this.poolParams || this.poolGroup.userData?.poolParams || {};
    const clampedShallow = Math.max(0.5, Number(params.shallow) || 0.5);
    const clampedDeep = Math.max(clampedShallow, Number(params.deep) || clampedShallow);

    // Determine pool axis start/end from outerPts bbox if available
    let axisStartX = 0;
    let axisEndX = 1;

    const outerPts = this.poolGroup.userData?.outerPts;
    if (Array.isArray(outerPts) && outerPts.length) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (const p of outerPts) {
        const x = p?.x;
        if (!isFinite(x)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (isFinite(minX) && isFinite(maxX) && maxX > minX) {
        axisStartX = minX;
        axisEndX = maxX;
      }
    } else {
      // fallback: floor bbox in world
      if (!floor.geometry.boundingBox) floor.geometry.computeBoundingBox();
      const bb = floor.geometry.boundingBox;
      const fx = floor.position?.x || 0;
      axisStartX = bb.min.x + fx;
      axisEndX = bb.max.x + fx;
    }

    // Decide where the shallow-to-deep transition starts based on the entry-step mode.
    // Steps Only keeps the transition at the entry wall. Bench Seat starts the
    // transition from the front edge of the second/full-width bench only, so
    // extra lower steps do not push the transition deeper into the pool.
    const stepBenchMode = params?.stepBenchMode === "stepsOnly" ? "stepsOnly" : "bench";
    if (stepBenchMode === "stepsOnly") {
      originX = axisStartX;
    } else {
      let benchFrontX = NaN;
      for (const step of steps) {
        const idx = Number(step?.userData?.stepIndex);
        if (idx !== 1) continue;
        const geo = step?.geometry;
        if (!geo?.attributes?.position) continue;
        if (!geo.boundingBox) geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const sx = step.scale?.x ?? 1;
        const lenX = (bb.max.x - bb.min.x) * sx;
        const cx = step.position?.x ?? 0;
        benchFrontX = cx + lenX * 0.5;
        break;
      }
      if (isFinite(benchFrontX)) originX = benchFrontX;
    }

    // If originX is outside the pool span, clamp defensively
    originX = THREE.MathUtils.clamp(originX, axisStartX, axisEndX);

    const fullLen = axisEndX - originX;

    let sFlat = Number(params.shallowFlat) || 0;
    let dFlat = Number(params.deepFlat) || 0;

    const maxFlats = Math.max(0, fullLen - 0.01);
    if (sFlat + dFlat > maxFlats) {
      const scale = (sFlat + dFlat) > 0 ? (maxFlats / (sFlat + dFlat)) : 0;
      sFlat *= scale;
      dFlat *= scale;
    }

    const slopeLen = Math.max(0.01, fullLen - sFlat - dFlat);

    // Build step footprints (world-space AABBs + bottom z)
    const stepBoxes = [];
    for (const step of steps) {
      const geo = step?.geometry;
      if (!geo?.attributes?.position) continue;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox;

      const sx = step.scale?.x ?? 1;
      const sy = step.scale?.y ?? 1;
      const sz = step.scale?.z ?? 1;

      const lenX = (bb.max.x - bb.min.x) * sx;
      const lenY = (bb.max.y - bb.min.y) * sy;
      const lenZ = (bb.max.z - bb.min.z) * sz;

      const cx = step.position?.x ?? 0;
      const cy = step.position?.y ?? 0;
      const cz = step.position?.z ?? 0;

      const minX = cx - lenX * 0.5;
      const maxX = cx + lenX * 0.5;
      const minY = cy - lenY * 0.5;
      const maxY = cy + lenY * 0.5;

      const bottomZ = cz - lenZ * 0.5;

      stepBoxes.push({ minX, maxX, minY, maxY, bottomZ });
    }

    const pos = floor.geometry.attributes.position;
    const fx = floor.position?.x || 0;
    const fy = floor.position?.y || 0;

    for (let i = 0; i < pos.count; i++) {
      const worldX = pos.getX(i) + fx;
      const worldY = pos.getY(i) + fy;

      // Base rectangle-style floor depth at X (with new originX)
      let dx = worldX - originX;
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

      // Cutout/raise under steps: in Bench Seat mode, raise the floor under
      // the bench/steps so the floor meets their underside. In Steps Only mode,
      // do NOT let any step footprint move or flatten the floor profile; the
      // shallow-to-deep transition must start at the entry wall and continue
      // beneath the loose step tiers.
      if (stepBenchMode !== "stepsOnly") {
        for (const b of stepBoxes) {
          if (worldX >= b.minX && worldX <= b.maxX && worldY >= b.minY && worldY <= b.maxY) {
            z = Math.max(z, b.bottomZ);
          }
        }
      }

      pos.setZ(i, z);
    }

    pos.needsUpdate = true;
    floor.geometry.computeVertexNormals();

    // Persist for debugging / other systems
    this.poolGroup.userData.originX = originX;
    this.poolGroup.userData.stepFootprintLen = Math.max(0, originX - axisStartX);

    // Re-UV floor too (slope moved, and floor changed under steps)
    this.updateScaledBoxTilingUVs(floor);
  }

  // --------------------------------------------------------------
  ghostifyWater() {
    if (!this.poolGroup) return;
    const water = this.poolGroup.userData?.waterMesh;
    if (water) water.visible = false;
  }

  restoreWater() {
    if (!this.poolGroup) return;
    const water = this.poolGroup.userData?.waterMesh;
    if (water) water.visible = true;
  }

  _syncSectionSelectionEffects() {
    if (!this.sectionViewEnabled) return;
    if (this.hoverHighlightMesh) this.hoverHighlightMesh.visible = false;
    if (this.selectedHighlightMesh) this.selectedHighlightMesh.visible = false;
    if (this.hoverWallHighlightMesh) this.hoverWallHighlightMesh.visible = false;
    if (this.selectedWallHighlightMesh) this.selectedWallHighlightMesh.visible = false;
    if (this.hoverSpaHighlight) this.hoverSpaHighlight.visible = false;
    if (this.selectedSpaHighlight) this.selectedSpaHighlight.visible = false;
    this.clearCustomizeWallSelectionHighlights();
  }

  // --------------------------------------------------------------
  // STEP HIGHLIGHT HELPERS
  // --------------------------------------------------------------
  updateHighlightForStep(step, isSelected) {
    if (!this.scene || !step) return;
    if (this.sectionViewEnabled) {
      if (isSelected && this.selectedHighlightMesh) this.selectedHighlightMesh.visible = false;
      if (!isSelected && this.hoverHighlightMesh) this.hoverHighlightMesh.visible = false;
      return;
    }

    const scaleFactor = isSelected ? 1.12 : 1.06;
    const opacity = isSelected ? 0.45 : 0.3;

    let highlightMesh = isSelected
      ? this.selectedHighlightMesh
      : this.hoverHighlightMesh;

    if (!highlightMesh) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffff66,
        transparent: true,
        opacity,
        depthWrite: false
      });

      highlightMesh = new THREE.Mesh(step.geometry.clone(), mat);
      highlightMesh.renderOrder = 999;
      this.scene.add(highlightMesh);

      if (isSelected) this.selectedHighlightMesh = highlightMesh;
      else this.hoverHighlightMesh = highlightMesh;
    } else {
      if (highlightMesh.geometry) highlightMesh.geometry.dispose();
      highlightMesh.geometry = step.geometry.clone();
      highlightMesh.material.opacity = opacity;
    }

    step.updateWorldMatrix?.(true, false);
    const _stepPos = new THREE.Vector3();
    const _stepQuat = new THREE.Quaternion();
    const _stepScale = new THREE.Vector3();
    step.matrixWorld.decompose(_stepPos, _stepQuat, _stepScale);

    highlightMesh.position.copy(_stepPos);
    highlightMesh.quaternion.copy(_stepQuat);
    highlightMesh.scale.copy(_stepScale).multiplyScalar(scaleFactor);
    highlightMesh.visible = true;
  }

  clearHoverHighlight() {
    if (this.hoverHighlightMesh) this.hoverHighlightMesh.visible = false;
    this.hoveredStep = null;
  }

  clearSelectedHighlight() {
    if (this.selectedHighlightMesh) this.selectedHighlightMesh.visible = false;
    this.selectedStep = null;
  }

  // --------------------------------------------------------------
  // WALL HIGHLIGHT HELPERS (blue)
  // --------------------------------------------------------------
  updateHighlightForWall(wall, isSelected) {
    if (!this.scene || !wall) return;
    if (this.sectionViewEnabled) {
      if (isSelected && this.selectedWallHighlightMesh) this.selectedWallHighlightMesh.visible = false;
      if (!isSelected && this.hoverWallHighlightMesh) this.hoverWallHighlightMesh.visible = false;
      return;
    }

    const scaleFactor = isSelected ? 1.08 : 1.04;
    const opacity = isSelected ? 0.5 : 0.3;

    let highlightMesh = isSelected
      ? this.selectedWallHighlightMesh
      : this.hoverWallHighlightMesh;

    if (!highlightMesh) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x66aaff,
        transparent: true,
        opacity,
        depthWrite: false
      });

      highlightMesh = new THREE.Mesh(wall.geometry.clone(), mat);
      highlightMesh.renderOrder = 998;
      this.scene.add(highlightMesh);

      if (isSelected) this.selectedWallHighlightMesh = highlightMesh;
      else this.hoverWallHighlightMesh = highlightMesh;
    } else {
      if (highlightMesh.geometry) highlightMesh.geometry.dispose();
      highlightMesh.geometry = wall.geometry.clone();
      highlightMesh.material.opacity = opacity;
    }

    wall.updateWorldMatrix?.(true, false);
    const _wallPos = new THREE.Vector3();
    const _wallQuat = new THREE.Quaternion();
    const _wallScale = new THREE.Vector3();
    wall.matrixWorld.decompose(_wallPos, _wallQuat, _wallScale);

    highlightMesh.position.copy(_wallPos);
    highlightMesh.quaternion.copy(_wallQuat);
    highlightMesh.scale.copy(_wallScale).multiplyScalar(scaleFactor);
    highlightMesh.visible = true;
  }

  clearWallHoverHighlight() {
    if (this.hoverWallHighlightMesh) {
      this.hoverWallHighlightMesh.visible = false;
    }
    this.hoveredWall = null;
  }

  clearWallSelectedHighlight() {
    if (this.selectedWallHighlightMesh) {
      this.selectedWallHighlightMesh.visible = false;
    }
    this.selectedWall = null;

    // Also reset wall UI slider directly (defensive, in case UI.js
    // is not listening to events)
    const row = document.getElementById("wallRaiseRow");
    const slider = document.getElementById("wallRaise");
    const val = document.getElementById("wallRaise-val");

    if (row) row.style.display = "none";
    if (slider) {
      slider.disabled = true;
      slider.value = "0";
    }
    if (val) val.textContent = "0.00 m";
  }


  updateCustomizeSelectionHighlights() {
    if (!this.scene) return;
    if (this.sectionViewEnabled) {
      this.clearCustomizeWallSelectionHighlights();
      return;
    }

    while (this.customizeSelectionHighlightMeshes.length < this.customizeWallSelections.length) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x66aaff,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(undefined, mat);
      mesh.renderOrder = 999;
      mesh.visible = false;
      this.scene.add(mesh);
      this.customizeSelectionHighlightMeshes.push(mesh);
    }

    this.customizeSelectionHighlightMeshes.forEach((mesh, index) => {
      const sel = this.customizeWallSelections[index];
      if (!sel?.wall) {
        mesh.visible = false;
        return;
      }
      if (mesh.geometry) mesh.geometry.dispose();
      mesh.geometry = sel.wall.geometry.clone();
      mesh.position.copy(sel.wall.position);
      mesh.rotation.copy(sel.wall.rotation);
      mesh.scale.copy(sel.wall.scale).multiplyScalar(1.08);
      mesh.visible = true;
    });
  }

  clearCustomizeWallSelectionHighlights() {
    this.customizeSelectionHighlightMeshes.forEach((mesh) => {
      if (mesh) mesh.visible = false;
    });
  }

  clearCustomizePreview() {
    this.customizePreview = null;
    if (this.customizePreviewLine) {
      this.customizePreviewLine.visible = false;
    }
    const confirmBtn = document.getElementById("customizeConfirmBtn");
    if (confirmBtn) confirmBtn.style.display = "none";
  }

  // --------------------------------------------------------------
  // STEP SELECTION (hover + double-click)
  // --------------------------------------------------------------
  setupStepSelection() {
    if (!this.renderer || !this.camera) return;
    const dom = this.renderer.domElement;

    // Hover – highlight only, do not open panel
    dom.addEventListener("pointermove", (event) => {
      if (!this.poolGroup || this.customizeMode) return;

      if (this.poolEditor?.isDragging) return;

      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, this.camera);

      const steps = [];
      this.poolGroup.traverse((o) => o.userData?.isStep && !o.userData?.isStepAddon && steps.push(o));

      if (!steps.length) {
        this.clearHoverHighlight();
        return;
      }

      const hit = ray.intersectObjects(steps, true);
      if (!hit.length) {
        this.clearHoverHighlight();
        return;
      }

      const step = hit[0].object;

      if (step === this.selectedStep) {
        this.clearHoverHighlight();
        return;
      }

      if (step !== this.hoveredStep) {
        this.hoveredStep = step;
        this.updateHighlightForStep(step, false);
      }
    });

    // Select – pick step, ghost water, open Steps panel
    dom.addEventListener("dblclick", (event) => {
      if (event.button !== 0) return;
      if (!this.poolGroup) return;

      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, this.camera);

      const steps = [];
      this.poolGroup.traverse((o) => o.userData?.isStep && !o.userData?.isStepAddon && steps.push(o));

      const hit = steps.length ? ray.intersectObjects(steps, true) : [];

      // If a step is hit, consume this event so wall selection / ripple do not also fire
      if (hit.length) {
        event.stopImmediatePropagation();
      }
      if (!hit.length) {
        const hadSel = !!this.selectedStep;
        this.clearSelectedHighlight();
        if (hadSel) {
          document.dispatchEvent(new CustomEvent("stepSelectionCleared"));
          document.dispatchEvent(new CustomEvent("stepsPanelClosed"));
          this.restoreWater();
        }
        return;
      }

      const step = hit[0].object;
      this.selectedStep = step;

      this.updateHighlightForStep(step, true);
      this.clearHoverHighlight();

      // Open Steps panel via UI helper (if present)
      if (window.openPanelFromCode) {
        window.openPanelFromCode("steps");
      }

      // Fire panel-open event so existing listeners (camera zoom, ghost)
      // continue to work as before
      document.dispatchEvent(new CustomEvent("stepsPanelOpened"));

      // ghost water for clearer view of steps
      this.ghostifyWater();

      this.syncStepExtensionSliderForSelectedStep?.();
      document.dispatchEvent(new CustomEvent("stepSelected"));
    });
  }


  getBench2ExtensionValue() {
    const n = Number(this.poolParams?.bench2Extension);
    return Number.isFinite(n) && n > 0 ? n : 0.6;
  }

  getDiagonalStepSizeValue() {
    const cap = this.getBench2ExtensionValue();
    const n = Number(this.poolParams?.diagonalStepSize ?? this.poolParams?.stepWidth);
    const wanted = Number.isFinite(n) && n > 0 ? n : 0.45;
    return THREE.MathUtils.clamp(wanted, 0.05, cap);
  }

  isCenteredCircularStepShape() {
    const pos = this.poolParams?.stepPosition === "left" || this.poolParams?.stepPosition === "right"
      ? this.poolParams.stepPosition
      : "center";
    return this.poolParams?.stepShape === "circular" && pos === "center";
  }

  getStepBenchMode() {
    return this.poolParams?.stepBenchMode === "stepsOnly" ? "stepsOnly" : "bench";
  }

  updateStepBenchModeControls() {
    const mode = this.getStepBenchMode?.() ?? "bench";
    document.querySelectorAll("[data-step-bench-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.stepBenchMode === mode);
    });
  }

  updateCenterCircularModeControls() {
    // Backwards-compatible wrapper for older calls. The bench/steps-only
    // toggle is now a global step layout option, not centre-circular only.
    this.updateStepBenchModeControls?.();
  }

  isEqualCornerStepShape() {
    if (this.poolParams?.stepShape === "diagonal") return true;
    return this.poolParams?.stepShape === "circular" && !this.isCenteredCircularStepShape?.();
  }

  getStepWallSpanMax() {
    const wall = ["west", "east", "north", "south"].includes(this.poolParams?.stepWall) ? this.poolParams.stepWall : "west";
    const span = (wall === "north" || wall === "south")
      ? Number(this.poolParams?.length)
      : Number(this.poolParams?.width);
    return Math.max(0.5, Number.isFinite(span) && span > 0 ? span : 5);
  }

  getStepWidthSliderMax() {
    if (this.isCenteredCircularStepShape?.()) return this.getStepWallSpanMax?.() ?? Math.max(0.5, Number(this.poolParams?.width) || 5);
    // Diagonal/circular corner steps are equal corner footprints. Their cap is
    // the current second/full-width bench extension, not a fixed 600 mm value.
    if (this.isEqualCornerStepShape?.()) return this.getBench2ExtensionValue();
    return this.getStepWallSpanMax?.() ?? Math.max(0.5, Number(this.poolParams?.width) || 5);
  }

  syncStepWidthSliderLimit() {
    const slider = document.getElementById("stepWidth");
    const output = document.getElementById("stepWidth-val");
    const extensionSlider = document.getElementById("stepExtension");
    const extensionOutput = document.getElementById("stepExtension-val");
    if (!slider) return;

    const isDiagonal = this.isEqualCornerStepShape?.();
    const isCenteredCircular = this.isCenteredCircularStepShape?.();
    const maxWidth = this.getStepWidthSliderMax();
    slider.max = String(maxWidth);
    if (isDiagonal) {
      slider.min = "0.05";
    } else if (isCenteredCircular) {
      slider.min = "0.2";
    } else {
      slider.min = "0.5";
    }

    let width = isDiagonal
      ? this.getDiagonalStepSizeValue()
      : Number(this.poolParams.stepWidth);
    if (!Number.isFinite(width) || width <= 0) width = isDiagonal ? 0.45 : (isCenteredCircular ? 1.2 : maxWidth);
    width = THREE.MathUtils.clamp(width, Number(slider.min) || 0.05, maxWidth);
    this.poolParams.stepWidth = width;
    if (isDiagonal) {
      this.poolParams.diagonalStepSize = width;
      this.poolParams.stepExtension = width;
    } else if (isCenteredCircular) {
      // Centre circular steps are true semi-circles: width is the diameter,
      // extension is the radius/projection into the pool.
      this.poolParams.stepExtension = width * 0.5;
    }
    slider.value = String(width);
    if (output) output.textContent = width.toFixed(2) + " m";

    // In Diagonal Corner mode, narrow corner steps use one equal X/Y value,
    // capped by the current second bench extension. If the second bench itself
    // is selected, the extension slider still controls that bench and can grow
    // beyond 600 mm.
    if (extensionSlider && isDiagonal) {
      const selectedIndex = Number(this.selectedStep?.userData?.stepIndex);
      if (selectedIndex === 1) {
        const bench = this.getBench2ExtensionValue();
        extensionSlider.min = "0.3";
        extensionSlider.max = "1.5";
        extensionSlider.value = String(bench);
        if (extensionOutput) extensionOutput.textContent = bench.toFixed(2) + " m";
      } else {
        extensionSlider.min = slider.min;
        extensionSlider.max = String(maxWidth);
        extensionSlider.value = String(width);
        if (extensionOutput) extensionOutput.textContent = width.toFixed(2) + " m";
      }
    } else if (extensionSlider && isCenteredCircular) {
      const radius = width * 0.5;
      extensionSlider.min = "0.1";
      extensionSlider.max = String(maxWidth * 0.5);
      extensionSlider.value = String(radius);
      if (extensionOutput) extensionOutput.textContent = radius.toFixed(2) + " m";
    } else if (extensionSlider) {
      extensionSlider.min = "0.3";
      extensionSlider.max = "1.5";
    }
  }

  syncStepExtensionSliderForSelectedStep() {
    const slider = document.getElementById("stepExtension");
    const output = document.getElementById("stepExtension-val");
    if (!slider) return;

    if (this.isCenteredCircularStepShape?.()) {
      const widthMax = this.getStepWidthSliderMax?.() ?? Math.max(0.5, Number(this.poolParams?.width) || 5);
      const diameter = THREE.MathUtils.clamp(Number(this.poolParams?.stepWidth) || 1.2, 0.2, widthMax);
      const radius = THREE.MathUtils.clamp(Number(this.poolParams?.stepExtension) || diameter * 0.5, 0.1, widthMax * 0.5);
      slider.min = "0.1";
      slider.max = String(widthMax * 0.5);
      slider.value = String(radius);
      if (output) output.textContent = radius.toFixed(2) + " m";
      return;
    }

    if (this.getStepBenchMode?.() === "stepsOnly" && this.selectedStep?.geometry && this.poolGroup) {
      const steps = [];
      this.poolGroup.traverse((o) => {
        if (o.userData && o.userData.isStep && !o.userData.isStepAddon) steps.push(o);
      });
      const sortedSteps = steps
        .slice()
        .sort((a, b) => {
          const ai = Number.isFinite(Number(a.userData?.stepIndex)) ? Number(a.userData.stepIndex) : 0;
          const bi = Number.isFinite(Number(b.userData?.stepIndex)) ? Number(b.userData.stepIndex) : 0;
          return ai - bi;
        });

      const selectedIndex = Number.isFinite(Number(this.selectedStep.userData?.stepIndex))
        ? Number(this.selectedStep.userData.stepIndex)
        : sortedSteps.indexOf(this.selectedStep);

      const getRun = (step) => {
        if (!step?.geometry) return 0;
        if (!step.geometry.boundingBox) step.geometry.computeBoundingBox();
        const bb = step.geometry.boundingBox;
        const baseLen = bb.max.x - bb.min.x;
        const scaledLen = baseLen * (step.scale?.x ?? 1);
        const savedRun = Number(step.userData?.stepRun);
        return Number.isFinite(scaledLen) && scaledLen > 0
          ? scaledLen
          : (Number.isFinite(savedRun) && savedRun > 0 ? savedRun : 0.3);
      };

      const currentRun = getRun(this.selectedStep);
      const previousStep = sortedSteps.find((step) => Number(step.userData?.stepIndex) === selectedIndex - 1);
      const previousRun = previousStep ? getRun(previousStep) : 0;
      const extensionPastPrevious = Math.max(0, currentRun - previousRun);
      const maxLen = Math.max(1.5, Number(this.poolParams?.length) || 1.5);
      slider.min = "0";
      slider.max = String(Math.max(0.05, maxLen - previousRun));
      slider.value = String(extensionPastPrevious);
      if (output) output.textContent = extensionPastPrevious.toFixed(2) + " m";
      return;
    }

    if (this.getStepBenchMode?.() === "bench" && this.selectedStep?.geometry && this.poolGroup && !this.isCenteredCircularStepShape?.()) {
      const steps = [];
      this.poolGroup.traverse((o) => {
        if (o.userData && o.userData.isStep && !o.userData.isStepAddon) steps.push(o);
      });
      if (steps.length) {
        steps.forEach((step) => {
          if (step.geometry && !step.geometry.boundingBox) step.geometry.computeBoundingBox();
        });

        const sortedSteps = steps.slice().sort((a, b) => {
          const ai = Number.isFinite(Number(a.userData?.stepIndex)) ? Number(a.userData.stepIndex) : 0;
          const bi = Number.isFinite(Number(b.userData?.stepIndex)) ? Number(b.userData.stepIndex) : 0;
          return ai - bi;
        });

        let wallX = Infinity;
        const outerPts = this.poolGroup.userData?.outerPts;
        if (Array.isArray(outerPts) && outerPts.length) {
          outerPts.forEach((pt) => {
            const x = Number(pt?.x);
            if (Number.isFinite(x) && x < wallX) wallX = x;
          });
        }
        if (!Number.isFinite(wallX)) {
          sortedSteps.forEach((step) => {
            const bb = step.geometry?.boundingBox;
            if (!bb) return;
            const len = (bb.max.x - bb.min.x) * (step.scale?.x ?? 1);
            const left = (step.position?.x ?? 0) - len * 0.5;
            if (Number.isFinite(left) && left < wallX) wallX = left;
          });
        }

        const getLen = (step) => {
          const bb = step?.geometry?.boundingBox;
          if (!bb) return 0;
          const len = (bb.max.x - bb.min.x) * (step.scale?.x ?? 1);
          const saved = Number(step.userData?.stepRun);
          return Number.isFinite(len) && len > 0 ? len : (Number.isFinite(saved) && saved > 0 ? saved : 0.3);
        };

        const frontEdge = (step) => (step.position?.x ?? 0) + getLen(step) * 0.5;
        const selectedRank = Math.max(0, sortedSteps.indexOf(this.selectedStep));
        const selectedFront = frontEdge(this.selectedStep);
        const previousFront = selectedRank > 0 ? frontEdge(sortedSteps[selectedRank - 1]) : wallX;
        const extensionPastPrevious = Math.max(0, selectedFront - previousFront);
        const maxLen = Math.max(1.5, Number(this.poolParams?.length) || 1.5);
        slider.min = "0";
        slider.max = String(Math.max(0.05, maxLen - Math.max(0, previousFront - wallX)));
        slider.value = String(extensionPastPrevious);
        if (output) output.textContent = extensionPastPrevious.toFixed(2) + " m";
        return;
      }
    }

    if (!this.isEqualCornerStepShape?.()) return;

    const selectedIndex = Number(this.selectedStep?.userData?.stepIndex);
    if (selectedIndex === 1) {
      const bench = this.getBench2ExtensionValue();
      slider.min = "0.3";
      slider.max = "1.5";
      slider.value = String(bench);
      if (output) output.textContent = bench.toFixed(2) + " m";
      return;
    }

    const cap = this.getBench2ExtensionValue();
    const size = this.getDiagonalStepSizeValue();
    slider.min = "0.05";
    slider.max = String(cap);
    slider.value = String(size);
    if (output) output.textContent = size.toFixed(2) + " m";
  }

  setupStepLayoutControls() {
    if (this._stepLayoutControlsReady) return;
    this._stepLayoutControlsReady = true;

    const updateButtons = () => {
      const wall = ["west", "east", "north", "south"].includes(this.poolParams.stepWall) ? this.poolParams.stepWall : "west";
      document.querySelectorAll("[data-step-wall]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.stepWall === wall);
      });

      const pos = this.poolParams.stepPosition === "left" || this.poolParams.stepPosition === "right"
        ? this.poolParams.stepPosition
        : "center";
      document.querySelectorAll("[data-step-position]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.stepPosition === pos);
      });

      const shape = (["diagonal", "circular", "radius"].includes(this.poolParams.stepShape)) ? this.poolParams.stepShape : "rectangle";
      document.querySelectorAll("[data-step-shape]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.stepShape === shape);
      });
      this.updateCenterCircularModeControls?.();
      this.syncStepWidthSliderLimit?.();
    };

    const rebuildForStepLayout = async (_reason) => {
      const selectedStepIndex = Number.isFinite(Number(this.selectedStep?.userData?.stepIndex))
        ? Number(this.selectedStep.userData.stepIndex)
        : null;

      this.clearHoverHighlight?.();
      if (this.selectedHighlightMesh) this.selectedHighlightMesh.visible = false;
      this.selectedStep = null;

      await this.rebuildPoolForCurrentShape();
      updateButtons();

      // Rebuild replaces the step meshes. Re-select the equivalent step so
      // width/extension live previews keep working after layout changes.
      if (selectedStepIndex !== null && this.poolGroup) {
        let replacementStep = null;
        this.poolGroup.traverse((o) => {
          if (
            !replacementStep &&
            o?.userData?.isStep &&
            !o.userData.isStepAddon &&
            Number(o.userData.stepIndex) === selectedStepIndex
          ) {
            replacementStep = o;
          }
        });
        if (replacementStep) {
          this.selectedStep = replacementStep;
          this.updateHighlightForStep(replacementStep, true);
          this.ghostifyWater?.();
        }
      }
    };

    document.querySelectorAll("[data-step-wall]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = ["west", "east", "north", "south"].includes(btn.dataset.stepWall) ? btn.dataset.stepWall : "west";
        if (this.poolParams.stepWall === next) return;
        this.captureUndoState?.("Step wall");
        this.poolParams.stepWall = next;
        rebuildForStepLayout("Step wall");
      });
    });

    document.querySelectorAll("[data-step-position]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.stepPosition;
        if (!next || this.poolParams.stepPosition === next) return;
        this.captureUndoState?.("Step position");
        this.poolParams.stepPosition = next;
        rebuildForStepLayout("Step position");
      });
    });

    document.querySelectorAll("[data-step-shape]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = (["diagonal", "circular", "radius"].includes(btn.dataset.stepShape)) ? btn.dataset.stepShape : "rectangle";
        if (this.poolParams.stepShape === next) return;
        this.captureUndoState?.("Step shape");
        this.poolParams.stepShape = next;
        if (next === "diagonal" || (next === "circular" && this.poolParams.stepPosition !== "center")) {
          const cap = this.getBench2ExtensionValue();
          const existing = Number(this.poolParams.diagonalStepSize);
          const size = Number.isFinite(existing) && existing > 0 ? existing : 0.45;
          this.poolParams.diagonalStepSize = THREE.MathUtils.clamp(size, 0.05, cap);
          this.poolParams.stepWidth = this.poolParams.diagonalStepSize;
          this.poolParams.stepExtension = this.poolParams.diagonalStepSize;
        } else if (next === "circular") {
          const maxWidth = this.getStepWidthSliderMax?.() ?? Math.max(0.5, Number(this.poolParams?.width) || 5);
          const diameter = THREE.MathUtils.clamp(Number(this.poolParams.stepWidth) || 1.2, 0.2, maxWidth);
          this.poolParams.stepWidth = diameter;
          this.poolParams.stepExtension = diameter * 0.5;
        }
        this.updateCenterCircularModeControls?.();
        this.syncStepWidthSliderLimit?.();
        rebuildForStepLayout("Step shape");
      });
    });

    document.querySelectorAll("[data-step-bench-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.stepBenchMode === "stepsOnly" ? "stepsOnly" : "bench";
        if (this.getStepBenchMode?.() === next) return;
        this.captureUndoState?.("Step layout");
        this.poolParams.stepBenchMode = next;
        this.updateStepBenchModeControls?.();
        rebuildForStepLayout("Step layout");
      });
    });

    updateButtons();
  }

  // --------------------------------------------------------------
  // STEP EXTENSION SLIDER (CHAIN PUSH, ALL SHAPES)
  // --------------------------------------------------------------

  previewStepWidthSlider(widthValue) {
    if (!this.poolGroup) return;

    const steps = [];
    this.poolGroup.traverse((o) => {
      if (o?.userData?.isStep && !o.userData.isStepAddon) steps.push(o);
    });
    if (!steps.length) return;

    let spanMinY = Infinity;
    let spanMaxY = -Infinity;
    const outerPts = this.poolGroup.userData?.outerPts;
    if (Array.isArray(outerPts) && outerPts.length) {
      outerPts.forEach((p) => {
        const y = p?.y;
        if (!isFinite(y)) return;
        if (y < spanMinY) spanMinY = y;
        if (y > spanMaxY) spanMaxY = y;
      });
    }

    if (!isFinite(spanMinY) || !isFinite(spanMaxY) || spanMaxY <= spanMinY) {
      let floor = null;
      this.poolGroup.traverse((o) => {
        if (!floor && o?.isMesh && o.userData?.isFloor) floor = o;
      });
      floor = floor || this.poolGroup.userData?.floorMesh;
      if (floor?.geometry) {
        if (!floor.geometry.boundingBox) floor.geometry.computeBoundingBox();
        const bb = floor.geometry.boundingBox;
        const fy = floor.position?.y || 0;
        spanMinY = bb.min.y + fy;
        spanMaxY = bb.max.y + fy;
      }
    }

    if (!isFinite(spanMinY) || !isFinite(spanMaxY) || spanMaxY <= spanMinY) return;

    const fullWidth = Math.max(0.05, spanMaxY - spanMinY);
    const isDiagonal = this.isEqualCornerStepShape?.();
    const widthMax = isDiagonal ? Math.min(fullWidth, this.getBench2ExtensionValue?.() ?? 0.6) : fullWidth;
    const narrowWidth = THREE.MathUtils.clamp(Number(widthValue) || (isDiagonal ? 0.45 : 0.9), 0.05, widthMax);
    const position = this.poolParams.stepPosition === "left" || this.poolParams.stepPosition === "right"
      ? this.poolParams.stepPosition
      : "center";

    const getCenterY = (width, full = false) => {
      if (full) return (spanMinY + spanMaxY) * 0.5;
      if (position === "left") return spanMinY + width * 0.5;
      if (position === "right") return spanMaxY - width * 0.5;
      return (spanMinY + spanMaxY) * 0.5;
    };

    const stepBenchMode = this.getStepBenchMode?.() === "stepsOnly" ? "stepsOnly" : "bench";
    const tierOffset = 0.3;

    const sortedPreviewSteps = steps.slice().sort((a, b) => {
      const ai = Number.isFinite(Number(a.userData?.stepIndex)) ? Number(a.userData.stepIndex) : steps.indexOf(a);
      const bi = Number.isFinite(Number(b.userData?.stepIndex)) ? Number(b.userData.stepIndex) : steps.indexOf(b);
      return ai - bi;
    });

    const selectedPreviewRank = this.selectedStep && sortedPreviewSteps.includes(this.selectedStep)
      ? sortedPreviewSteps.indexOf(this.selectedStep)
      : 0;

    const getCurrentStepWidth = (step) => {
      if (!step?.geometry) return 0;
      if (!step.geometry.boundingBox) step.geometry.computeBoundingBox();
      const bb = step.geometry.boundingBox;
      const baseWidth = bb.max.y - bb.min.y;
      const scaledWidth = baseWidth * (step.scale?.y ?? 1);
      const savedWidth = Number(step.userData?.stepWidth);
      return Number.isFinite(scaledWidth) && scaledWidth > 0
        ? scaledWidth
        : (Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : narrowWidth);
    };

    let previousPreviewWidth = 0;
    sortedPreviewSteps.forEach((step, rank) => {
      const idx = Number.isFinite(Number(step.userData?.stepIndex)) ? Number(step.userData.stepIndex) : rank;
      let targetWidth;
      if (stepBenchMode === "stepsOnly") {
        // Steps Only gets its own selected-tier width preview. Do not use the
        // bench-seat rule where stepIndex 1 becomes full width. The selected
        // tier receives the slider value, and every tier below it widens enough
        // to remain equal-or-larger so the live preview stays as a tiered cake.
        const stepGrowth = position === "center" ? tierOffset * 2 : tierOffset;
        const currentWidth = getCurrentStepWidth(step);
        if (rank === selectedPreviewRank) {
          targetWidth = narrowWidth;
        } else if (rank > selectedPreviewRank) {
          const requiredFromSelected = narrowWidth + stepGrowth * (rank - selectedPreviewRank);
          targetWidth = Math.max(currentWidth, requiredFromSelected, previousPreviewWidth + stepGrowth);
        } else {
          targetWidth = Math.min(currentWidth || narrowWidth, fullWidth);
        }
        targetWidth = THREE.MathUtils.clamp(targetWidth, 0.05, fullWidth);
      } else {
        targetWidth = idx === 1 ? fullWidth : narrowWidth;
      }
      if (!step.geometry.boundingBox) step.geometry.computeBoundingBox();
      const bb = step.geometry.boundingBox;
      const baseWidth = bb.max.y - bb.min.y;
      if (!isFinite(baseWidth) || baseWidth <= 0) return;

      step.scale.y = targetWidth / baseWidth;

      if (isDiagonal && idx !== 1 && position !== "center") {
        const baseLen = bb.max.x - bb.min.x;
        if (Number.isFinite(baseLen) && baseLen > 0) {
          // Equal triangle: the slider value is the actual X/Y footprint size.
          // Always derive from the mesh bounding box, not stale extension scale.
          const size = THREE.MathUtils.clamp(targetWidth, 0.05, this.getBench2ExtensionValue?.() ?? 0.6);
          const backEdgeX = step.position.x - baseLen * (step.scale?.x ?? 1) * 0.5;
          step.scale.x = size / baseLen;
          step.scale.y = size / baseWidth;
          step.position.x = backEdgeX + size * 0.5;
          step.userData.stepRun = size;
          step.userData.stepWidth = size;
        }
      }

      step.position.y = getCenterY(targetWidth, stepBenchMode === "bench" && idx === 1);
      step.userData.stepWidth = targetWidth;
      step.userData.stepPosition = position;
      previousPreviewWidth = targetWidth;
      this.updateScaledBoxTilingUVs(step);
    });

    // Diagonal corner steps must be laid out from the wall immediately after
    // width/shape changes. Do not wait for the extension slider path to
    // re-chain them, otherwise they can appear oversized until the bench step
    // is adjusted.
    if (isDiagonal && position !== "center") {
      let wallX = Infinity;
      if (Array.isArray(outerPts) && outerPts.length) {
        outerPts.forEach((p) => {
          const x = p?.x;
          if (isFinite(x) && x < wallX) wallX = x;
        });
      }
      if (!isFinite(wallX)) {
        steps.forEach((step) => {
          if (!step.geometry.boundingBox) step.geometry.computeBoundingBox();
          const bb = step.geometry.boundingBox;
          const lenX = (bb.max.x - bb.min.x) * (step.scale?.x ?? 1);
          const leftEdge = (step.position?.x ?? 0) - lenX * 0.5;
          if (leftEdge < wallX) wallX = leftEdge;
        });
      }

      if (isFinite(wallX)) {
        const sortedSteps = steps.slice().sort((a, b) => {
          const ai = Number.isFinite(Number(a.userData?.stepIndex)) ? Number(a.userData.stepIndex) : 0;
          const bi = Number.isFinite(Number(b.userData?.stepIndex)) ? Number(b.userData.stepIndex) : 0;
          return ai - bi;
        });
        const getLength = (step) => {
          if (!step.geometry.boundingBox) step.geometry.computeBoundingBox();
          const bb = step.geometry.boundingBox;
          return (bb.max.x - bb.min.x) * (step.scale?.x ?? 1);
        };

        let runX = wallX;
        sortedSteps.forEach((step) => {
          const idx = Number.isFinite(Number(step.userData?.stepIndex)) ? Number(step.userData.stepIndex) : 0;
          const len = getLength(step);
          if (idx <= 1) {
            step.position.x = wallX + len * 0.5;
            if (idx === 1) runX = wallX + len;
          }
        });

        sortedSteps.forEach((step) => {
          const idx = Number.isFinite(Number(step.userData?.stepIndex)) ? Number(step.userData.stepIndex) : 0;
          if (idx <= 1) return;
          const len = getLength(step);
          step.position.x = runX + len * 0.5;
          runX += len;
        });
      }
    }

    // Width changes alter the step cutout footprint, so refresh the floor profile
    // using the current live front edge of the complete step set.
    let runX = -Infinity;
    steps.forEach((step) => {
      if (!step.geometry.boundingBox) step.geometry.computeBoundingBox();
      const bb = step.geometry.boundingBox;
      const lenX = (bb.max.x - bb.min.x) * (step.scale?.x ?? 1);
      const rightEdge = (step.position?.x ?? 0) + lenX * 0.5;
      if (rightEdge > runX) runX = rightEdge;
    });
    if (isFinite(runX)) this.updateFloorAfterStepExtension(steps, runX);

    // If the selected mesh was replaced by a recent rebuild, recover the
    // equivalent current mesh before refreshing the highlight.
    if (this.selectedStep && !steps.includes(this.selectedStep)) {
      const selectedStepIndex = Number(this.selectedStep.userData?.stepIndex);
      const replacementStep = steps.find((step) => Number(step.userData?.stepIndex) === selectedStepIndex);
      if (replacementStep) this.selectedStep = replacementStep;
    }

    if (this.selectedStep) this.updateHighlightForStep(this.selectedStep, true);
    this.ghostifyWater();
  }

  setupStepExtensionSlider() {
    const slider = document.getElementById("stepExtension");
    const output = document.getElementById("stepExtension-val");
    if (!slider) return;

    if (output) {
      output.textContent = parseFloat(slider.value).toFixed(2) + " m";
    }

    slider.addEventListener("pointerdown", () => this.captureUndoState("Step extension"));

    slider.addEventListener("input", () => {
      if (!this.selectedStep || !this.poolGroup) return;

      let val = parseFloat(slider.value);
      if (!isFinite(val)) return;

      const isDiagonal = this.isEqualCornerStepShape?.();
      const isCenteredCircular = this.isCenteredCircularStepShape?.();
      const selectedStepIndex = Number(this.selectedStep?.userData?.stepIndex);

      if (isCenteredCircular) {
        const widthMax = this.getStepWidthSliderMax?.() ?? Math.max(0.5, Number(this.poolParams?.width) || 5);
        val = THREE.MathUtils.clamp(val, Number(slider.min) || 0.1, widthMax * 0.5);
        slider.value = String(val);

        const diameter = THREE.MathUtils.clamp(val * 2, 0.2, widthMax);
        this.poolParams.stepExtension = val;
        this.poolParams.stepWidth = diameter;

        const widthSlider = document.getElementById("stepWidth");
        const widthOutput = document.getElementById("stepWidth-val");
        if (widthSlider) {
          widthSlider.min = "0.2";
          widthSlider.max = String(widthMax);
          widthSlider.value = String(diameter);
        }
        if (widthOutput) widthOutput.textContent = diameter.toFixed(2) + " m";
        if (output) output.textContent = val.toFixed(2) + " m";

        this._live.dirty.add("stepWidth");
        this._live.commitNeeded = true;
        this._live.lastInputTs = performance.now ? performance.now() : Date.now();
        this._schedulePreviewTick?.();
        this._scheduleRebuildDebounced?.();
        return;
      }

      if (isDiagonal && selectedStepIndex !== 1) {
        const maxWidth = this.getStepWidthSliderMax?.() ?? 0.6;
        val = THREE.MathUtils.clamp(val, Number(slider.min) || 0.05, maxWidth);
        slider.value = String(val);

        // For diagonal steps, width and extension are the same control value.
        // Updating either slider should resize the equal triangle in both X and Y.
        this.poolParams.stepWidth = val;
        this.poolParams.diagonalStepSize = val;
        this.poolParams.stepExtension = val;
        const widthSlider = document.getElementById("stepWidth");
        const widthOutput = document.getElementById("stepWidth-val");
        if (widthSlider) {
          widthSlider.min = slider.min;
          widthSlider.max = slider.max;
          widthSlider.value = String(val);
        }
        if (widthOutput) widthOutput.textContent = val.toFixed(2) + " m";
        if (output) output.textContent = val.toFixed(2) + " m";

        this.previewStepWidthSlider(val);
        this._scheduleRebuildDebounced?.();
        return;
      }

      // Bench Seat now uses the same relative cascade rules as Steps Only.
      // Do not treat the slider value as an absolute bench length here; the
      // bench branch below converts the relative value into the final run.

      if (output) {
        output.textContent = val.toFixed(2) + " m";
      }

      const steps = [];
      this.poolGroup.traverse((o) => {
        if (o.userData && o.userData.isStep && !o.userData.isStepAddon) steps.push(o);
      });
      if (!steps.length) return;

      steps.forEach((step) => {
        if (!step.geometry.boundingBox) {
          step.geometry.computeBoundingBox();
        }
      });

      // In Steps Only mode the slider value is not the selected step's total run.
      // It is the extra run beyond the previous/upper step, so the nested logic
      // below must calculate the final absolute run before scaling anything.
      // Relative cascade modes calculate the final absolute run before scaling.
      // Scaling the selected mesh here would double-apply the slider value.

      // Keep the selected step anchored to its back edge, then move every
      // downstream step with it. This restores the original chained behaviour
      // while keeping the full-width second step stretched back to the wall.
      let wallX = Infinity;
      const outerPts = this.poolGroup.userData?.outerPts;
      if (Array.isArray(outerPts) && outerPts.length) {
        outerPts.forEach((p) => {
          const x = p?.x;
          if (isFinite(x) && x < wallX) wallX = x;
        });
      }
      if (!isFinite(wallX)) {
        steps.forEach((step) => {
          const geo = step.geometry;
          const bbox = geo.boundingBox;
          const baseLen = bbox.max.x - bbox.min.x;
          const length = baseLen * step.scale.x;
          const leftEdge = step.position.x - length * 0.5;
          if (leftEdge < wallX) wallX = leftEdge;
        });
      }
      if (!isFinite(wallX)) return;

      const sortedSteps = steps
        .slice()
        .sort((a, b) => {
          const ai = Number.isFinite(Number(a.userData?.stepIndex)) ? Number(a.userData.stepIndex) : 0;
          const bi = Number.isFinite(Number(b.userData?.stepIndex)) ? Number(b.userData.stepIndex) : 0;
          return ai - bi;
        });

      const selectedIndex = Number.isFinite(Number(this.selectedStep.userData?.stepIndex))
        ? Number(this.selectedStep.userData.stepIndex)
        : sortedSteps.indexOf(this.selectedStep);

      const getStepLength = (step) => {
        const geo = step.geometry;
        const bbox = geo.boundingBox;
        const baseLen = bbox.max.x - bbox.min.x;
        return baseLen * step.scale.x;
      };

      // Steps Only mode is wall-backed/nested. The generated layout starts as
      // 300 mm tier offsets, but the Step Extension slider is now relative:
      // 0.00 m = the front edge of the previous/upper step. Extending a tier
      // pushes that tier forward, and every lower tier moves forward with it so
      // an upper tier can never overhang/be wider than the tier below it.
      if (this.getStepBenchMode?.() === "stepsOnly") {
        // Use the visible sorted order for cascade behaviour, not only the
        // saved stepIndex. Some layouts can keep legacy/custom stepIndex values,
        // but the physical rule is always: selected tier pushes every tier below it.
        const selectedRank = Math.max(0, sortedSteps.indexOf(this.selectedStep));
        const selectedTier = Number.isFinite(selectedIndex) ? selectedIndex : selectedRank;
        const customRuns = { ...(this.poolParams.stepsOnlyStepRuns || {}) };
        const tierOffset = 0.3;

        const getCurrentRun = (step) => {
          const geo = step?.geometry;
          if (!geo) return 0;
          if (!geo.boundingBox) geo.computeBoundingBox();
          const bbox = geo.boundingBox;
          const baseLen = bbox.max.x - bbox.min.x;
          const scaledLen = baseLen * (step.scale?.x ?? 1);
          const savedRun = Number(step.userData?.stepRun);
          return Number.isFinite(scaledLen) && scaledLen > 0
            ? scaledLen
            : (Number.isFinite(savedRun) && savedRun > 0 ? savedRun : 0.3);
        };

        const currentRuns = new Map();
        sortedSteps.forEach((step) => {
          const stepIndex = Number.isFinite(Number(step.userData?.stepIndex))
            ? Number(step.userData.stepIndex)
            : sortedSteps.indexOf(step);

          if (!Number.isFinite(Number(step.userData?.defaultStepsOnlyRun))) {
            step.userData.defaultStepsOnlyRun = getCurrentRun(step);
          }

          const overrideRun = Number(this.poolParams.stepsOnlyStepRuns?.[String(stepIndex)]);
          const run = Number.isFinite(overrideRun) && overrideRun > 0
            ? overrideRun
            : getCurrentRun(step);
          currentRuns.set(stepIndex, Math.max(0.05, run));
        });

        const previousRun = selectedTier > 0
          ? Math.max(0, currentRuns.get(selectedTier - 1) || 0)
          : 0;
        const oldSelectedRun = Math.max(0.05, currentRuns.get(selectedTier) || getCurrentRun(this.selectedStep));
        const targetSelectedRun = Math.max(0.05, previousRun + Math.max(0, val));
        const delta = targetSelectedRun - oldSelectedRun;

        let priorRun = 0;
        sortedSteps.forEach((step, rank) => {
          const stepIndex = Number.isFinite(Number(step.userData?.stepIndex))
            ? Number(step.userData.stepIndex)
            : rank;

          const geo = step.geometry;
          const bbox = geo.boundingBox;
          const baseLen = bbox.max.x - bbox.min.x;
          if (!Number.isFinite(baseLen) || baseLen <= 0) return;

          const currentRun = Math.max(0.05, currentRuns.get(stepIndex) || getCurrentRun(step));
          let targetRun = currentRun;

          if (rank === selectedRank) {
            targetRun = targetSelectedRun;
          } else if (rank > selectedRank) {
            // Any tier below the selected tier must travel with it. This keeps
            // the selected/upper step from ever projecting past the lower tier.
            targetRun = Math.max(currentRun + delta, priorRun + tierOffset);
          }

          targetRun = Math.max(0.05, targetRun);
          step.scale.x = targetRun / baseLen;
          step.position.x = wallX + targetRun * 0.5;
          step.userData.stepRun = targetRun;
          customRuns[String(stepIndex)] = targetRun;
          priorRun = targetRun;
          this.updateScaledBoxTilingUVs(step);
        });

        this.poolParams.stepsOnlyStepRuns = customRuns;

        // Slider displays only the extra distance beyond the previous step.
        slider.value = String(Math.max(0, targetSelectedRun - previousRun));
        if (output) output.textContent = Math.max(0, targetSelectedRun - previousRun).toFixed(2) + " m";

        // With Steps Only, the pool floor/transition stays locked to the entry
        // wall. Step footprints must not move the floor transition or flatten it.
        this.updateFloorAfterStepExtension(steps, wallX);
        this.updateHighlightForStep(this.selectedStep, true);
        this.ghostifyWater();
        return;
      }

      if (this.getStepBenchMode?.() === "bench") {
        // Bench Seat uses the same relative extension rule as Steps Only:
        // 0.00 m = selected tier ends at the previous/upper tier's front edge.
        // Extending an upper tier carries the full-width bench with it so the
        // upper step can never project beyond the bench below. Steps after the
        // bench remain chained from the live bench/front edge and therefore move
        // forward with the changed tier.
        const getFrontEdge = (step) => step.position.x + getStepLength(step) * 0.5;
        const selectedRank = Math.max(0, sortedSteps.indexOf(this.selectedStep));
        const selectedTier = Number.isFinite(selectedIndex) ? selectedIndex : selectedRank;
        const previousStep = selectedRank > 0 ? sortedSteps[selectedRank - 1] : null;
        const previousFront = previousStep ? getFrontEdge(previousStep) : wallX;
        const oldSelectedFront = getFrontEdge(this.selectedStep);
        const oldSelectedLength = getStepLength(this.selectedStep);
        const targetSelectedFront = previousFront + Math.max(0, val);
        const targetSelectedLength = Math.max(0.05, selectedRank <= 1
          ? targetSelectedFront - wallX
          : targetSelectedFront - previousFront);
        const deltaFront = targetSelectedFront - oldSelectedFront;

        let benchFrontX = wallX;
        let chainX = wallX;
        sortedSteps.forEach((step, rank) => {
          const stepIndex = Number.isFinite(Number(step.userData?.stepIndex))
            ? Number(step.userData.stepIndex)
            : rank;

          const geo = step.geometry;
          const bbox = geo.boundingBox;
          const baseLen = bbox.max.x - bbox.min.x;
          if (!Number.isFinite(baseLen) || baseLen <= 0) return;

          let targetLength = getStepLength(step);

          if (rank === selectedRank) {
            targetLength = targetSelectedLength;
          } else if (rank > selectedRank && stepIndex <= 1) {
            // The bench is wall-backed, so it must grow when an upper wall-backed
            // step grows. This is the key rule that prevents the first step from
            // becoming wider/deeper than the bench below it.
            targetLength = Math.max(0.05, targetLength + deltaFront);
            const upper = rank > 0 ? sortedSteps[rank - 1] : null;
            if (upper) targetLength = Math.max(targetLength, getStepLength(upper));
          }

          step.scale.x = targetLength / baseLen;

          if (stepIndex <= 1) {
            step.position.x = wallX + targetLength * 0.5;
            if (stepIndex === 1) {
              benchFrontX = wallX + targetLength;
              chainX = benchFrontX;
              this.poolParams.bench2Extension = targetLength;
            }
          } else {
            // Lower steps are chained from the current bench/previous step edge.
            // They move forward when anything above them extends. If one of these
            // chained steps is selected, only that tread length changes and all
            // subsequent treads shift from its new front edge.
            if (rank === selectedRank) targetLength = targetSelectedLength;
            step.scale.x = targetLength / baseLen;
            step.position.x = chainX + targetLength * 0.5;
            chainX += targetLength;
          }

          step.userData.stepRun = targetLength;
          this.updateScaledBoxTilingUVs(step);
        });

        if (this.isEqualCornerStepShape?.()) {
          const capped = Math.min(this.getDiagonalStepSizeValue(), this.getBench2ExtensionValue());
          this.poolParams.diagonalStepSize = capped;
          this.poolParams.stepWidth = capped;
          this.syncStepWidthSliderLimit?.();
        }

        // Bench Seat keeps the floor transition tied to the second/full-width
        // bench. updateFloorAfterStepExtension locates stepIndex 1 for the
        // origin, so extra lower treads do not move the floor transition.
        this.updateFloorAfterStepExtension(steps, benchFrontX);
        this.updateHighlightForStep(this.selectedStep, true);
        this.ghostifyWater();
        return;
      }

      // Locked preset behaviour:
      // - steps 1 and 2 stay backed to the entry wall
      // - step 2 is the full-width bench/ledge and must never drift off the wall
      // - every step after step 2 chains from the live front edge of step 2
      let runX = wallX;
      sortedSteps.forEach((step) => {
        const stepIndex = Number.isFinite(Number(step.userData?.stepIndex))
          ? Number(step.userData.stepIndex)
          : sortedSteps.indexOf(step);

        const length = getStepLength(step);

        if (stepIndex <= 1) {
          step.position.x = wallX + length * 0.5;
          if (stepIndex === 1) runX = wallX + length;
        }
      });

      sortedSteps.forEach((step) => {
        const stepIndex = Number.isFinite(Number(step.userData?.stepIndex))
          ? Number(step.userData.stepIndex)
          : sortedSteps.indexOf(step);

        if (stepIndex <= 1) return;

        const length = getStepLength(step);
        step.position.x = runX + length * 0.5;
        runX += length;
      });

      // The floor needs to start after the outermost live step footprint.
      sortedSteps.forEach((step) => {
        const rightEdge = step.position.x + getStepLength(step) * 0.5;
        if (rightEdge > runX) runX = rightEdge;
      });

      // Rebake UVs so tile density stays fixed after scaling/position changes
      steps.forEach((s) => this.updateScaledBoxTilingUVs(s));

      // Reprofile floor: move slope origin + cut out under steps
      this.updateFloorAfterStepExtension(steps, runX);

      this.updateHighlightForStep(this.selectedStep, true);
      this.ghostifyWater();
    });
  }

  // --------------------------------------------------------------
  // WALL SELECTION (hover + double-click) – opens Features panel
  // --------------------------------------------------------------
  setupWallSelection() {
    if (!this.renderer || !this.camera) return;
    const dom = this.renderer.domElement;

    // Hover: always allowed, independent of panel state
    dom.addEventListener("pointermove", (event) => {
      if (!this.poolGroup) return;

      if (this.poolEditor?.isDragging) return;

      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, this.camera);

      const walls = [];
      this.poolGroup.traverse((o) => o.userData?.isWall && walls.push(o));

      if (!walls.length) {
        this.clearWallHoverHighlight();
        return;
      }

      const hit = ray.intersectObjects(walls, true);
      if (!hit.length) {
        this.hoveredCustomizeCurveEdgeIndex = null;
        this.clearWallHoverHighlight();
        if (this.customizeMode && !this.customizePreview) this.refreshCustomizeHint();
        return;
      }

      const wall = hit[0].object;
      const hoveredCurveEdge = (() => {
        if (!this.customizeMode) return null;
        const idx = wall?.userData?.sourceEdgeIndex;
        if (!Number.isInteger(idx)) return null;
        const curvedFromWall = !!wall?.userData?.sourceEdgeCurved;
        const curvedFromPolygon = !!this.editablePolygon?.getEdge?.(idx)?.isCurved;
        return (curvedFromWall || curvedFromPolygon) ? idx : null;
      })();

      if (wall === this.selectedWall && !Number.isInteger(hoveredCurveEdge)) {
        this.clearWallHoverHighlight();
        return;
      }

      if (Number.isInteger(hoveredCurveEdge) && this.isPolygonShape()) {
        if (this.hoveredCustomizeCurveEdgeIndex !== hoveredCurveEdge) {
          this.hoveredCustomizeCurveEdgeIndex = hoveredCurveEdge;
          this.hoveredWall = wall;
          this.updateHighlightForWall(wall, false);
          this.refreshCustomizeHint("Click the curved wall to edit its radius or revert it back to a square corner.");
        }
        return;
      }

      this.hoveredCustomizeCurveEdgeIndex = null;
      if (wall !== this.hoveredWall) {
        this.hoveredWall = wall;
        this.updateHighlightForWall(wall, false);
      }
    });

    // Single-click curved walls to jump straight into customise mode, or pick walls while customising
    dom.addEventListener("click", (event) => {
      if (event.button !== 0) return;
      if (!this.poolGroup) return;

      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, this.camera);

      const walls = [];
      this.poolGroup.traverse((o) => o.userData?.isWall && walls.push(o));

      const hit = walls.length ? ray.intersectObjects(walls, true) : [];
      if (!hit.length) return;

      const pickedWall = hit[0].object;
      const curvedSourceEdge = (() => {
        const idx = pickedWall?.userData?.sourceEdgeIndex;
        if (!Number.isInteger(idx)) return null;
        const curvedFromWall = !!pickedWall?.userData?.sourceEdgeCurved;
        const curvedFromPolygon = !!this.editablePolygon?.getEdge?.(idx)?.isCurved;
        return (curvedFromWall || curvedFromPolygon) ? idx : null;
      })();

      if (Number.isInteger(curvedSourceEdge) && this.isPolygonShape()) {
        if (!this.customizeMode) {
          this.setCustomizeMode(true);
        }
        this.selectExistingCurvedEdgeForCustomize(curvedSourceEdge, pickedWall);
        return;
      }

      if (!this.customizeMode) return;
      this.handleCustomizeWallPick(pickedWall, hit[0].point);
    });

    // Select: pick wall, open Features panel, sync slider
    dom.addEventListener("dblclick", (event) => {
      if (event.button !== 0) return;
      if (!this.poolGroup) return;

      const rect = dom.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, this.camera);

      const walls = [];
      this.poolGroup.traverse((o) => o.userData?.isWall && walls.push(o));

      const hit = walls.length ? ray.intersectObjects(walls, true) : [];
      if (!hit.length) {
        const hadSel = !!this.selectedWall;
        this.clearWallSelectedHighlight();
        if (hadSel) {
          document.dispatchEvent(new CustomEvent("wallSelectionCleared"));
        }
        return;
      }

      const wall = hit[0].object;
      this.selectedWall = wall;

      this.updateHighlightForWall(wall, true);
      this.clearWallHoverHighlight();
      this.focusCameraOnWall(wall);

      // Open Features panel via UI helper, if available
      if (window.openPanelFromCode) {
        window.openPanelFromCode("features");
      }

      // initialise slider UI from wall meta
      const row = document.getElementById("wallRaiseRow");
      const slider = document.getElementById("wallRaise");
      const valSpan = document.getElementById("wallRaise-val");

      if (row) row.style.display = "block";

      if (slider) {
        let baseHeight = wall.userData?.baseHeight;
        if (!isFinite(baseHeight) || baseHeight <= 0) {
          const params = wall.geometry?.parameters;
          baseHeight =
            (params && typeof params.depth === "number" && params.depth > 0)
              ? params.depth
              : 1;
          wall.userData.baseHeight = baseHeight;
        }

        const currentHeight =
          wall.userData?.currentHeight ?? baseHeight * (wall.scale?.z || 1);
        const savedExtra = this.wallRaiseBySourceEdge?.[this._getWallRaiseKey(wall)] ?? null;
        const extra = Math.max(0, Number.isFinite(savedExtra) ? savedExtra : (currentHeight - baseHeight));

        slider.disabled = false;
        slider.value = extra.toFixed(2);

        if (valSpan) {
          valSpan.textContent = extra.toFixed(2) + " m";
        }
      }

      document.dispatchEvent(new CustomEvent("wallSelected"));
    });
  }

  // --------------------------------------------------------------
  // WALL RAISE SLIDER
  //  - raises selected wall
  //  - raises coping:
  //      * per-wall, if copingSegments + wall.copingIndex exist
  //      * otherwise, global ring coping using max extra
  // --------------------------------------------------------------
  setupWallRaiseSlider() {
    const slider = document.getElementById("wallRaise");
    const output = document.getElementById("wallRaise-val");
    if (!slider) return;

    if (output) {
      output.textContent = parseFloat(slider.value || "0").toFixed(2) + " m";
    }

    slider.addEventListener("pointerdown", () => this.captureUndoState("Wall raise"));

    slider.addEventListener("input", () => {
      if (!this.selectedWall || !this.poolGroup) return;

      const extra = parseFloat(slider.value || "0");
      if (!isFinite(extra)) return;

      if (output) {
        output.textContent = extra.toFixed(2) + " m";
      }

      const key = this._getWallRaiseKey(this.selectedWall);
      if (key == null) return;

      this.wallRaiseBySourceEdge[key] = Math.max(0, extra);
      this._applyWallExtraToMeshesFromKey(key, extra);
      this.updateHighlightForWall(this.selectedWall, true);
    });
  }


  _clonePoolParams() {
    return JSON.parse(JSON.stringify(this.poolParams));
  }

  _serializeEditablePolygon() {
    if (!this.editablePolygon) return null;
    return {
      vertices: this.editablePolygon.vertices.map((v) => ({ x: v.x, y: v.y })),
      edges: this.editablePolygon.edges.map((e) => ({
        isCurved: !!e?.isCurved,
        control: e?.control ? { x: e.control.x, y: e.control.y } : null
      })),
      minVertices: this.editablePolygon.minVertices,
      isRectangular: !!this.editablePolygon.isRectangular
    };
  }

  _restoreEditablePolygon(data) {
    if (!data) {
      this.editablePolygon = null;
      return;
    }

    const poly = new EditablePolygon(
      (data.vertices || []).map((v) => new THREE.Vector2(v.x, v.y))
    );

    if (Array.isArray(data.edges) && data.edges.length === poly.edges.length) {
      poly.edges = data.edges.map((e) => ({
        isCurved: !!e?.isCurved,
        control: e?.control ? new THREE.Vector2(e.control.x, e.control.y) : null
      }));
    }

    poly.minVertices = data.minVertices ?? 3;
    poly.isRectangular = !!data.isRectangular;
    this.editablePolygon = poly;
  }

  captureUndoState(_reason = "") {
    if (this.isRestoringUndo) return;

    const stack = Array.isArray(this.undoStack) ? this.undoStack : [];
    const redo = Array.isArray(this.redoStack) ? this.redoStack : [];
    const limit = Number.isFinite(this.undoLimit) ? this.undoLimit : 50;

    this.undoStack = stack;
    this.redoStack = redo;
    this.undoLimit = limit;

    const snapshot = {
      poolParams: this._clonePoolParams(),
      editablePolygon: this._serializeEditablePolygon(),
      baseShapeType: this.baseShapeType,
      isCustomShape: !!this.isCustomShape,
      wallRaiseBySourceEdge: JSON.parse(JSON.stringify(this.wallRaiseBySourceEdge || {})),
      hasSpa: !!this.spa,
      spa: this.spa ? {
        spaShape: this.spa.userData?.spaShape ?? "square",
        spaLength: this.spa.userData?.spaLength ?? 2,
        spaWidth: this.spa.userData?.spaWidth ?? 2,
        topHeight: this.spa.userData?.spaTopHeight ?? 0,
        position: this.spa?.position ? {
          x: this.spa.position.x,
          y: this.spa.position.y,
          z: this.spa.position.z
        } : null
      } : null
    };

    let serialized = "";
    try {
      serialized = JSON.stringify(snapshot);
    } catch (_err) {
      serialized = "";
    }

    const last = stack.length ? stack[stack.length - 1] : null;
    if (last && serialized) {
      try {
        if (JSON.stringify(last) === serialized) return;
      } catch (_err) {}
    }

    stack.push(snapshot);
    if (stack.length > limit) {
      stack.shift();
    }
    redo.length = 0;
    this.updateUndoButtonState();
  }

  updateUndoButtonState() {
    const btn = document.getElementById("undoBtn");
    if (!btn) return;
    const undoCount = Array.isArray(this.undoStack) ? this.undoStack.length : 0;
    btn.disabled = undoCount === 0;
  }

  async undoLastChange() {
    if (!Array.isArray(this.undoStack) || !this.undoStack.length) return;

    const snapshot = this.undoStack.pop();
    this.updateUndoButtonState();
    if (!snapshot) return;

    this.isRestoringUndo = true;
    try {
      this.poolParams = JSON.parse(JSON.stringify(snapshot.poolParams || this.poolParams));
      this.baseShapeType = snapshot.baseShapeType || this.poolParams.shape;
      this.isCustomShape = !!snapshot.isCustomShape;
      this.wallRaiseBySourceEdge = JSON.parse(JSON.stringify(snapshot.wallRaiseBySourceEdge || {}));
      this._restoreEditablePolygon(snapshot.editablePolygon || null);

      const shapeSelect = document.getElementById("shape");
      if (shapeSelect) shapeSelect.value = this.poolParams.shape;

      this.updateShapeUIVisibility();
    this.refreshDisplayedShapeLabel();
      this.refreshDisplayedShapeLabel();
      this.syncSlidersFromParams();

      if (snapshot.hasSpa) {
        if (!this.spa) {
          this.spa = createSpa(this.poolParams, this.scene, {
            tileSize: this.tileSize,
            shape: snapshot?.spa?.spaShape || this.getSelectedSpaShape()
          });
    this.spa.userData.poolGroup = this.poolGroup || null;
          this.spa.userData.poolGroup = this.poolGroup || null;
        }
        if (snapshot.spa) {
          this.spa.userData.poolGroup = this.poolGroup || null;
          this.spa.userData.poolParams = this.poolParams;
          this.spa.userData.spaShape = snapshot.spa.spaShape || "square";
          const spaShapeSelect = document.getElementById("spaShape");
          if (spaShapeSelect) spaShapeSelect.value = this.spa.userData.spaShape;
          this.spa.userData.spaLength = snapshot.spa.spaLength;
          this.spa.userData.spaWidth = snapshot.spa.spaWidth;
          this.spa.userData.spaTopHeight = snapshot.spa.topHeight ?? 0;
          if (snapshot.spa.position) {
            this.spa.position.set(snapshot.spa.position.x, snapshot.spa.position.y, snapshot.spa.position.z ?? 0);
          }
          setSpaTopOffset(snapshot.spa.topHeight ?? 0);
          updateSpa(this.spa);
          snapToPool(this.spa);
          await this.pbrManager?.applyTilesToSpa?.(this.spa);
          this.setSpaSlidersEnabled(true);
          this.refreshSpaTopOffsetSlider();
          const spaBtn = document.getElementById("addRemoveSpa");
          if (spaBtn) spaBtn.textContent = "Remove Spa";
        }
      } else if (this.spa) {
        this.removeSpa();
        const spaBtn = document.getElementById("addRemoveSpa");
        if (spaBtn) spaBtn.textContent = "Add Spa";
        this.refreshSpaDimensionLabels();
      }

      await this.rebuildPoolForCurrentShape();
      this.focusCameraOnPoolShape();
      window.openPanelFromCode?.("shape");
    } finally {
      this.isRestoringUndo = false;
    }
  }

  setupGlobalActionButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const screenshotBtn = document.getElementById("screenshotBtn");

    undoBtn?.addEventListener("click", async () => {
      await this.undoLastChange();
    });

    screenshotBtn?.addEventListener("click", async (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!this.renderer?.domElement) return;

      try {
        await this.captureCurrentCanvasScreenshot();
      } catch (err) {
        console.error("[PoolApp] Screenshot failed.", err);
      }
    });

    this.updateUndoButtonState();
  }


  async captureCurrentCanvasScreenshot() {
    const sourceCanvas = this.renderer?.domElement;
    if (!sourceCanvas) return;

    // Screenshot is now a pure pixel-copy of the already-rendered canvas.
    // Do not call renderer.render(), controls.update(), camera movement,
    // section refresh, cap rebuild, void refresh, PBR refresh, or caustics here.
    // The section + spa channel state is made from live temporary shader/cap/void
    // state, and rendering from the screenshot button can corrupt that state.
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });

    const width = sourceCanvas.width || sourceCanvas.clientWidth || 1;
    const height = sourceCanvas.height || sourceCanvas.clientHeight || 1;
    const copyCanvas = document.createElement("canvas");
    copyCanvas.width = width;
    copyCanvas.height = height;

    const ctx = copyCanvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not create screenshot canvas context.");
    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    const filename = `pool-designer-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    const triggerDownload = (href) => {
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    if (copyCanvas.toBlob) {
      await new Promise((resolve, reject) => {
        copyCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Screenshot canvas did not produce a PNG blob."));
            return;
          }
          const url = URL.createObjectURL(blob);
          try {
            triggerDownload(url);
            resolve();
          } catch (err) {
            reject(err);
          } finally {
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }, "image/png");
      });
    } else {
      triggerDownload(copyCanvas.toDataURL("image/png"));
    }
  }

  // --------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------
  isPolygonShape() {
    return this.poolParams.shape === "freeform" || (!!this.editablePolygon && !!this.isCustomShape);
  }

  normalizeStarterPresetParams(params = {}) {
    return {
      ...params,
      shallow: 1.2,
      deep: 1.8,
      shallowFlat: 1,
      deepFlat: 1
    };
  }

  createRoundedCornerRectanglePolygon(length, width, radius = 2, corner = "back-right") {
    const l = Math.max(0.1, Number(length) || 6);
    const w = Math.max(0.1, Number(width) || 4);
    const r = Math.min(Math.max(0.05, Number(radius) || 2), l * 0.5, w * 0.5);
    const x0 = -l * 0.5;
    const x1 = l * 0.5;
    const y0 = -w * 0.5;
    const y1 = w * 0.5;
    const pts = [];
    const add = (x, y) => pts.push(new THREE.Vector2(x, y));
    const arc = (cx, cy, a0, a1, segments = 18) => {
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = a0 + (a1 - a0) * t;
        add(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    };

    const selected = String(corner || "back-right").toLowerCase();

    if (selected === "front-left") {
      add(x0 + r, y0);
      add(x1, y0);
      add(x1, y1);
      add(x0, y1);
      add(x0, y0 + r);
      arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
    } else if (selected === "front-right") {
      add(x0, y0);
      add(x1 - r, y0);
      arc(x1 - r, y0 + r, Math.PI * 1.5, Math.PI * 2);
      add(x1, y1);
      add(x0, y1);
    } else if (selected === "back-left") {
      add(x0, y0);
      add(x1, y0);
      add(x1, y1);
      add(x0 + r, y1);
      arc(x0 + r, y1 - r, Math.PI * 0.5, Math.PI);
    } else {
      // back-right: opposite corner from the default left-side entry steps.
      add(x0, y0);
      add(x1, y0);
      add(x1, y1 - r);
      arc(x1 - r, y1 - r, 0, Math.PI * 0.5);
      add(x0, y1);
    }

    const clean = [];
    for (const point of pts) {
      const last = clean[clean.length - 1];
      if (!last || last.distanceToSquared(point) > 1e-10) clean.push(point);
    }

    const poly = new EditablePolygon(clean);
    poly.isRectangular = false;
    poly.minVertices = 3;
    return poly;
  }

  createStarterFootprintPolygon(preset) {
    const fp = preset?.customFootprint;
    if (!fp || fp.type !== "rounded-corner-rectangle") return null;
    const params = preset?.params || {};
    return this.createRoundedCornerRectanglePolygon(
      params.length,
      params.width,
      fp.radius,
      fp.corner
    );
  }

  destroyPoolEditor() {
    if (this.poolEditor) {
      this.poolEditor.dispose?.();
      this.poolEditor = null;
    }
    this._purgePoolEditorHandles();
  }

  _purgePoolEditorHandles() {
    if (!this.scene) return;
    const stale = [];
    this.scene.traverse((o) => {
      if (o?.userData?.kind === "vertex" || o?.userData?.kind === "edge") stale.push(o);
    });
    stale.forEach((o) => {
      try { o.parent?.remove(o); } catch (_) {}
      try { o.geometry?.dispose?.(); } catch (_) {}
      try { o.material?.dispose?.(); } catch (_) {}
    });
  }

  _getWallRaiseKey(wall) {
    if (!wall?.userData) return null;
    if (Number.isInteger(wall.userData.sourceEdgeIndex)) return `src:${wall.userData.sourceEdgeIndex}`;
    if (Number.isInteger(wall.userData.edgeIndex)) return `edge:${wall.userData.edgeIndex}`;
    return null;
  }

  _applyWallExtraToMeshesFromKey(key, extra = 0) {
    if (!this.poolGroup || key == null) return;

    const walls = [];
    this.poolGroup.traverse((o) => {
      if (o?.userData?.isWall && this._getWallRaiseKey(o) === key) walls.push(o);
    });
    if (!walls.length) return;

    const safeExtra = Math.max(0, Number.isFinite(extra) ? extra : 0);
    const copingSegments = this.poolGroup.userData?.copingSegments;
    const resolveCopingSegmentForWall = (wall) => {
      if (!copingSegments) return null;
      if (Array.isArray(copingSegments)) {
        const idx = wall?.userData?.copingIndex;
        return (idx != null) ? copingSegments[idx] : null;
      }
      const key = wall?.userData?.copingKey ?? wall?.userData?.side;
      if (key != null && typeof copingSegments === "object") {
        return copingSegments[key] || null;
      }
      return null;
    };

    walls.forEach((wall) => {
      let baseHeight = wall.userData?.baseHeight;
      if (!isFinite(baseHeight) || baseHeight <= 0) {
        const params = wall.geometry?.parameters;
        baseHeight = (params && typeof params.depth === "number" && params.depth > 0) ? params.depth : 1;
        wall.userData.baseHeight = baseHeight;
      }

      const newHeight = baseHeight + safeExtra;
      const scaleZ = newHeight / baseHeight;
      wall.scale.z = scaleZ;
      // v7.1-style wall raise behaviour: keep the bottom anchored at the pool
      // floor depth while the top rises by half of the added height.
      wall.position.z = -(baseHeight / 2) + safeExtra / 2;
      wall.userData.currentHeight = newHeight;
      wall.userData.extraHeight = safeExtra;
      try { this.updateScaledBoxTilingUVs(wall); } catch (_) {}

      const seg = resolveCopingSegmentForWall(wall);
      if (seg) {
        if (!seg.userData) seg.userData = {};
        if (seg.userData.baseZ == null) seg.userData.baseZ = seg.position.z;
        seg.position.z = seg.userData.baseZ + safeExtra;
      }
    });

    const copingRing = this.poolGroup.userData?.copingMesh;
    if (!copingSegments && copingRing) {
      if (!copingRing.userData) copingRing.userData = {};
      if (copingRing.userData.baseZ == null) copingRing.userData.baseZ = copingRing.position.z;
      let maxExtra = 0;
      this.poolGroup.traverse((o) => {
        if (!o?.userData?.isWall) return;
        const e = o.userData?.extraHeight || 0;
        if (e > maxExtra) maxExtra = e;
      });
      copingRing.position.z = copingRing.userData.baseZ + maxExtra;
    }
  }

  _reapplySavedWallRaiseState() {
    if (!this.poolGroup) return;
    const entries = Object.entries(this.wallRaiseBySourceEdge || {});
    entries.forEach(([key, extra]) => {
      if (Number.isFinite(extra) && extra > 0) {
        this._applyWallExtraToMeshesFromKey(key, extra);
      }
    });
  }

  // --------------------------------------------------------------
  // REBUILD POOL
  // --------------------------------------------------------------
  async rebuildPoolForCurrentShape() {
    if (this.poolGroup) {
      this._removePoolGroupSafely(this.poolGroup);
    }

    let group;

    if (this.isPolygonShape()) {
      if (!this.editablePolygon) {
        this.editablePolygon = EditablePolygon.fromRectangle(
          this.poolParams.length,
          this.poolParams.width
        );
        this.editablePolygon.isRectangular = true;
        this.editablePolygon.minVertices = 3;
      }

      group = createPoolGroup(
        this.poolParams,
        this.tileSize,
        this.editablePolygon
      );
    } else {
      this.editablePolygon = null;
      this.destroyPoolEditor();

      const shape = this.poolParams.shape;

      if (shape === "rectangular")
        group = createRectanglePool(this.poolParams, this.tileSize);
      else if (shape === "oval")
        group = createOvalPool(this.poolParams, this.tileSize);
      else if (shape === "kidney")
        group = createKidneyPool(this.poolParams, this.tileSize);
      else if (shape === "L")
        group = createLShapePool(this.poolParams, this.tileSize);
      else group = createRectanglePool(this.poolParams, this.tileSize);
    }

    this.poolGroup = group;

    // Ensure fixed tile density + snapped grout after any rebuild (shape/params)
    this.rebakePoolTilingUVs();

    if (this.scene && this.poolGroup) {
      this.scene.add(this.poolGroup);
updateGroundVoid(this.ground || this.scene.userData.ground, this.poolGroup, this.spa);
      updateGrassForPool(this.scene, this.poolGroup);
    }

    if (this.pbrManager && this.poolGroup) {
      this.pbrManager.setPoolGroup(this.poolGroup);
      this.pbrManager.updatePoolParamsRef(this.poolParams);
      if (this.poolParams?.tileColor) this.pbrManager.currentTileKey = this.poolParams.tileColor;
      await this.pbrManager.applyCurrentToGroup();
    }

    if (this.spa && this.poolGroup && this.pbrManager) {
      this.spa.userData.poolGroup = this.poolGroup || null;
      this.spa.userData.poolParams = this.poolParams;
      snapToPool(this.spa);
      updateSpa(this.spa);
      await this.pbrManager.applyTilesToSpa(this.spa);
      updatePoolWaterVoid(this.poolGroup, this.spa);
      updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
    }

    this._reapplySavedWallRaiseState();

    if (this.poolParams.shape === "freeform" && this.editablePolygon) {
      this.setupPoolEditor();
    } else {
      this.destroyPoolEditor();
    }

    if (this.sectionViewEnabled) {
      await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });
    }

    // Clear step selection and notify UI
    const hadSelection = !!this.selectedStep;
    this.clearHoverHighlight();
    this.clearSelectedHighlight();
    if (hadSelection) {
      document.dispatchEvent(new CustomEvent("stepSelectionCleared"));
      document.dispatchEvent(new CustomEvent("stepsPanelClosed"));
      this.restoreWater();
    }

    // Clear wall selection and notify UI
    const hadWallSel = !!this.selectedWall;
    this.clearWallHoverHighlight();
    this.clearWallSelectedHighlight();
    if (hadWallSel) {
      document.dispatchEvent(new CustomEvent("wallSelectionCleared"));
    }

    if (!this.spa) {
      this.selectedSpa = null;
    this.hoveredSpa = null;
    this.hoverSpaHighlight = null;
    this.selectedSpaHighlight = null;
      setSelectedSpa(null);
    }

    // If steps panel currently open (from UI), keep water ghosted
    const stepsPanel = document.getElementById("panel-steps");
    if (stepsPanel?.classList.contains("open")) this.ghostifyWater();

    // Reset any preview scaling and capture baseline params after an expensive rebuild
    try { this.poolGroup.scale.set(1, 1, 1); } catch (_) {}
    this._live.baseParams = { ...this.poolParams };
    this._live.commitNeeded = false;
    this._live.dirty.clear();
  }


  // --------------------------------------------------------------
  // STARTER PRESET SCREEN
  // --------------------------------------------------------------
  setupStarterPresetScreen() {
    const overlay = document.getElementById("starterPresetOverlay");
    const grid = document.getElementById("starterPresetGrid");
    if (!overlay || !grid || grid.dataset.initialized === "true") return;

    grid.dataset.initialized = "true";
    grid.innerHTML = "";

    STARTER_POOL_PRESETS.forEach((preset) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "starter-card";
      card.dataset.presetId = preset.id;
      card.dataset.preview = preset.preview || "rectangle";
      card.dataset.spa = preset.spa ? "true" : "false";
      if (preset.spa?.shape) card.dataset.spaShape = preset.spa.shape;
      card.innerHTML = `
        <div class="starter-preview" aria-hidden="true"></div>
        <div class="starter-card-body">
          <h2 class="starter-card-title">${preset.title}</h2>
          <p class="starter-card-desc">${preset.description}</p>
          <span class="starter-card-action">Start Design</span>
        </div>
      `;

      card.addEventListener("click", async () => {
        card.disabled = true;
        try {
          await this.applyStarterPreset(preset);
          overlay.classList.add("hidden");
        } catch (err) {
          console.error("[PoolApp] Failed to apply starter preset", preset, err);
          card.disabled = false;
        }
      });

      grid.appendChild(card);
    });
  }

  async applyStarterPreset(preset) {
    if (!preset) return;

    if (this.sectionViewEnabled) {
      try { await this.setSectionViewEnabled(false); } catch (_) {}
    }

    this.captureUndoState?.(`Starter preset: ${preset.title || preset.id}`);
    this.destroyPoolEditor();
    this._purgePoolEditorHandles?.();
    this.clearHoverHighlight?.();
    this.clearSelectedHighlight?.();
    this.clearWallHoverHighlight?.();
    this.clearWallSelectedHighlight?.();
    this.clearSpaHoverHighlight?.();
    this.clearSpaSelectedHighlight?.();

    if (this.spa) {
      this.removeSpa();
    }

    this.poolParams = {
      ...this.poolParams,
      ...this.normalizeStarterPresetParams(preset.params || {})
    };

    const starterFootprint = this.createStarterFootprintPolygon(preset);
    this.baseShapeType = this.poolParams.shape;
    this.isCustomShape = !!starterFootprint;
    this.editablePolygon = starterFootprint;
    this.wallRaiseBySourceEdge = {};
    this.selectedStep = null;
    this.selectedWall = null;

    this.updateShapeUIVisibility();
    this.syncSlidersFromParams();
    this.refreshDisplayedShapeLabel();

    await this.rebuildPoolForCurrentShape();

    if (preset.spa) {
      const spaShapeSelect = document.getElementById("spaShape");
      if (spaShapeSelect) spaShapeSelect.value = preset.spa.shape === "circular" ? "circular" : "square";
      this.refreshSpaDimensionLabels();
      await this.addSpa();

      const nextLength = Number(preset.spa.length ?? preset.spa.width ?? this.spa?.userData?.spaLength ?? 2);
      const nextWidth = Number(preset.spa.width ?? preset.spa.length ?? this.spa?.userData?.spaWidth ?? 2);
      if (this.spa) {
        this.spa.userData.spaShape = preset.spa.shape === "circular" ? "circular" : "square";
        this.spa.userData.spaLength = Number.isFinite(nextLength) ? nextLength : 2;
        this.spa.userData.spaWidth = Number.isFinite(nextWidth) ? nextWidth : 2;
        updateSpa(this.spa);
        snapToPool(this.spa);
        updateSpa(this.spa);
        if (Number.isFinite(Number(preset.spa.topHeight))) {
          setSpaTopOffset(this.spa, Number(preset.spa.topHeight));
        }
      }

      const spaBtn = document.getElementById("addRemoveSpa");
      if (spaBtn) spaBtn.textContent = "Remove Spa";
      this.setSpaSlidersEnabled(true);
      this.syncSpaSliderValuesFromSpa();
      try { await this.pbrManager?.applyTilesToSpa?.(this.spa); } catch (_) {}
      try { updatePoolWaterVoid(this.poolGroup, this.spa); } catch (_) {}
      try { updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa); } catch (_) {}
    } else {
      const spaShapeSelect = document.getElementById("spaShape");
      if (spaShapeSelect) spaShapeSelect.value = "square";
      const spaBtn = document.getElementById("addRemoveSpa");
      if (spaBtn) spaBtn.textContent = "Add Spa";
      this.setSpaSlidersEnabled(false);
      this.refreshSpaDimensionLabels();
    }

    this._updateDimensionHandles();
    this._updateSpaDimensionHandles();
    this._updateSectionDimensionHandles();
    this.openStarterModelView(preset);
  }

  syncSpaSliderValuesFromSpa() {
    if (!this.spa) return;
    const length = Number(this.spa.userData?.spaLength ?? 2);
    const width = Number(this.spa.userData?.spaWidth ?? 2);
    const lengthSlider = document.getElementById("spaLength");
    const widthSlider = document.getElementById("spaWidth");
    const lengthOutput = document.getElementById("spaLength-val");
    const widthOutput = document.getElementById("spaWidth-val");

    if (lengthSlider) lengthSlider.value = String(length);
    if (widthSlider) widthSlider.value = String(width);
    if (lengthOutput) lengthOutput.textContent = length.toFixed(2) + " m";
    if (widthOutput) widthOutput.textContent = width.toFixed(2) + " m";

    this.refreshSpaDimensionLabels();
    this.refreshSpaTopOffsetSlider();
  }

  async applyStarterSpaAfterInitialBuild(starterSpa) {
    if (!starterSpa) return;

    const spaShapeSelect = document.getElementById("spaShape");
    if (spaShapeSelect) spaShapeSelect.value = starterSpa.shape === "circular" ? "circular" : "square";

    this.refreshSpaDimensionLabels();
    await this.addSpa();

    const nextLength = Number(starterSpa.length ?? starterSpa.width ?? this.spa?.userData?.spaLength ?? 2);
    const nextWidth = Number(starterSpa.width ?? starterSpa.length ?? this.spa?.userData?.spaWidth ?? 2);
    if (this.spa) {
      this.spa.userData.spaShape = starterSpa.shape === "circular" ? "circular" : "square";
      this.spa.userData.spaLength = Number.isFinite(nextLength) ? nextLength : 2;
      this.spa.userData.spaWidth = Number.isFinite(nextWidth) ? nextWidth : 2;
      updateSpa(this.spa);
      snapToPool(this.spa);
      updateSpa(this.spa);
      if (Number.isFinite(Number(starterSpa.topHeight))) {
        setSpaTopOffset(this.spa, Number(starterSpa.topHeight));
      }
    }

    const spaBtn = document.getElementById("addRemoveSpa");
    if (spaBtn) spaBtn.textContent = "Remove Spa";
    this.setSpaSlidersEnabled(true);
    this.syncSpaSliderValuesFromSpa();
    try { await this.pbrManager?.applyTilesToSpa?.(this.spa); } catch (_) {}
    try { updatePoolWaterVoid(this.poolGroup, this.spa); } catch (_) {}
    try { updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa); } catch (_) {}
  }

  // --------------------------------------------------------------
  // START
  // --------------------------------------------------------------
  async start(options = {}) {
    const starterPreset = options?.starterPreset || null;
    const starterSpa = starterPreset?.spa || null;

    if (starterPreset?.params) {
      this.poolParams = {
        ...this.poolParams,
        ...this.normalizeStarterPresetParams(starterPreset.params)
      };
      const starterFootprint = this.createStarterFootprintPolygon(starterPreset);
      this.baseShapeType = this.poolParams.shape;
      this.isCustomShape = !!starterFootprint;
      this.editablePolygon = starterFootprint;
      this.wallRaiseBySourceEdge = {};
    }

    setupSidePanels();

    const { scene, camera, renderer, ground, controls } = await initScene();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.ground = ground;
    this.controls = controls;
    this.clock = new THREE.Clock();

    this.setupDimensionHandles();
    this.setupSpaDimensionHandles();
    this.setupSectionDimensionHandles();
    this.setupGlobalActionButtons();

    // Water interior prepass render target (used by stylized water refraction)
    const _sz = new THREE.Vector2();
    this.renderer.getSize(_sz);
    this._waterInteriorRT = new THREE.WebGLRenderTarget(_sz.x, _sz.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });
    // Water depth prepass (packed RGBA depth) for thickness/absorption in water shader
    this._waterDepthRT = new THREE.WebGLRenderTarget(_sz.x, _sz.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });
    this._waterDepthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking
    });
    this._waterDepthMat.blending = THREE.NoBlending;


    // Keep RT in sync with window resize (scene.js also resizes renderer/camera)
    window.addEventListener("resize", () => {
      const s = new THREE.Vector2();
      this.renderer.getSize(s);
      this._waterInteriorRT.setSize(s.x, s.y);
      this._waterDepthRT?.setSize(s.x, s.y);

      const wm = this.poolGroup?.userData?.waterMesh;
      const u = wm?.material?.uniforms;
      if (u?.resolution) u.resolution.value.set(s.x, s.y);
    });


    this.caustics = new CausticsSystem();
    // NOTE: poolGroup is built in rebuildPoolForCurrentShape(); we attach after that.
    console.log('✅ PoolApp created CausticsSystem:', this.caustics);
// PBR / Caustics integration should never hard-crash the app if a module fails
    // to load or throws during initialization. If it fails, we continue without PBR.
    try {
      this.pbrManager = new PBRManager(this.poolParams, this.tileSize, this.caustics);
    } catch (err) {
      console.error("[PoolApp] PBRManager init failed; continuing without PBR.", err);
      this.pbrManager = null;
    }

    await this.rebuildPoolForCurrentShape();
    this._updateDimensionHandles();
    this._updateSpaDimensionHandles();
    this._updateSectionDimensionHandles();

    // Final defensive attach (in case materials changed during rebuild)
    try { this.caustics?.attachToGroup?.(this.poolGroup); } catch (_) {}

    // Guard all calls: if PBR is unavailable (or poolGroup not yet built), keep running.
    if (this.poolGroup && this.pbrManager && typeof this.pbrManager.setPoolGroup === "function") {
      this.pbrManager.setPoolGroup(this.poolGroup);
      if (typeof this.pbrManager.initButtons === "function") {
        await this.pbrManager.initButtons(this.poolGroup);
      }
    }

    this.setupSpaSystem();
    this.setupSpaSelection();
    this.setupShapeDropdown();
    this.setupSpaSliders();
    this.setupPoolSliders();
    this.setupStepLayoutControls();
    this.setupRippleClick();
    setupPoolAssistant(this);

    this.updateShapeUIVisibility();

    // steps
    this.setupStepSelection();
    this.setupStepExtensionSlider();

    // walls
    this.setupWallSelection();
    this.setupWallRaiseSlider();
    this.setupCustomizeCurveTool();

    // Make sure UI sliders reflect the current poolParams
    this.syncSlidersFromParams();

    if (starterSpa) {
      await this.applyStarterSpaAfterInitialBuild(starterSpa);
    } else {
      const spaShapeSelect = document.getElementById("spaShape");
      if (spaShapeSelect) spaShapeSelect.value = "square";
      const spaBtn = document.getElementById("addRemoveSpa");
      if (spaBtn) spaBtn.textContent = "Add Spa";
      this.setSpaSlidersEnabled(false);
      this.refreshSpaDimensionLabels();
    }

    if (!starterPreset) this.setupStarterPresetScreen();

    document.addEventListener("shapePanelOpened", () => {
      this.focusCameraOnPoolShape();
    });

    document.addEventListener("activePanelChanged", (event) => {
      const panelName = event?.detail?.panelName || null;
      this.setSectionViewEnabled(panelName === "dimensions");
    });

    // CAMERA ZOOM WHEN STEPS PANEL OPENS
    document.addEventListener("stepsPanelOpened", () => {
      this.ghostifyWater();

      if (!this.poolGroup) return;

      const steps = [];
      this.poolGroup.traverse((o) => o.userData?.isStep && steps.push(o));
      if (!steps.length) return;

      const firstStep = steps[0];
      const target = firstStep.position.clone();
      target.z += 0.3;

      const offset = new THREE.Vector3(3, 2, 2);
      const newPos = target.clone().add(offset);

      this.animateCameraTo(newPos, target, 0.8);
    });

    document.addEventListener("stepsPanelClosed", () => {
      this.restoreWater();
      const hadSel = !!this.selectedStep;
      this.clearHoverHighlight();
      this.clearSelectedHighlight();
      if (hadSel)
        document.dispatchEvent(new CustomEvent("stepSelectionCleared"));
    });

    if (starterPreset) {
      this.openStarterModelView(starterPreset);
    } else {
      window.openPanelFromCode?.("shape");
    }

    this.animate();
  }


  updateHighlightForSpa(spa, isSelected) {
    if (!this.scene || !spa) return;
    if (this.sectionViewEnabled) {
      if (this.hoverSpaHighlight) this.hoverSpaHighlight.visible = false;
      if (this.selectedSpaHighlight) this.selectedSpaHighlight.visible = false;
      return;
    }

    // Keep spa drag/selection flow unchanged, but do not render a persistent
    // selected highlight. Hover highlight remains active through the existing
    // non-selected path.
    if (isSelected) {
      if (this.selectedSpaHighlight) this.selectedSpaHighlight.visible = false;
      return;
    }

    const highlight = this.hoverSpaHighlight || new THREE.Group();
    if (!highlight.parent) this.scene.add(highlight);

    while (highlight.children.length) {
      const child = highlight.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }

    spa.updateMatrixWorld(true);
    const selectable = [];
    spa.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.visible) return;
      if (o.userData?.ignoreClickSelect || o.userData?.isSpaWater) return;
      selectable.push(o);
    });

    const opacity = isSelected ? 0.35 : 0.22;
    const scale = isSelected ? 1.025 : 1.012;
    for (const mesh of selectable) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd37cff,
        transparent: true,
        opacity,
        depthWrite: false
      });
      const clone = new THREE.Mesh(mesh.geometry.clone(), mat);
      clone.renderOrder = isSelected ? 997 : 996;
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      mesh.updateMatrixWorld(true);
      mesh.matrixWorld.decompose(pos, quat, scl);
      clone.position.copy(pos);
      clone.quaternion.copy(quat);
      clone.scale.copy(scl).multiplyScalar(scale);
      highlight.add(clone);
    }

    highlight.visible = true;
    if (isSelected) this.selectedSpaHighlight = highlight;
    else this.hoverSpaHighlight = highlight;
  }

  clearSpaHoverHighlight() {
    if (this.hoverSpaHighlight) this.hoverSpaHighlight.visible = false;
    this.hoveredSpa = null;
  }

  clearSpaSelectedHighlight() {
    if (this.selectedSpaHighlight) this.selectedSpaHighlight.visible = false;
    this.selectedSpa = null;
  }

  // --------------------------------------------------------------
  // SPA SYSTEM
  // --------------------------------------------------------------
  setupCustomizeCurveTool() {
    const btn = document.getElementById("customizeShapeBtn");
    const confirmBtn = document.getElementById("customizeConfirmBtn");
    const revertBtn = document.getElementById("revertCornerBtn");
    const radiusSlider = document.getElementById("customizeRadius");
    if (!btn) return;

    btn.addEventListener("click", () => {
      this.setCustomizeMode(!this.customizeMode);
    });

    confirmBtn?.addEventListener("click", async () => {
      try {
        this.captureUndoState("Apply curve");
      } catch (err) {
        console.warn("Undo snapshot failed before applying curve", err);
      }
      await this.applyCurveFromPreview();
    });

    revertBtn?.addEventListener("click", async () => {
      try {
        this.captureUndoState("Revert curve");
      } catch (err) {
        console.warn("Undo snapshot failed before reverting curve", err);
      }
      await this.revertSelectedCurveToSquare();
    });

    radiusSlider?.addEventListener("input", () => {
      const value = Number(radiusSlider.value);
      if (!Number.isFinite(value)) return;
      this.customizeRadius = value;
      this.updateCustomizeRadiusUI();

      if (Number.isInteger(this.customizeEditEdgeIndex)) {
        this.selectExistingCurvedEdgeForCustomize(
          this.customizeEditEdgeIndex,
          this.customizeWallSelections[0]?.wall || null
        );
      } else if (this.customizeWallSelections.length >= 2) {
        this.refreshCustomizePreviewFromSelections();
      }
    });

    document.addEventListener("shapePanelClosed", () => {
      this.setCustomizeMode(false);
    });
  }

  showCustomizeRevertButton(show) {
    const revertBtn = document.getElementById("revertCornerBtn");
    if (!revertBtn) return;
    revertBtn.style.display = show ? "inline-flex" : "none";
  }

  setCustomizeMode(active) {
    const unsupported = this.poolParams.shape === "oval" || this.poolParams.shape === "kidney";
    if (active && unsupported) {
      this.customizeMode = false;
      this.customizeWallSelections = [];
      this.customizeEditEdgeIndex = null;
      this.hoveredCustomizeCurveEdgeIndex = null;
      this.clearCustomizeWallSelectionHighlights();
      this.clearCustomizePreview();
      this.showCustomizeRevertButton(false);
      this.refreshCustomizeHint("Customise currently works with rectangular, freeform, and L-shape pools.");
      return;
    }

    this.customizeMode = !!active;
    this.customizeWallSelections = [];
    this.customizeEditEdgeIndex = null;
    this.hoveredCustomizeCurveEdgeIndex = null;
    this.clearCustomizeWallSelectionHighlights();
    this.clearCustomizePreview();
    this.customizeRadiusBounds = { min: 1.0, max: 4.0 };

    this.showCustomizeRevertButton(false);

    const btn = document.getElementById("customizeShapeBtn");
    const confirmBtn = document.getElementById("customizeConfirmBtn");

    if (btn) {
      btn.textContent = this.customizeMode ? "Cancel Customise" : "Customise";
      btn.classList.toggle("primary", this.customizeMode);
    }
    if (confirmBtn) confirmBtn.style.display = "none";

    this.updateCustomizeRadiusUI();
    this.refreshCustomizeHint();

    if (!this.customizeMode) {
      this.clearWallSelectedHighlight();
    }
  }

  refreshCustomizeHint(message = "") {
    const hint = document.getElementById("customizeShapeHint");
    if (!hint) return;

    if (!this.customizeMode && !message) {
      hint.style.display = "none";
      hint.textContent = "Select 2 adjacent walls where you want the curved edge.";
      return;
    }

    hint.style.display = "block";
    hint.textContent = message || (
      Number.isInteger(this.customizeEditEdgeIndex)
        ? "Curved wall selected. Adjust the radius slider, press Confirm to update it, or press Revert to Square Corner to change it back to a square corner."
        : this.customizeWallSelections.length === 0
          ? "Select the first adjacent wall where you want the curved edge, or click an existing curved wall to edit it."
          : "Select the second adjacent wall. A preview will appear before you confirm."
    );
  }

  updateCustomizeRadiusUI(bounds = null) {
    const wrap = document.getElementById("customizeRadiusWrap");
    const slider = document.getElementById("customizeRadius");
    const valueLabel = document.getElementById("customizeRadius-val");
    if (!wrap || !slider || !valueLabel) return;

    if (bounds) {
      this.customizeRadiusBounds = {
        min: Number.isFinite(bounds.min) ? bounds.min : this.customizeRadiusBounds.min,
        max: Number.isFinite(bounds.max) ? bounds.max : this.customizeRadiusBounds.max
      };
    }

    const min = 1.0;
    const max = 4.0;

    this.customizeRadiusBounds = { min, max };
    this.customizeRadius = THREE.MathUtils.clamp(
      Number.isFinite(this.customizeRadius) ? this.customizeRadius : min,
      min,
      max
    );

    slider.min = min.toFixed(2);
    slider.max = max.toFixed(2);
    slider.step = "0.05";
    slider.value = this.customizeRadius.toFixed(2);
    slider.disabled = !(
      this.customizeMode &&
      (this.customizeWallSelections.length >= 2 || Number.isInteger(this.customizeEditEdgeIndex))
    );
    wrap.style.display = this.customizeMode ? "block" : "none";
    valueLabel.textContent = `${this.customizeRadius.toFixed(2)} m`;
  }

  refreshCustomizePreviewFromSelections() {
    const preview = this.computeCustomizePreviewData(this.customizeWallSelections, this.customizeRadius);
    const confirmBtn = document.getElementById("customizeConfirmBtn");

    if (!preview) {
      this.customizePreview = null;
      this.clearCustomizePreview();
      if (confirmBtn) confirmBtn.style.display = "none";
      this.showCustomizeRevertButton(false);
      this.updateCustomizeRadiusUI();
      this.refreshCustomizeHint("The selected walls could not form a curved corner. Pick 2 adjacent walls.");
      return;
    }

    this.customizeRadius = preview.radius;
    this.customizePreview = preview;
    this.showCustomizeCurvePreview(preview);

    if (confirmBtn) confirmBtn.style.display = "inline-flex";
    this.showCustomizeRevertButton(false);
    this.updateCustomizeRadiusUI({ min: preview.minRadius, max: preview.maxRadius });
    this.refreshCustomizeHint("Preview ready. Adjust the radius slider, then press Confirm.");
  }

  selectExistingCurvedEdgeForCustomize(edgeIndex, wall = null) {
    if (!this.customizeMode || !this.editablePolygon) return;

    const preview = this.computeExistingCurvePreviewData(edgeIndex, this.customizeRadius);
    const confirmBtn = document.getElementById("customizeConfirmBtn");

    this.customizeWallSelections = wall ? [{ wall, edgeIndex, hitPoint: null }] : [];
    this.updateCustomizeSelectionHighlights();
    this.customizeEditEdgeIndex = edgeIndex;

    if (!preview) {
      this.customizePreview = null;
      this.clearCustomizePreview();
      if (confirmBtn) confirmBtn.style.display = "none";
      this.showCustomizeRevertButton(false);
      this.updateCustomizeRadiusUI({ min: 1.0, max: 4.0 });
      this.refreshCustomizeHint("That curved wall cannot be resized from this shape.");
      return;
    }

    this.customizeRadius = preview.radius;
    this.customizePreview = preview;
    this.showCustomizeCurvePreview(preview);

    if (confirmBtn) confirmBtn.style.display = "inline-flex";
    this.showCustomizeRevertButton(true);
    this.updateCustomizeRadiusUI({ min: preview.minRadius, max: preview.maxRadius });
    this.refreshCustomizeHint("Curved wall selected. Adjust the radius slider, press Confirm to update it, or press Revert to Square Corner to change it back to a square corner.");
  }

  computeExistingCurvePreviewData(edgeIndex, radiusOverride = null) {
    const polygon = this.editablePolygon;
    if (!polygon?.vertices?.length || !Number.isInteger(edgeIndex)) return null;

    const edge = polygon.getEdge(edgeIndex);
    if (!edge?.isCurved || !edge.control) return null;

    const n = polygon.vertexCount();
    if (n < 4) return null;

    const control = edge.control.clone();
    const startVertex = polygon.getVertex(edgeIndex)?.clone();
    const endVertex = polygon.getVertex(polygon.nextIndex(edgeIndex))?.clone();
    const prevVertex = polygon.getVertex(polygon.prevIndex(edgeIndex))?.clone();
    const nextVertex = polygon.getVertex((edgeIndex + 2) % n)?.clone();
    if (!startVertex || !endVertex || !prevVertex || !nextVertex) return null;

    const inVec = prevVertex.clone().sub(control);
    const outVec = nextVertex.clone().sub(control);
    const inLen = inVec.length();
    const outLen = outVec.length();
    if (inLen < 1e-4 || outLen < 1e-4) return null;

    inVec.normalize();
    outVec.normalize();

    const minRadius = 1.0;
    const maxRadius = Math.min(4.0, Math.min(inLen, outLen) - 0.02);
    if (maxRadius < minRadius) return null;

    const currentRadius = Math.min(
      control.distanceTo(startVertex),
      control.distanceTo(endVertex)
    );

    const defaultRadius = THREE.MathUtils.clamp(
      currentRadius || minRadius,
      minRadius,
      maxRadius
    );

    const radius = THREE.MathUtils.clamp(
      Number.isFinite(radiusOverride) ? radiusOverride : defaultRadius,
      minRadius,
      maxRadius
    );

    const start = control.clone().addScaledVector(inVec, radius);
    const end = control.clone().addScaledVector(outVec, radius);

    const points = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const inv = 1 - t;
      points.push(new THREE.Vector3(
        inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
        inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
        0.06
      ));
    }

    return {
      mode: "edit-existing",
      edgeIndex,
      control,
      start,
      end,
      radius,
      minRadius,
      maxRadius,
      points
    };
  }

  getCurrentOutlineVertices() {
    if ((this.poolParams.shape === "freeform" || this.isCustomShape) && this.editablePolygon?.vertices?.length) {
      return this.editablePolygon.vertices.map((v) => v.clone());
    }

    if (this.poolParams.shape === "L") {
      const halfL = this.poolParams.length / 2;
      const halfW = this.poolParams.width / 2;

      const notchL = THREE.MathUtils.clamp(
        this.poolParams.length * (Number.isFinite(this.poolParams.notchLengthX) ? this.poolParams.notchLengthX : 0.4),
        0.6,
        Math.max(0.6, this.poolParams.length - 0.6)
      );

      const notchW = THREE.MathUtils.clamp(
        this.poolParams.width * (Number.isFinite(this.poolParams.notchWidthY) ? this.poolParams.notchWidthY : 0.45),
        0.6,
        Math.max(0.6, this.poolParams.width - 0.6)
      );

      return [
        new THREE.Vector2(-halfL, -halfW),
        new THREE.Vector2(halfL, -halfW),
        new THREE.Vector2(halfL, halfW),
        new THREE.Vector2(halfL - notchL, halfW),
        new THREE.Vector2(halfL - notchL, halfW - notchW),
        new THREE.Vector2(-halfL, halfW - notchW)
      ];
    }

    return [
      new THREE.Vector2(-this.poolParams.length / 2, -this.poolParams.width / 2),
      new THREE.Vector2(this.poolParams.length / 2, -this.poolParams.width / 2),
      new THREE.Vector2(this.poolParams.length / 2, this.poolParams.width / 2),
      new THREE.Vector2(-this.poolParams.length / 2, this.poolParams.width / 2)
    ];
  }

  ensureEditablePolygonForCustomization() {
    if (!this.isCustomShape) {
      this.baseShapeType = this.poolParams.shape;
    }

    if (this.editablePolygon?.vertices?.length) {
      return this.editablePolygon;
    }

    const vertices = this.getCurrentOutlineVertices();
    this.editablePolygon = new EditablePolygon(vertices);
    this.editablePolygon.minVertices = 3;
    this.editablePolygon.isRectangular = this.baseShapeType === "rectangular";

    this.isCustomShape = true;

    this.updateShapeUIVisibility();
    this.syncSlidersFromParams();
    this.refreshDisplayedShapeLabel();
    return this.editablePolygon;
  }

  handleCustomizeWallPick(wall, hitPoint) {
    if (!wall || !this.customizeMode) return;

    this.customizeEditEdgeIndex = null;
    this.showCustomizeRevertButton(false);

    const edgeIndex = wall.userData?.edgeIndex;
    if (!Number.isInteger(edgeIndex)) {
      this.refreshCustomizeHint("This shape cannot be customised from wall picks yet.");
      return;
    }

    if (this.customizeWallSelections.length >= 2) {
      this.customizeWallSelections = [];
      this.clearCustomizeWallSelectionHighlights();
      this.clearCustomizePreview();
    }

    if (this.customizeWallSelections.some((sel) => sel.wall === wall)) {
      this.refreshCustomizeHint("That wall is already selected. Pick the adjacent wall next.");
      return;
    }

    this.customizeWallSelections.push({ wall, edgeIndex, hitPoint: hitPoint.clone() });
    this.updateCustomizeSelectionHighlights();
    this.clearWallHoverHighlight();

    if (this.customizeWallSelections.length < 2) {
      this.updateCustomizeRadiusUI();
      this.refreshCustomizeHint();
      return;
    }

    const autoPreview = this.computeCustomizePreviewData(this.customizeWallSelections);
    if (!autoPreview) {
      this.customizeWallSelections = [this.customizeWallSelections[1]];
      this.updateCustomizeSelectionHighlights();
      this.clearCustomizePreview();
      this.updateCustomizeRadiusUI();
      this.refreshCustomizeHint("Select 2 adjacent walls that meet at the corner you want curved.");
      return;
    }

    this.customizeRadius = autoPreview.radius;
    this.updateCustomizeRadiusUI({ min: autoPreview.minRadius, max: autoPreview.maxRadius });
    this.refreshCustomizePreviewFromSelections();
  }

  computeCustomizePreviewData(selections = [], radiusOverride = null) {
    const vertices = this.getCurrentOutlineVertices();
    if (!vertices || vertices.length < 3 || selections.length < 2) return null;

    const n = vertices.length;
    const firstEdge = selections[0].edgeIndex;
    const secondEdge = selections[1].edgeIndex;

    let sharedVertexIndex = -1;
    let incomingEdgeIndex = -1;
    let outgoingEdgeIndex = -1;

    if ((firstEdge + 1) % n === secondEdge) {
      sharedVertexIndex = secondEdge;
      incomingEdgeIndex = firstEdge;
      outgoingEdgeIndex = secondEdge;
    } else if ((secondEdge + 1) % n === firstEdge) {
      sharedVertexIndex = firstEdge;
      incomingEdgeIndex = secondEdge;
      outgoingEdgeIndex = firstEdge;
    } else {
      return null;
    }

    const shared = vertices[sharedVertexIndex];
    const prev = vertices[incomingEdgeIndex];
    const next = vertices[(outgoingEdgeIndex + 1) % n];
    if (!shared || !prev || !next) return null;

    const inVec = prev.clone().sub(shared);
    const outVec = next.clone().sub(shared);
    const inLen = inVec.length();
    const outLen = outVec.length();
    if (inLen < 0.05 || outLen < 0.05) return null;

    inVec.normalize();
    outVec.normalize();

    const minRadius = 1.0;
    const maxRadius = Math.min(4.0, Math.min(inLen, outLen) - 0.02);
    if (maxRadius < minRadius) return null;

    const defaultRadius = THREE.MathUtils.clamp(
      Math.min(inLen, outLen) * 0.35,
      minRadius,
      maxRadius
    );

    const radius = THREE.MathUtils.clamp(
      Number.isFinite(radiusOverride) ? radiusOverride : defaultRadius,
      minRadius,
      maxRadius
    );

    const start = shared.clone().addScaledVector(inVec, radius);
    const end = shared.clone().addScaledVector(outVec, radius);
    const control = shared.clone();

    const points = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const inv = 1 - t;
      points.push(new THREE.Vector3(
        inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
        inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
        0.06
      ));
    }

    return {
      vertices,
      sharedVertexIndex,
      incomingEdgeIndex,
      outgoingEdgeIndex,
      start,
      end,
      control,
      radius,
      minRadius,
      maxRadius,
      points
    };
  }

  showCustomizeCurvePreview(preview) {
    if (!this.scene || !preview?.points?.length) return;

    if (!this.customizePreviewLine) {
      const geom = new THREE.BufferGeometry();
      const mat = new THREE.LineBasicMaterial({
        color: 0xbfe8ff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      this.customizePreviewLine = new THREE.Line(geom, mat);
      this.customizePreviewLine.renderOrder = 1000;
      this.scene.add(this.customizePreviewLine);
    }

    this.customizePreviewLine.geometry.dispose();
    this.customizePreviewLine.geometry = new THREE.BufferGeometry().setFromPoints(preview.points);
    this.customizePreviewLine.visible = true;
  }

  async revertSelectedCurveToSquare() {
    if (!Number.isInteger(this.customizeEditEdgeIndex)) {
      this.refreshCustomizeHint("Select an existing curved wall first.");
      return;
    }

    const polygon = this.ensureEditablePolygonForCustomization();
    const edgeIndex = this.customizeEditEdgeIndex;
    const edge = polygon.getEdge?.(edgeIndex);

    if (!edge?.isCurved || !edge.control) {
      this.refreshCustomizeHint("That curved wall can’t be reverted.");
      return;
    }

    const originalCorner = edge.control.clone();
    const nextIndex = polygon.nextIndex(edgeIndex);

    if (!polygon.vertices?.[edgeIndex] || !polygon.vertices?.[nextIndex]) {
      this.refreshCustomizeHint("That curved wall can’t be reverted.");
      return;
    }

    polygon.vertices[edgeIndex].copy(originalCorner);
    polygon.vertices.splice(nextIndex, 1);

    if (Array.isArray(polygon.edges)) {
      polygon.edges.splice(nextIndex, 1);
      if (!polygon.edges[edgeIndex]) {
        polygon.edges[edgeIndex] = { isCurved: false, control: null };
      } else {
        polygon.edges[edgeIndex].isCurved = false;
        polygon.edges[edgeIndex].control = null;
      }
    }

    polygon.isRectangular = false;
    polygon._emitChange?.();

    await this.rebuildPoolForCurrentShape();
    this.focusCameraOnPoolShape();
    window.openPanelFromCode?.("shape");
    this.setCustomizeMode(true);
    this.normalizeShapeLabelIfNeeded();
    this.refreshCustomizeHint("Curve removed. The corner is square again.");
  }

  async applyCurveFromPreview() {
    const preview = this.customizePreview;
    if (!preview) {
      this.refreshCustomizeHint("Select 2 adjacent walls first so the preview can be confirmed.");
      return;
    }

    const polygon = this.ensureEditablePolygonForCustomization();

    if (preview.mode === "edit-existing") {
      const edgeIndex = preview.edgeIndex;
      if (!Number.isInteger(edgeIndex) || !polygon.vertices?.[edgeIndex]) {
        this.refreshCustomizeHint("The curved wall could not be updated.");
        return;
      }

      polygon.vertices[edgeIndex].copy(preview.start);
      polygon.vertices[polygon.nextIndex(edgeIndex)].copy(preview.end);
      polygon.moveCurveControl(edgeIndex, preview.control);
      polygon.isRectangular = false;
      polygon._emitChange?.();

      await this.rebuildPoolForCurrentShape();
      this.focusCameraOnPoolShape();
      window.openPanelFromCode?.("shape");
      this.isCustomShape = true;
      this.refreshDisplayedShapeLabel();
      this.setCustomizeMode(false);
      return;
    }

    const sharedIndex = preview.sharedVertexIndex;
    if (!Number.isInteger(sharedIndex) || !polygon.vertices?.[sharedIndex]) {
      this.refreshCustomizeHint("The curved corner could not be applied to this shape.");
      return;
    }

    polygon.vertices[sharedIndex].copy(preview.start);
    polygon.addVertexAtEdge(sharedIndex, preview.end);
    polygon.moveCurveControl(sharedIndex, preview.control);
    polygon.isRectangular = false;
    polygon._emitChange?.();

    await this.rebuildPoolForCurrentShape();
    this.focusCameraOnPoolShape();
    window.openPanelFromCode?.("shape");
    this.isCustomShape = true;
    this.refreshDisplayedShapeLabel();
    this.setCustomizeMode(false);
  }

  getSpaSelectionMeshes() {
    if (!this.spa) return [];
    const spaMeshes = [];
    this.spa.traverse((o) => {
      if (o.isMesh && !o.userData?.ignoreClickSelect && !o.userData?.isSpaWater) spaMeshes.push(o);
    });
    return spaMeshes;
  }

  getPointerNdc(event, dom = this.renderer?.domElement) {
    const rect = dom.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  raycastSpa(event, dom = this.renderer?.domElement) {
    if (!this.camera || !dom || !this.spa) return [];
    const mouse = this.getPointerNdc(event, dom);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const spaMeshes = this.getSpaSelectionMeshes();
    return spaMeshes.length ? ray.intersectObjects(spaMeshes, true) : [];
  }

  intersectSpaDragPlane(event, dom = this.renderer?.domElement) {
    if (!this.camera || !dom) return null;
    const mouse = this.getPointerNdc(event, dom);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hitPoint = new THREE.Vector3();
    return ray.ray.intersectPlane(this.spaDrag.plane, hitPoint) ? hitPoint : null;
  }

  updateSpaCursor(hitSpa = false) {
    const dom = this.renderer?.domElement;
    if (!dom) return;
    dom.style.cursor = this.spaDrag?.active ? 'grabbing' : (hitSpa ? 'pointer' : '');
  }

  setupSpaSelection() {
    if (!this.renderer || !this.camera) return;
    const dom = this.renderer.domElement;

    dom.addEventListener("pointermove", (event) => {
      if (!this.spa || this.poolEditor?.isDragging) return;

      if (this.spaDrag?.active && this.selectedSpa === this.spa) {
        const point = this.intersectSpaDragPlane(event, dom);
        if (!point) return;

        this.spa.position.x = point.x + this.spaDrag.offset.x;
        this.spa.position.y = point.y + this.spaDrag.offset.y;
        this.spaDrag.moved = true;
        this.updateSpaCursor(true);

        if (this.poolGroup) {
          updatePoolWaterVoid(this.poolGroup, this.spa);
          updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
        }
        return;
      }

      const hit = this.raycastSpa(event, dom);
      if (!hit.length) {
        this.clearSpaHoverHighlight();
        this.updateSpaCursor(false);
        return;
      }

      this.updateSpaCursor(true);

      if (this.selectedSpa === this.spa) {
        this.clearSpaHoverHighlight();
        return;
      }

      if (this.hoveredSpa !== this.spa) {
        this.hoveredSpa = this.spa;
        this.updateHighlightForSpa(this.spa, false);
      }
    });

    dom.addEventListener("pointerdown", (event) => {
      // Only the primary/left pointer button is allowed to start spa movement.
      // Right-click should keep its normal browser/context-menu behaviour and must not drag the spa.
      if (event.button !== 0) return;
      if (!this.spa || this.poolEditor?.isDragging) return;

      const hit = this.raycastSpa(event, dom);
      if (!hit.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      this.selectedSpa = this.spa;
      setSelectedSpa(this.spa);
      this.updateHighlightForSpa(this.spa, true);
      this.clearSpaHoverHighlight();
      window.openPanelFromCode?.("spa");
      document.dispatchEvent(new CustomEvent("spaSelected"));

      this.spa.updateMatrixWorld?.(true);
      this.spaDrag.plane.set(new THREE.Vector3(0, 0, 1), -this.spa.position.z);
      const dragPoint = this.intersectSpaDragPlane(event, dom) || hit[0].point;
      this.spaDrag.offset.copy(this.spa.position).sub(dragPoint);
      this.spaDrag.active = true;
      this.spaDrag.moved = false;
      this.controls.enabled = false;
      this.updateSpaCursor(true);
      dom.setPointerCapture?.(event.pointerId);
    });

    const finishSpaDrag = async (event) => {
      if (!this.spaDrag?.active) return;

      this.spaDrag.active = false;
      this.controls.enabled = true;
      dom.releasePointerCapture?.(event.pointerId);

      if (this.spa && this.spaDrag.moved) {
        snapToPool(this.spa);
        updateSpa(this.spa);
        await this.pbrManager.applyTilesToSpa(this.spa);
        this.refreshSpaTopOffsetSlider();

        if (this.poolGroup) {
          updatePoolWaterVoid(this.poolGroup, this.spa);
          updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
        }
      }

      await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });

      const hit = this.raycastSpa(event, dom);
      this.updateSpaCursor(!!hit.length);
    };

    dom.addEventListener("pointerup", finishSpaDrag);
    dom.addEventListener("pointercancel", finishSpaDrag);
    dom.addEventListener("pointerleave", (event) => {
      if (!this.spaDrag?.active) {
        this.clearSpaHoverHighlight();
        this.updateSpaCursor(false);
        return;
      }
      finishSpaDrag(event);
    });

    dom.addEventListener("click", (event) => {
      if (event.button !== 0) return;
      if (!this.spa || this.poolEditor?.isDragging) return;
      if (this.spaDrag?.moved) return;

      const hit = this.raycastSpa(event, dom);
      if (!hit.length) {
        this.clearSpaSelectedHighlight();
        this.clearSpaHoverHighlight();
        this.updateSpaCursor(false);
        return;
      }

      event.stopImmediatePropagation();
      this.selectedSpa = this.spa;
      setSelectedSpa(this.spa);
      this.updateHighlightForSpa(this.spa, true);
      this.clearSpaHoverHighlight();
      this.updateSpaCursor(true);
      window.openPanelFromCode?.("spa");
      document.dispatchEvent(new CustomEvent("spaSelected"));
    });
  }

  getSelectedSpaShape() {
    const select = document.getElementById("spaShape");
    return select?.value === "circular" ? "circular" : "square";
  }

  refreshSpaDimensionLabels() {
    const shape = this.spa?.userData?.spaShape || this.getSelectedSpaShape();
    const allSpans = Array.from(document.querySelectorAll('#panel-spa label > span'));
    if (allSpans[1]) allSpans[1].textContent = shape === "circular" ? "Diameter (m)" : "Width (m)";
    if (allSpans[2]) allSpans[2].textContent = shape === "circular" ? "Diameter (m)" : "Length (m)";
  }

  setupSpaSystem() {
    const btn = document.getElementById("addRemoveSpa");
    if (!btn) return;

    const spaShapeSelect = document.getElementById("spaShape");

    this.setSpaSlidersEnabled(false);
    this.refreshSpaDimensionLabels();

    spaShapeSelect?.addEventListener("change", async () => {
      this.refreshSpaDimensionLabels();
      if (!this.spa) return;
      this.captureUndoState("Spa shape change");
      this.spa.userData.spaShape = this.getSelectedSpaShape();
      if (this.spa.userData.spaShape === "circular") {
        const diameter = Math.min(this.spa.userData.spaLength || 2, this.spa.userData.spaWidth || 2);
        this.spa.userData.spaLength = diameter;
        this.spa.userData.spaWidth = diameter;
        const lengthSlider = document.getElementById("spaLength");
        const widthSlider = document.getElementById("spaWidth");
        const lengthOutput = document.getElementById("spaLength-val");
        const widthOutput = document.getElementById("spaWidth-val");
        if (lengthSlider) lengthSlider.value = String(diameter);
        if (widthSlider) widthSlider.value = String(diameter);
        if (lengthOutput) lengthOutput.textContent = diameter.toFixed(2) + " m";
        if (widthOutput) widthOutput.textContent = diameter.toFixed(2) + " m";
      }
      updateSpa(this.spa);
      this.refreshSpaTopOffsetSlider();
      await this.pbrManager.applyTilesToSpa(this.spa);
      if (this.poolGroup) {
        updatePoolWaterVoid(this.poolGroup, this.spa);
        updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
      }
    });

    btn.addEventListener("click", () => {
      this.captureUndoState("Spa toggle");
      if (!this.spa) {
        this.addSpa();
        btn.textContent = "Remove Spa";
      } else {
        this.removeSpa();
        btn.textContent = "Add Spa";
      }
    });
  }

  async addSpa() {
    this.spa = createSpa(this.poolParams, this.scene, {
      tileSize: this.tileSize,
      shape: this.getSelectedSpaShape(),
      poolGroup: this.poolGroup || null
    });
    this.spa.userData.poolGroup = this.poolGroup || null;
    this.spa.userData.poolParams = this.poolParams;

    snapToPool(this.spa);
    updateSpa(this.spa);

    await this.pbrManager.applyTilesToSpa(this.spa);

    if (this.poolGroup) {
      updatePoolWaterVoid(this.poolGroup, this.spa);
      updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
    }

    this.selectedSpa = this.spa;
    setSelectedSpa(this.spa);
    this.setSpaSlidersEnabled(true);
    this.refreshSpaDimensionLabels();
    this.refreshSpaTopOffsetSlider();
  }

  removeSpa() {
    if (!this.spa) return;

    disposeSpa(this.spa, this.scene);

    const index = spas.indexOf(this.spa);
    if (index !== -1) spas.splice(index, 1);

    this.clearSpaHoverHighlight();
    this.clearSpaSelectedHighlight();
    this.spa = null;
    this.hoverSpaHighlight = null;
    this.selectedSpaHighlight = null;
    setSelectedSpa(null);

    this.spaDrag.active = false;
    if (this.renderer?.domElement) this.renderer.domElement.style.cursor = "";

    this.setSpaSlidersEnabled(false);

    if (this.poolGroup) {
      updatePoolWaterVoid(this.poolGroup, null);
      updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, null);
      purgeDetachedSpaChannelArtifacts(this.scene, null);
    }
  }

  setSpaSlidersEnabled(state) {
    ["spaLength", "spaWidth", "spaTopHeight"].forEach((id) => {
      const slider = document.getElementById(id);
      if (slider) slider.disabled = !state;
    });
  }


  refreshSpaTopOffsetSlider() {
    const slider = document.getElementById("spaTopHeight");
    const output = document.getElementById("spaTopHeight-val");
    if (!slider) return;

    const constraints = getSpaTopOffsetConstraints(this.spa);
    slider.step = String(constraints.step ?? 0.05);
    slider.min = String(constraints.min ?? 0);
    slider.value = Number(constraints.value ?? 0).toFixed(2);

    if (output) {
      output.textContent = Number(constraints.value ?? 0).toFixed(2) + " m";
    }
  }

// --------------------------------------------------------------
// FREEFORM POLYGON EDITOR
// --------------------------------------------------------------
setupPoolEditor() {
  this.destroyPoolEditor();
  if (this.poolParams.shape !== "freeform" || !this.editablePolygon) return;

  this.poolEditor = new PoolEditor(
    this.scene,
    this.editablePolygon,
    this.renderer.domElement,
    {
      handleSize: 0.15,

      onEditStart: () => {
        this.captureUndoState("Freeform edit");
      },

      onPolygonChange: () => {
        if (!this.isPolygonShape()) return;
        if (!this.scene || !this.editablePolygon) return;

        this.editablePolygon.isRectangular = false;
        this.isCustomShape = true;
        this.refreshDisplayedShapeLabel();

        // Remove old pool
        if (this.poolGroup) {
          this._removePoolGroupSafely(this.poolGroup);
        }

        // Full rebuild required so floor, walls, steps, coping and water all
        // follow the edited freeform outline.
        this.poolGroup = createPoolGroup(
          this.poolParams,
          this.tileSize,
          this.editablePolygon
        );

        this.scene.add(this.poolGroup);

        // Keep all dependent systems in sync immediately.
        updateGroundVoid(this.ground, this.poolGroup, this.spa);
        updateGrassForPool(this.scene, this.poolGroup);
        if (this.spa) {
          updatePoolWaterVoid(this.poolGroup, this.spa);
          updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
        }

        // Keep tile density / grout alignment stable after each edit.
        this.rebakePoolTilingUVs();
        this._reapplySavedWallRaiseState();

        // Re-attach caustics after the freeform rebuild swaps meshes/materials.
        try { this.caustics?.attachToGroup?.(this.poolGroup); } catch (_) {}

        // Defer expensive PBR + spa logic (prevents tile popping)
        this._schedulePBRApply();

        if (this.sectionViewEnabled) {
          try { this._refreshSectionViewPresentation(); } catch (_) {}
        }
      }
    }
  );
}

  // --------------------------------------------------------------
  // SHAPE UI
  // --------------------------------------------------------------
  setupShapeDropdown() {
    const select = document.getElementById("shape");
    if (!select) return;

    select.value = this.poolParams.shape;
    this.refreshDisplayedShapeLabel();

    select.addEventListener("change", async (e) => {
      this.captureUndoState("Shape change");
      this.destroyPoolEditor();
      this.poolParams.shape = e.target.value;
      this.baseShapeType = this.poolParams.shape;
      this.isCustomShape = false;

      this.updateShapeUIVisibility();

      if (this.poolParams.shape === "freeform") {
        this.editablePolygon = EditablePolygon.fromRectangle(
          this.poolParams.length,
          this.poolParams.width
        );
        this.editablePolygon.isRectangular = true;
        this.editablePolygon.minVertices = 3;
      } else {
        this.editablePolygon = null;
        this.destroyPoolEditor();
        this._purgePoolEditorHandles();
      }

      // keep UI in sync with current params, including shape
      this.syncSlidersFromParams();

      await this.rebuildPoolForCurrentShape();
      if (this.poolParams.shape !== "freeform") {
        this.destroyPoolEditor();
        this._purgePoolEditorHandles();
      }

      // Final defensive attach (in case materials changed during rebuild)
      try { this.caustics?.attachToGroup?.(this.poolGroup); } catch (_) {}
      this.refreshDisplayedShapeLabel();
    });
  }

  formatShapeLabel(shape) {
    if (shape === "rectangular") return "Rectangular";
    if (shape === "L") return "L-Shape";
    if (shape === "oval") return "Oval";
    if (shape === "kidney") return "Kidney";
    if (shape === "freeform") return "Freeform (editable)";
    return shape;
  }

  _polygonHasCurves() {
    return !!this.editablePolygon?.edges?.some?.((e) => !!e?.isCurved && !!e?.control);
  }

  _isAxisAlignedRectangle(verts = []) {
    if (!Array.isArray(verts) || verts.length !== 4) return false;
    const xs = [...new Set(verts.map((v) => Number(v.x.toFixed(4))))];
    const ys = [...new Set(verts.map((v) => Number(v.y.toFixed(4))))];
    return xs.length === 2 && ys.length === 2;
  }

  refreshDisplayedShapeLabel() {
    const select = document.getElementById("shape");
    if (!select) return;

    const base = this.baseShapeType || this.poolParams.shape;

    Array.from(select.options).forEach((opt) => {
      opt.textContent = this.formatShapeLabel(opt.value);
    });

    const activeValue = this.isCustomShape ? base : this.poolParams.shape;
    const activeOption = Array.from(select.options).find((opt) => opt.value === activeValue);

    if (activeOption) {
      const baseLabel = this.formatShapeLabel(base);
      activeOption.textContent = this.isCustomShape ? `Custom ${baseLabel}` : baseLabel;
      select.value = activeValue;
    }
  }

  checkIfPolygonReturnedToBaseShape() {
    if (!this.editablePolygon?.vertices?.length) return false;
    if (this._polygonHasCurves()) return false;

    const verts = this.editablePolygon.vertices;

    if (this.baseShapeType === "rectangular") {
      return this._isAxisAlignedRectangle(verts);
    }

    if (this.baseShapeType === "L") {
      return verts.length === 6;
    }

    return false;
  }

  normalizeShapeLabelIfNeeded() {
    if (this.checkIfPolygonReturnedToBaseShape()) {
      this.isCustomShape = false;
      this.poolParams.shape = this.baseShapeType;
      this.destroyPoolEditor();
    }
    this.refreshDisplayedShapeLabel();
    this.updateShapeUIVisibility();
  }

  updateShapeUIVisibility() {
    const shape = this.poolParams.shape;

    const kidney = document.getElementById("kidney-controls");
    const lshape = document.getElementById("lshape-controls");
    const freeform = document.getElementById("freeform-hint");

    if (kidney) kidney.style.display = shape === "kidney" ? "block" : "none";
    if (lshape) lshape.style.display = shape === "L" ? "block" : "none";
    if (freeform) {
      freeform.style.display = (shape === "freeform" || this.isCustomShape) ? "block" : "none";
    }
  }

  // --------------------------------------------------------------
  // SPA SLIDERS
  // --------------------------------------------------------------
  setupSpaSliders() {
    this.refreshSpaDimensionLabels();
    ["spaLength", "spaWidth", "spaTopHeight"].forEach((id) => {
      const slider = document.getElementById(id);
      const output = document.getElementById(`${id}-val`);
      if (!slider) return;

      slider.addEventListener("pointerdown", () => this.captureUndoState("Spa edit"));

      slider.addEventListener("input", async (e) => {
        if (!this.spa) return;

        const val = parseFloat(e.target.value);
        if (output) output.textContent = val.toFixed(2) + " m";

        const isCircularSpa = (this.spa?.userData?.spaShape || "square") === "circular";
        if (id === "spaLength") {
          this.spa.userData.spaLength = val;
          if (isCircularSpa) {
            this.spa.userData.spaWidth = val;
            const widthSlider = document.getElementById("spaWidth");
            const widthOutput = document.getElementById("spaWidth-val");
            if (widthSlider) widthSlider.value = String(val);
            if (widthOutput) widthOutput.textContent = val.toFixed(2) + " m";
          }
        } else if (id === "spaWidth") {
          this.spa.userData.spaWidth = val;
          if (isCircularSpa) {
            this.spa.userData.spaLength = val;
            const lengthSlider = document.getElementById("spaLength");
            const lengthOutput = document.getElementById("spaLength-val");
            if (lengthSlider) lengthSlider.value = String(val);
            if (lengthOutput) lengthOutput.textContent = val.toFixed(2) + " m";
          }
        } else if (id === "spaTopHeight") {
          setSpaTopOffset(val);
        }

        updateSpa(this.spa);
        this.refreshSpaTopOffsetSlider();
        await this.pbrManager.applyTilesToSpa(this.spa);

        if (this.poolGroup) {
          updatePoolWaterVoid(this.poolGroup, this.spa);
          updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa);
        }
      });
    });
  }

  // --------------------------------------------------------------
  // POOL SLIDERS
  // --------------------------------------------------------------
  // --------------------------------------------------------------
  // PERFORMANCE: live preview (cheap) + debounced rebuild (expensive)
  // --------------------------------------------------------------
  async _setLiveDragging(isDragging) {
    this._live.dragging = !!isDragging;

    // When the user releases the slider/handle, force the accurate rebuild to
    // finish before reapplying section voids/caps. Without this await, section
    // refresh can run against the pre-rebuild geometry and then be left stale.
    if (!this._live.dragging) {
      await this._flushRebuildNow();
      await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });
    }
  }

  _scheduleRebuildDebounced() {
    // Always debounce rebuilds on rapid slider changes
    if (this._live.rebuildTimer) clearTimeout(this._live.rebuildTimer);

    this._live.rebuildTimer = setTimeout(() => {
      this._live.rebuildTimer = 0;
      // If still dragging, keep it debounced (don’t rebuild mid-drag unless they pause)
      if (this._live.dragging) return;
      this._flushRebuildNow();
    }, this._live.rebuildDebounceMs);
  }

  async _flushRebuildNow() {
    if (this._live.rebuildTimer) {
      clearTimeout(this._live.rebuildTimer);
      this._live.rebuildTimer = 0;
    }

    // If nothing changed, skip
    if (!this._live.commitNeeded && !this._live.dirty.size) return;

    // Clear any live preview scaling before rebuilding for real
    try { this.poolGroup?.scale?.set?.(1, 1, 1); } catch (_) {}

    await this.rebuildPoolForCurrentShape();

    // Defensive caustics re-attach (materials may be swapped)
    try { this.caustics?.attachToGroup?.(this.poolGroup); } catch (_) {}
    await this._refreshSectionViewAfterGeometryEdit({ moveCamera: false, fullReset: true });
  }

  async _runAccurateLiveRebuild() {
    if (this._live.accuratePreviewInFlight) {
      this._live.accuratePreviewQueued = true;
      return;
    }

    this._live.accuratePreviewInFlight = true;
    this._live.accuratePreviewQueued = false;

    try {
      await this.rebuildPoolForCurrentShape();
      try { this.caustics?.attachToGroup?.(this.poolGroup); } catch (_) {}
    } finally {
      this._live.accuratePreviewInFlight = false;

      if (this._live.accuratePreviewQueued && this._live.dragging) {
        this._schedulePreviewTick();
      }
    }
  }

  _scheduleAccurateLiveRebuild() {
    const now = performance.now ? performance.now() : Date.now();
    const minDt = 1000 / Math.max(1, this._live.accuratePreviewFps || 12);

    if ((now - (this._live.lastAccuratePreviewTs || 0)) < minDt) {
      this._live.accuratePreviewQueued = true;
      return;
    }

    this._live.lastAccuratePreviewTs = now;
    this._runAccurateLiveRebuild();
  }

  _schedulePreviewTick() {
    if (this._live.previewRaf) return;

    const tick = (ts) => {
      this._live.previewRaf = 0;

      const minDt = 1000 / Math.max(1, this._live.previewFps);
      if (ts - this._live.lastPreviewTs < minDt) {
        this._live.previewRaf = requestAnimationFrame(tick);
        return;
      }
      this._live.lastPreviewTs = ts;

      // Do live preview while dragging OR while input events are streaming in (e.g. keyboard/scroll updates).
      const streaming = (ts - (this._live.lastInputTs || 0)) < (this._live.previewStreamMs || 200);
      if (this._live.dirty.size && (this._live.dragging || streaming)) {
        this._applyLivePreviewFromDirty();
        this._live.previewRaf = requestAnimationFrame(tick);
      }
    };

    this._live.previewRaf = requestAnimationFrame(tick);
  }

  _applyLivePreviewFromDirty() {
    if (!this.poolGroup) return;

    const base = this._live.baseParams || this.poolGroup.userData?.poolParams || this.poolParams;
    const p = this.poolParams;

    // Hybrid lightweight preview:
    // - length/width: scale X/Y (keeps meshes/materials/sims intact)
    // - shallow/deep/shallowFlat/deepFlat: vertex-only floor Z updates + wall height (no group Z scaling)
    // - everything else: rely on debounced rebuild
    let sx = 1, sy = 1;

    const footprintDirty = this._live.dirty.has("length") || this._live.dirty.has("width");
    const notchDirty = this._live.dirty.has("notchLengthX") || this._live.dirty.has("notchWidthY");
    const centeredCircularStepDirty = this.isCenteredCircularStepShape?.() && (
      this._live.dirty.has("stepWidth") ||
      this._live.dirty.has("stepCount")
    );
    if (centeredCircularStepDirty) {
      this.poolGroup.scale.set(1, 1, 1);
      this._scheduleAccurateLiveRebuild();
    }
    const isLShape = (p.shape || base.shape || this.poolGroup?.userData?.poolParams?.shape) === "L";

    if (footprintDirty && !isLShape) {
      const baseL = Math.max(0.001, base.length ?? 1);
      const baseW = Math.max(0.001, base.width ?? 1);
      sx = Math.max(0.01, (p.length ?? baseL) / baseL);
      sy = Math.max(0.01, (p.width ?? baseW) / baseW);
    } else {
      // Preserve current X/Y scaling if only depth is changing.
      sx = this.poolGroup.scale.x || 1;
      sy = this.poolGroup.scale.y || 1;
    }

    // Apply footprint scaling preview (NO Z scaling — keeps coping/steps semantics correct)
    this.poolGroup.scale.set(sx, sy, 1);

    if (footprintDirty || (isLShape && notchDirty)) {
      if (isLShape) {
        // L-shape footprint edits change the notch/coping topology, so a simple
        // scale preview is visually wrong. Run throttled accurate rebuilds while
        // the slider is moving so the footprint updates live. This also applies
        // to notch length/width, because they change the actual footprint.
        this.poolGroup.scale.set(1, 1, 1);
        this._scheduleAccurateLiveRebuild();
      } else {
        // Rebake UVs during live footprint preview so tile density updates live
        // instead of stretching until the debounced rebuild completes.
        this.rebakePoolTilingUVs();
      }
    }

    const depthDirty =
      this._live.dirty.has("shallow") ||
      this._live.dirty.has("deep") ||
      this._live.dirty.has("shallowFlat") ||
      this._live.dirty.has("deepFlat") ||
      this._live.dirty.has("stepDepth");

    if (depthDirty) {
      const useAccurateDepthRebuild = !!this.isCustomShape || this.poolParams.shape === "freeform";

      if (useAccurateDepthRebuild) {
        // Custom / editable outlines don’t respond safely to the lightweight wall-height
        // preview because segmented wall pieces can drift above the coping while dragging.
        // Force accurate rebuilds instead.
        this.poolGroup.scale.set(1, 1, 1);
        this._scheduleAccurateLiveRebuild();
      } else {
        // Update only what’s needed for a convincing live preview:
        // floor vertex Z + wall height (top stays at z=0) + step height/position.
        previewUpdateDepths(this.poolGroup, {
          shallow: p.shallow,
          deep: p.deep,
          shallowFlat: p.shallowFlat,
          deepFlat: p.deepFlat,
          stepCount: p.stepCount,
          stepDepth: p.stepDepth,
          stepWidth: p.stepWidth,
          stepPosition: p.stepPosition,
        });

        // Rebake UVs during live depth preview so deep-end walls and the last step
        // keep fixed tile density while their Z scale/position changes.
        this.rebakePoolTilingUVs();
      }
    }

    if (this.spa && (footprintDirty || depthDirty)) {
      try {
        this.spa.userData.poolGroup = this.poolGroup || null;
        this.spa.userData.poolParams = this.poolParams;
        snapToPool(this.spa);
        updateSpa(this.spa);
      } catch (_) {}
    }

    // Void/cutout should follow live footprint scaling.
    try { updateGroundVoid(this.ground || this.scene?.userData?.ground, this.poolGroup, this.spa); } catch (_) {}
    try { updatePoolWaterVoid(this.poolGroup, this.spa); } catch (_) {}

    if (this.sectionViewEnabled) {
      try { this._refreshSectionViewPresentation(); } catch (_) {}
    }

    // Keep dirty flags until the accurate rebuild commits on release.
    // Otherwise a live preview frame can consume the flags and the release
    // event has nothing left to rebuild, which causes the geometry to stay
    // visually scaled.
  }


  setupPoolSliders() {
    const ids = [
      "length",
      "width",
      "shallow",
      "deep",
      "shallowFlat",
      "deepFlat",
      "stepCount",
      "stepDepth",
      "stepWidth",
      "notchLengthX",
      "notchWidthY",
      "kidneyLeftRadius",
      "kidneyRightRadius",
      "kidneyOffset"
    ];

    const setOutput = (id, val, output) => {
      if (!output) return;
      if (
        id === "length" ||
        id === "width" ||
        id === "shallow" ||
        id === "deep" ||
        id === "shallowFlat" ||
        id === "deepFlat" ||
        id === "stepDepth" ||
        id === "stepWidth" ||
        id === "kidneyLeftRadius" ||
        id === "kidneyRightRadius" ||
        id === "kidneyOffset"
      ) {
        output.textContent = Number(val).toFixed(2) + " m";
      } else if (id === "notchLengthX" || id === "notchWidthY") {
        output.textContent = Number(val).toFixed(2);
      } else {
        output.textContent = String(val);
      }
    };

    const markDirty = (id) => {
      this._live.dirty.add(id);
      this._live.commitNeeded = true;
      this._live.lastInputTs = performance.now ? performance.now() : Date.now();
      // Live preview is throttled; we run it while dragging OR while input events are streaming.
      this._schedulePreviewTick();
      // Accurate rebuild is always debounced (or forced on release)
      this._scheduleRebuildDebounced();
    };

    ids.forEach((id) => {
      const slider = document.getElementById(id);
      const output = document.getElementById(`${id}-val`);
      if (!slider) return;
      if (id === "stepWidth") {
        this.syncStepWidthSliderLimit?.();
      }

      // Detect "dragging" for mouse + touch
      const onDown = () => {
        this.captureUndoState(`Slider:${id}`);
        // capture baseline for preview scaling (only if we have a pool)
        if (!this._live.baseParams) this._live.baseParams = { ...(this.poolGroup?.userData?.poolParams || this.poolParams) };
        this._setLiveDragging(true);
      };
      const onUp = () => this._setLiveDragging(false);

      slider.addEventListener("pointerdown", onDown);
      slider.addEventListener("pointerup", onUp);
      slider.addEventListener("touchstart", onDown, { passive: true });
      slider.addEventListener("touchend", onUp, { passive: true });
      slider.addEventListener("mousedown", onDown);
      window.addEventListener("mouseup", onUp);

      // Continuous updates (cheap preview + debounced rebuild)
      slider.addEventListener("input", (e) => {
        let val = parseFloat(e.target.value);
        if (id === "stepCount") val = Math.floor(val);

        if (id === "stepWidth") {
          const maxWidth = this.getStepWidthSliderMax?.() ?? Math.max(0.5, Number(this.poolParams.width) || 5);
          val = THREE.MathUtils.clamp(val, Number(slider.min) || 0.05, maxWidth);
          e.target.value = String(val);

          // Diagonal/circular corner uses one equal footprint value.
          // Centre circular uses Step Width as diameter and Step Extension as radius.
          if (this.isEqualCornerStepShape?.()) {
            const extensionSlider = document.getElementById("stepExtension");
            const extensionOutput = document.getElementById("stepExtension-val");
            if (extensionSlider) {
              extensionSlider.min = slider.min;
              extensionSlider.max = slider.max;
              extensionSlider.value = String(val);
            }
            if (extensionOutput) extensionOutput.textContent = val.toFixed(2) + " m";
          } else if (this.isCenteredCircularStepShape?.()) {
            const radius = val * 0.5;
            const extensionSlider = document.getElementById("stepExtension");
            const extensionOutput = document.getElementById("stepExtension-val");
            if (extensionSlider) {
              extensionSlider.min = "0.1";
              extensionSlider.max = String((this.getStepWidthSliderMax?.() ?? Math.max(0.5, Number(this.poolParams.width) || 5)) * 0.5);
              extensionSlider.value = String(radius);
            }
            if (extensionOutput) extensionOutput.textContent = radius.toFixed(2) + " m";
          }
        }

        this.poolParams[id] = val;
        if (id === "stepWidth" && this.isEqualCornerStepShape?.()) {
          this.poolParams.diagonalStepSize = val;
          this.poolParams.stepExtension = val;
        } else if (id === "stepWidth" && this.isCenteredCircularStepShape?.()) {
          this.poolParams.stepExtension = val * 0.5;
        }
        setOutput(id, val, output);

        if (id === "stepWidth") {
          if (this.isCenteredCircularStepShape?.()) {
            // Centre circular steps change topology, so use the accurate live
            // rebuild path instead of box-scaling the old meshes.
            this.poolGroup?.scale?.set?.(1, 1, 1);
            this._scheduleAccurateLiveRebuild?.();
          } else {
            this.previewStepWidthSlider(val);
          }
        }

        // For polygon shapes, allow the editor polygon to rescale live (cheap),
        // but do not rebuild full geometry each tick.
        if ((id === "length" || id === "width") && this.isPolygonShape()) {
          try {
            this.editablePolygon?.rescaleTo?.(this.poolParams.length, this.poolParams.width);
            if (this.poolParams.shape === "freeform" && this.editablePolygon) {
              this.editablePolygon.isRectangular = false;
            }
          } catch (_) {}
        }

        markDirty(id);
      });

      // Change event (fires on release in many browsers) forces rebuild now
      slider.addEventListener("change", () => {
        this._setLiveDragging(false);
      });
    });
  }

// --------------------------------------------------------------
// RIPPLE
  // --------------------------------------------------------------
  setupRippleClick() {
    this.renderer.domElement.addEventListener("dblclick", (event) => {
      if (event.button !== 0) return;
      if (this.poolEditor?.isDragging) return;
      if (!this.poolGroup?.userData?.waterMesh) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);

      const blockers = [];
      this.poolGroup?.traverse((o) => {
        if (o.userData?.isStep || o.userData?.isWall) blockers.push(o);
      });
      this.spa?.traverse((o) => {
        if (o.isMesh && !o.userData?.ignoreClickSelect) blockers.push(o);
      });
      if (blockers.length && ray.intersectObjects(blockers, true).length) {
        return;
      }

      const hit = ray.intersectObject(this.poolGroup.userData.waterMesh);
      if (!hit.length) return;

      const p = hit[0].point;

      // ✅ SAFE GUARD (RESTORES OLD FREEFORM BEHAVIOUR)
      if (typeof this.poolGroup.userData.triggerRipple === "function") {
        this.poolGroup.userData.triggerRipple(
          p.x,
          p.y,
          this.poolParams.length,
          this.poolParams.width
        );
      }
    });
  }

  // --------------------------------------------------------------
  // NEW: keep UI sliders in sync with poolParams
  // --------------------------------------------------------------
  syncSlidersFromParams() {
    const ids = [
      "length",
      "width",
      "shallow",
      "deep",
      "shallowFlat",
      "deepFlat",
      "stepCount",
      "stepDepth",
      "stepWidth",
      "notchLengthX",
      "notchWidthY",
      "kidneyLeftRadius",
      "kidneyRightRadius",
      "kidneyOffset"
    ];

    ids.forEach((id) => {
      const slider = document.getElementById(id);
      const output = document.getElementById(`${id}-val`);
      if (!slider) return;
      if (!(id in this.poolParams)) return;

      if (id === "stepWidth") {
        this.syncStepWidthSliderLimit?.();
      }

      const val = this.poolParams[id];
      slider.value = val;

      if (output) {
        if (
          id === "length" ||
          id === "width" ||
          id === "shallow" ||
          id === "deep" ||
          id === "shallowFlat" ||
          id === "deepFlat" ||
          id === "stepDepth" ||
          id === "stepWidth" ||
          id === "kidneyLeftRadius" ||
          id === "kidneyRightRadius" ||
          id === "kidneyOffset"
        ) {
          output.textContent = Number(val).toFixed(2) + " m";
        } else {
          output.textContent = val.toString();
        }
      }
    });

    // shape dropdown
    const shapeSelect = document.getElementById("shape");
    if (shapeSelect && this.poolParams.shape) {
      shapeSelect.value = this.poolParams.shape;
    }

    const wall = ["west", "east", "north", "south"].includes(this.poolParams.stepWall) ? this.poolParams.stepWall : "west";
    document.querySelectorAll("[data-step-wall]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.stepWall === wall);
    });

    const pos = this.poolParams.stepPosition === "left" || this.poolParams.stepPosition === "right"
      ? this.poolParams.stepPosition
      : "center";
    document.querySelectorAll("[data-step-position]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.stepPosition === pos);
    });
    const shape = (["diagonal", "circular", "radius"].includes(this.poolParams.stepShape)) ? this.poolParams.stepShape : "rectangle";
    document.querySelectorAll("[data-step-shape]").forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.stepShape === shape)
    );
    this.updateCenterCircularModeControls?.();
  }

  // --------------------------------------------------------------
  // LOOP
  // --------------------------------------------------------------
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

const dirLight = this.scene?.userData?.dirLight || null;

if (this.poolGroup?.userData?.animatables) {
  this.poolGroup.userData.animatables.forEach((obj) => {
    obj.userData.animate?.(delta, this.clock, this.camera, dirLight, this.renderer);
  });
}

spas.forEach((spaItem) => {
  spaItem.userData.waterMesh?.userData.animate?.(delta, this.clock, this.camera, dirLight, this.renderer);
  spaItem.userData.spilloverMesh?.userData.animate?.(delta, this.clock, this.camera, dirLight, this.renderer);
});

this.scene?.traverse?.((obj) => {
  if (obj?.userData?.isSpaChannelWater) {
    obj.userData.animate?.(delta, this.clock, this.camera, dirLight, this.renderer);
  }
});


    // Pool water animation (GPU sim)
    this.poolGroup?.userData?.waterMesh?.userData?.animate?.(delta, this.clock, this.camera, dirLight, this.renderer);

    if (this.caustics) {
      if (!this._loggedCausticsTick) { console.log('✅ Caustics update ticking'); this._loggedCausticsTick = true; }
      const wm = this.poolGroup?.userData?.waterMesh;
      const ht = wm?.material?.uniforms?.heightTex?.value || null;
      this.caustics.setWaterHeightTexture?.(ht, 512);
      this.caustics.update(delta, (dirLight && dirLight.position) ? dirLight.position : null);
    }
// Keep freeform handles screen-aligned and interactive
    if (this.poolParams.shape === "freeform") {
      this.poolEditor?.update?.();
    } else if (this.poolEditor) {
      this.destroyPoolEditor();
      this._purgePoolEditorHandles();
    }

    this._updateDimensionHandles();
    this._updateSpaDimensionHandles();
    this._updateSectionDimensionHandles();
    this.scene?.userData?.grassSystem?.update?.(this.camera);

    if (this.sectionViewEnabled) {
      const nextSectionSig = this._getSectionViewSignature();
      if (nextSectionSig !== this.sectionViewSignature) {
        this._refreshSectionViewPresentation();
      }
    }

    // Keep selection/hover highlight meshes locked to the live world-space
    // transforms of their targets while the pool is being preview-scaled or rebuilt.
    if (!this.sectionViewEnabled) {
      if (this.selectedWall && this.selectedWallHighlightMesh?.visible) {
        this.updateHighlightForWall(this.selectedWall, true);
      }
      if (this.hoveredWall && this.hoverWallHighlightMesh?.visible) {
        this.updateHighlightForWall(this.hoveredWall, false);
      }
      if (this.selectedStep && this.selectedHighlightMesh?.visible) {
        this.updateHighlightForStep(this.selectedStep, true);
      }
      if (this.hoveredStep && this.hoverHighlightMesh?.visible) {
        this.updateHighlightForStep(this.hoveredStep, false);
      }
    } else {
      this._syncSectionSelectionEffects();
    }

    // Stylized water prepass:
// Render scene WITHOUT any water meshes into offscreen RTs, then let the water shader
// sample those textures for refraction + thickness absorption.
const _poolWater = this.poolGroup?.userData?.waterMesh || null;
const _poolU = _poolWater?.material?.uniforms || null;
const _spaWaters = spas
  .map((s) => s?.userData?.waterMesh)
  .filter((wm) => !!wm && wm !== _poolWater);
const _channelWaters = [];
this.scene?.traverse?.((obj) => {
  if (obj?.userData?.isSpaChannelWater) _channelWaters.push(obj);
});

// Collect all water meshes (pool + spas + channel waters) so none of them contaminate the prepasses
const _hiddenWater = [];
if (_poolWater) _hiddenWater.push(_poolWater);
_spaWaters.forEach((wm) => _hiddenWater.push(wm));
_channelWaters.forEach((wm) => _hiddenWater.push(wm));

if (_poolWater && _poolU && this._waterInteriorRT) {
  // Use drawing-buffer size (accounts for devicePixelRatio), because gl_FragCoord is in buffer pixels
  const _buf = new THREE.Vector2();
  this.renderer.getDrawingBufferSize(_buf);

  // Keep RT sizes synced (defensive: resize handler covers most cases, but DPR can change)
  if (this._waterInteriorRT.width !== _buf.x || this._waterInteriorRT.height !== _buf.y) {
    this._waterInteriorRT.setSize(_buf.x, _buf.y);
  }
  if (this._waterDepthRT && (this._waterDepthRT.width !== _buf.x || this._waterDepthRT.height !== _buf.y)) {
    this._waterDepthRT.setSize(_buf.x, _buf.y);
  }

  if (_poolU.resolution) _poolU.resolution.value.set(_buf.x, _buf.y);
  if (_poolU.interiorTex) _poolU.interiorTex.value = this._waterInteriorRT.texture;

  [..._spaWaters, ..._channelWaters].forEach((wm) => {
    const u = wm?.material?.uniforms || null;
    if (!u) return;
    if (u.resolution) u.resolution.value.set(_buf.x, _buf.y);
    if (u.cameraNear) u.cameraNear.value = this.camera.near;
    if (u.cameraFar)  u.cameraFar.value  = this.camera.far;
  });

  // Hide water meshes for BOTH passes
  _hiddenWater.forEach((m) => (m.visible = false));

  // Depth prepass (DepthTexture) – must not contain water
  if (this._waterDepthRT && _poolU.depthTex) {
    _poolU.depthTex.value = this._waterDepthRT.depthTexture;
    if (_poolU.cameraNear) _poolU.cameraNear.value = this.camera.near;
    if (_poolU.cameraFar)  _poolU.cameraFar.value  = this.camera.far;

    // Render scene depth into the DepthTexture target
    this.renderer.setRenderTarget(this._waterDepthRT);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    // Re-bind (defensive) – in case a rebuild replaced water material/uniforms
    if (_poolWater?.userData?.setDepthTex) _poolWater.userData.setDepthTex(this._waterDepthRT.depthTexture);
    [..._spaWaters, ..._channelWaters].forEach((wm) => wm?.userData?.setDepthTex?.(this._waterDepthRT.depthTexture));
  }

  // Color prepass (scene without water) for refraction
  this.renderer.setRenderTarget(this._waterInteriorRT);
  this.renderer.clear(true, true, true);
  this.renderer.render(this.scene, this.camera);
  this.renderer.setRenderTarget(null);

  if (_poolWater?.userData?.setInteriorTex) _poolWater.userData.setInteriorTex(this._waterInteriorRT.texture);
  [..._spaWaters, ..._channelWaters].forEach((wm) => wm?.userData?.setInteriorTex?.(this._waterInteriorRT.texture));

  // Restore visibility
  _hiddenWater.forEach((m) => (m.visible = true));
}

this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.destroyPoolEditor();
    this.destroyDimensionHandles();
    this.destroySectionDimensionHandles();
  }
}
