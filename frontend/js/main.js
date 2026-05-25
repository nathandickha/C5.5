// js/main.js
// Keep the first page fast: render the starter options immediately, then load
// the heavier Three.js editor only after a pool preset is selected.

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

let editorModulePromise = null;
let appBootPromise = null;
let editorPreloadStarted = false;

function preloadEditorModule() {
  if (editorModulePromise) return editorModulePromise;
  editorPreloadStarted = true;
  editorModulePromise = import("./app/PoolApp.js").catch((err) => {
    console.warn("[PoolApp] Background editor preload failed; will retry on click.", err);
    editorModulePromise = null;
    editorPreloadStarted = false;
    throw err;
  });
  return editorModulePromise;
}

function scheduleEditorPreload() {
  if (editorPreloadStarted) return;

  const startPreload = () => {
    if (editorPreloadStarted) return;
    preloadEditorModule().catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(startPreload, { timeout: 900 });
  } else {
    window.setTimeout(startPreload, 250);
  }
}

function setStarterBusy(card, busy) {
  const allCards = document.querySelectorAll(".starter-card");
  allCards.forEach((item) => {
    item.disabled = busy;
    item.classList.toggle("is-disabled", busy && item !== card);
  });

  if (!card) return;
  card.classList.toggle("is-loading", busy);
  const action = card.querySelector(".starter-card-action");
  if (action) action.textContent = busy ? "Loading 3D Editor…" : "Start Design";
}


function normalizeStarterPresetParams(params = {}) {
  return {
    ...params,
    shallow: 1.2,
    deep: 1.8,
    shallowFlat: 1,
    deepFlat: 1
  };
}

function createRoundedCornerRectanglePolygon(THREE, EditablePolygon, length, width, radius = 2, corner = "back-right") {
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
    add(x0 + r, y0); add(x1, y0); add(x1, y1); add(x0, y1); add(x0, y0 + r);
    arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  } else if (selected === "front-right") {
    add(x0, y0); add(x1 - r, y0);
    arc(x1 - r, y0 + r, Math.PI * 1.5, Math.PI * 2);
    add(x1, y1); add(x0, y1);
  } else if (selected === "back-left") {
    add(x0, y0); add(x1, y0); add(x1, y1); add(x0 + r, y1);
    arc(x0 + r, y1 - r, Math.PI * 0.5, Math.PI);
  } else {
    add(x0, y0); add(x1, y0); add(x1, y1 - r);
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

function createStarterFootprintPolygon(THREE, EditablePolygon, preset) {
  const fp = preset?.customFootprint;
  if (!fp || fp.type !== "rounded-corner-rectangle") return null;
  const params = preset?.params || {};
  return createRoundedCornerRectanglePolygon(
    THREE,
    EditablePolygon,
    params.length,
    params.width,
    fp.radius,
    fp.corner
  );
}

function getStarterPreviewCameraFrame(THREE, object, preset) {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const directionValues = preset?.previewCamera?.direction || [1, -1, 0.75];
  const direction = new THREE.Vector3(
    Number(directionValues[0]) || 1,
    Number(directionValues[1]) || -1,
    Number(directionValues[2]) || 0.75
  ).normalize();

  // Axonometric preview: use a parallel/orthographic projection instead of a
  // perspective/isometric camera. The distance only controls clipping and the
  // orbit radius; visual scale is controlled by frustumSize.
  const distance = maxSize * 2.4;
  const offset = direction.clone().multiplyScalar(distance);
  return {
    center,
    offset,
    distance,
    frustumSize: maxSize * 1.02,
    height: offset.z,
    horizontalDistance: Math.max(0.01, Math.sqrt((offset.x * offset.x) + (offset.y * offset.y))),
    startAngle: Math.atan2(offset.y, offset.x)
  };
}

function setStarterPreviewCameraFromFrame(THREE, camera, frame, angleOffset = 0) {
  const angle = frame.startAngle + angleOffset;
  camera.position.set(
    frame.center.x + Math.cos(angle) * frame.horizontalDistance,
    frame.center.y + Math.sin(angle) * frame.horizontalDistance,
    frame.center.z + frame.height
  );
  camera.up.set(0, 0, 1);
  camera.lookAt(frame.center);
  camera.near = 0.05;
  camera.far = Math.max(100, frame.distance * 8);

  if (camera.isOrthographicCamera) {
    const aspect = Math.max(0.01, camera.userData.previewAspect || 1);
    const frustumSize = Math.max(1, frame.frustumSize || frame.distance);
    camera.left = -frustumSize * aspect * 0.5;
    camera.right = frustumSize * aspect * 0.5;
    camera.top = frustumSize * 0.5;
    camera.bottom = -frustumSize * 0.5;
    camera.zoom = 1;
  }

  camera.updateProjectionMatrix();
}

function fitStarterPreviewCamera(THREE, camera, object, preset) {
  const frame = getStarterPreviewCameraFrame(THREE, object, preset);
  setStarterPreviewCameraFromFrame(THREE, camera, frame, 0);
  return frame;
}

function disposeStarterPreviewObject(object) {
  object?.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
    materials.forEach((mat) => {
      if (!mat) return;
      Object.values(mat).forEach((value) => {
        if (value && typeof value === "object" && value.isTexture) value.dispose?.();
      });
      mat.dispose?.();
    });
  });
}

function createStarterPreviewStudioScene(THREE, scene, previewGroup, modules) {
  const { updateGroundVoid } = modules;

  scene.background = null;
  scene.environment = null;

  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(18, -22, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.02;
  key.shadow.bias = -0.0002;
  const d = 20;
  key.shadow.camera = new THREE.OrthographicCamera(-d, d, d, -d, 0.5, 150);
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(-20, 20, 18);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(25, 25, 12);
  scene.add(rim);

  const groundGeo = new THREE.PlaneGeometry(200, 200, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xf3f5f7,
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.25
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const poolGroup = previewGroup?.userData?.poolGroup || null;
  const spa = previewGroup?.userData?.spa || null;
  try { updateGroundVoid?.(ground, poolGroup, spa); } catch (_) {}

  const skyGeo = new THREE.SphereGeometry(500, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0xf7f9fc) },
      bottomColor: { value: new THREE.Color(0xe7edf5) }
    },
    vertexShader: `
      varying vec3 vPos;
      void main(){
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      void main(){
        float h = normalize(vPos).y * 0.5 + 0.5;
        h = smoothstep(0.0, 1.0, h);
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.onBeforeRender = (_r, _s, cam) => skyDome.position.copy(cam.position);
  scene.add(skyDome);

  return ground;
}

async function applyEditorPreviewMaterials(preset, previewGroup, modules) {
  const { PBRManager } = modules;
  if (!PBRManager || !previewGroup?.userData?.poolGroup) return;

  const poolGroup = previewGroup.userData.poolGroup;
  const selectedTile = preset?.params?.tileColor || preset?.tileColor || poolGroup?.userData?.params?.tileColor || "blue";
  const pbr = new PBRManager(poolGroup.userData?.params || preset?.params || {}, 0.3, null);
  pbr.currentTileKey = selectedTile;
  pbr.setPoolGroup(poolGroup);
  await pbr.applyCurrentToGroup(poolGroup);
  if (previewGroup.userData.spa) {
    await pbr.applyTilesToSpa(previewGroup.userData.spa);
  }
}

async function buildStarterPreviewPoolGroup(THREE, preset, modules) {
  const {
    createPoolGroup,
    createRectanglePool,
    createOvalPool,
    createKidneyPool,
    createLShapePool,
    EditablePolygon,
    createSpa,
    updateSpa,
    snapToPool
  } = modules;

  const params = normalizeStarterPresetParams(preset.params || {});
  let poolGroup;
  const polygon = createStarterFootprintPolygon(THREE, EditablePolygon, preset);

  if (polygon) {
    params.shape = "freeform";
    poolGroup = createPoolGroup(params, 0.3, polygon);
  } else if (params.shape === "oval") {
    poolGroup = createOvalPool(params, 0.3);
  } else if (params.shape === "kidney") {
    poolGroup = createKidneyPool(params, 0.3);
  } else if (params.shape === "L") {
    poolGroup = createLShapePool(params, 0.3);
  } else if (params.shape === "rectangular") {
    poolGroup = createRectanglePool(params, 0.3);
  } else {
    poolGroup = createPoolGroup(params, 0.3, EditablePolygon.fromRectangle(params.length || 8, params.width || 4));
  }

  const previewGroup = new THREE.Group();
  previewGroup.add(poolGroup);
  previewGroup.userData.poolGroup = poolGroup;

  if (preset.spa && typeof createSpa === "function") {
    const previewScene = new THREE.Scene();
    previewScene.add(previewGroup);
    const spa = createSpa(params, previewScene, {
      shape: preset.spa.shape === "circular" ? "circular" : "square",
      width: preset.spa.width || 2,
      length: preset.spa.length || preset.spa.width || 2,
      poolGroup
    });
    if (spa) {
      if (Number.isFinite(Number(preset.spa.topHeight))) {
        spa.userData.previewTopHeight = Number(preset.spa.topHeight);
      }
      try { updateSpa?.(spa); } catch (_) {}
      try { snapToPool?.(spa); } catch (_) {
        // Fallback position: show the spa attached near the back-right edge.
        const b = new THREE.Box3().setFromObject(poolGroup);
        const size = b.getSize(new THREE.Vector3());
        spa.position.set(b.max.x - (preset.spa.width || 2) * 0.5, b.max.y + 0.65, -0.02);
        if (spa.userData) spa.userData.poolGroup = poolGroup;
      }
      try { updateSpa?.(spa); } catch (_) {}
      previewGroup.add(spa);
      previewGroup.userData.spa = spa;
    }
  }

  try { modules.updatePoolWaterVoid?.(poolGroup, previewGroup.userData.spa || null); } catch (_) {}
  await applyEditorPreviewMaterials(preset, previewGroup, modules);
  return previewGroup;
}

async function renderStarterPreview3D(card, preset) {
  const host = card?.querySelector?.(".starter-preview");
  if (!host || host.dataset.livePreview === "ready") return;
  host.dataset.livePreview = "loading";

  try {
    const [
      THREE,
      poolModule,
      rectangleModule,
      ovalModule,
      kidneyModule,
      lshapeModule,
      polygonModule,
      spaModule,
      sceneModule,
      pbrModule
    ] = await Promise.all([
      import("https://esm.sh/three@0.158.0"),
      import("./pool/pool.js"),
      import("./pool/shapes/rectanglePool.js"),
      import("./pool/shapes/ovalPool.js"),
      import("./pool/shapes/kidneyPool.js"),
      import("./pool/shapes/lshapePool.js"),
      import("./pool/editing/polygon.js"),
      import("./pool/spa.js"),
      import("./scene.js"),
      import("./pbr/PBR.js")
    ]);

    if (!document.body.contains(host)) return;

    const width = Math.max(260, Math.floor(host.clientWidth || 320));
    const height = Math.max(130, Math.floor(host.clientHeight || 130));
    const canvas = document.createElement("canvas");
    canvas.className = "starter-preview-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();

    const previewGroup = await buildStarterPreviewPoolGroup(THREE, preset, {
      createPoolGroup: poolModule.createPoolGroup,
      createRectanglePool: rectangleModule.createRectanglePool,
      createOvalPool: ovalModule.createOvalPool,
      createKidneyPool: kidneyModule.createKidneyPool,
      createLShapePool: lshapeModule.createLShapePool,
      EditablePolygon: polygonModule.EditablePolygon,
      createSpa: spaModule.createSpa,
      updateSpa: spaModule.updateSpa,
      snapToPool: spaModule.snapToPool,
      updateGroundVoid: sceneModule.updateGroundVoid,
      updatePoolWaterVoid: sceneModule.updatePoolWaterVoid,
      PBRManager: pbrModule.PBRManager
    });
    scene.add(previewGroup);
    const previewGround = createStarterPreviewStudioScene(THREE, scene, previewGroup, {
      updateGroundVoid: sceneModule.updateGroundVoid
    });

    const aspect = width / height;
    const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 500);
    camera.userData.previewAspect = aspect;
    camera.up.set(0, 0, 1);
    const cameraFrame = fitStarterPreviewCamera(THREE, camera, previewGroup, preset);
    renderer.render(scene, camera);

    let animationFrame = 0;
    let hoverStart = 0;
    const orbitSpeed = 0.55; // radians per second

    const renderStaticPreview = () => {
      setStarterPreviewCameraFromFrame(THREE, camera, cameraFrame, 0);
      renderer.render(scene, camera);
    };

    const renderOrbitPreview = (time) => {
      if (!hoverStart) hoverStart = time;
      const elapsedSeconds = (time - hoverStart) / 1000;
      setStarterPreviewCameraFromFrame(THREE, camera, cameraFrame, elapsedSeconds * orbitSpeed);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderOrbitPreview);
    };

    const startOrbitPreview = () => {
      if (animationFrame) return;
      hoverStart = 0;
      animationFrame = window.requestAnimationFrame(renderOrbitPreview);
    };

    const stopOrbitPreview = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      hoverStart = 0;
      renderStaticPreview();
    };

    host.replaceChildren(canvas);
    host.dataset.livePreview = "ready";
    card.classList.add("has-live-preview");
    host.addEventListener("mouseenter", startOrbitPreview);
    host.addEventListener("mouseleave", stopOrbitPreview);
    host.addEventListener("focusin", startOrbitPreview);
    host.addEventListener("focusout", stopOrbitPreview);

    const cleanupPreview = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      host.removeEventListener("mouseenter", startOrbitPreview);
      host.removeEventListener("mouseleave", stopOrbitPreview);
      host.removeEventListener("focusin", startOrbitPreview);
      host.removeEventListener("focusout", stopOrbitPreview);
      disposeStarterPreviewObject(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
    };
    host.__starterPreviewCleanup = cleanupPreview;
  } catch (err) {
    console.warn("[StarterPreview] 3D preview failed; using CSS fallback.", preset?.id, err);
    host.dataset.livePreview = "fallback";
  }
}

function scheduleStarterPreview3D(card, preset) {
  const run = () => renderStarterPreview3D(card, preset);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    window.setTimeout(run, 250);
  }
}

function setupStarterPresetScreen() {
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
      if (appBootPromise) return;
      setStarterBusy(card, true);
      try {
        appBootPromise = preloadEditorModule().then(async ({ PoolApp }) => {
          const app = new PoolApp();
          window.poolApp = app;
          await app.start({ starterPreset: preset });
          overlay.classList.add("hidden");
          return app;
        });
        await appBootPromise;
      } catch (err) {
        console.error("[PoolApp] Failed to start 3D editor", err);
        appBootPromise = null;
        setStarterBusy(card, false);
        alert("The 3D editor failed to load. Check the console for details.");
      }
    });

    grid.appendChild(card);
    scheduleStarterPreview3D(card, preset);
  });
}

setupStarterPresetScreen();
scheduleEditorPreload();
