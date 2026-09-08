import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, useGLTF } from "@react-three/drei";

import * as THREE from "three";

import "./Splash.css";

import regionPrevious from "./assets/region-previous.jpg";
import regionCurrent from "./assets/region-current.jpg";

/* =========================================================
   TIMELINE

   Every stage gets room to breathe. Nothing competes for
   attention at the same time — one thing resolves, then the
   next begins.
========================================================= */

const TIMELINE = {
  MENU_OPEN: 700, // cursor reaches "+", upload menu opens
  FILES_UPLOADED: 1600, // cursor clicks "Upload files", thumbnails appear in the pill
  TYPING_START: 2500, // dropdown closes, cursor moves to the field, query types
  QUERY_READY: 4200, // cursor reaches send, mic morphs into a send action
  SPACE_REVEAL: 5000, // search dissolves, Earth fades in
  SATELLITE_FOCUS: 6400, // satellite settles into frame
  RAY_ACTIVE: 7600, // scan ray draws from satellite to Earth
  CAMERA_ZOOM: 9000, // camera pushes in on the region
  DETECTION: 10200, // before/after cards appear
  FINISH: 13200,
};

/* =========================================================
   UTILS
========================================================= */

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const easeOutCubic = (value) => {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
};

/* =========================================================
   LAT / LNG POSITION
========================================================= */

function latLngToVector3(latitude, longitude, radius) {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/* =========================================================
   ICONS
========================================================= */

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const IconMic = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconArrowUp = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 15V4M7 8l5-5 5 5M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconDrive = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M8 3h8l6 10-4 7H6l-4-7 6-10Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconMore = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="6" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4.5 4.5L19 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* =========================================================
   GLB LOADER
========================================================= */

function GLB({ path, targetSize, position = [0, 0, 0] }) {
  const { scene } = useGLTF(path);

  const model = useMemo(() => {
    const clone = scene.clone(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const max = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / max;

    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    clone.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        const material = child.material.clone();
        material.side = THREE.DoubleSide;

        if ("roughness" in material) material.roughness = 0.3;
        if ("metalness" in material) material.metalness = 0.25;

        child.material = material;
      }
    });

    return clone;
  }, [scene, targetSize]);

  return (
    <group position={position}>
      <primitive object={model} />
    </group>
  );
}

/* =========================================================
   EARTH

   The region rotates toward the camera once the ray sequence
   begins — not before, so the turn reads as a response to the
   scan rather than an idle spin.
========================================================= */

function EarthSystem({ phase }) {
  const earthGroup = useRef();
  const earthRadius = 2.28;

  const regionLocal = useMemo(
    () => latLngToVector3(22.5, 79.0, earthRadius),
    []
  );

  const targetRotation = useMemo(() => {
    const longitude = Math.atan2(regionLocal.x, regionLocal.z);
    return -longitude;
  }, [regionLocal]);

  useFrame(({ clock }) => {
    if (!earthGroup.current) return;

    const time = clock.getElapsedTime();
    let wantedRotation = time * 0.065;

    if (phase >= 7) wantedRotation = targetRotation;

    const current = earthGroup.current.rotation.y;
    let difference = wantedRotation - current;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));

    earthGroup.current.rotation.y += difference * 0.025;
  });

  return (
    <group ref={earthGroup}>
      <GLB path="/models/earth.glb" targetSize={4.45} />

      <mesh scale={1.045}>
        <sphereGeometry args={[2.09, 64, 64]} />
        <meshBasicMaterial color="#45dfff" transparent opacity={0.032} side={THREE.BackSide} />
      </mesh>

      {/* Region marker + the point the ray and dots converge on */}
      <group name="REGION_TRACK" position={[regionLocal.x, regionLocal.y, regionLocal.z]}>
        <mesh>
          <sphereGeometry args={[0.045, 20, 20]} />
          <meshBasicMaterial color="#70eaff" />
        </mesh>

        <pointLight color="#53dfff" intensity={phase >= 7 ? 2.2 : 0} distance={0.8} />

        <DetectionDots active={phase >= 9} />
      </group>
    </group>
  );
}

/* =========================================================
   SATELLITE
========================================================= */

function Satellite({ phase }) {
  const satelliteRef = useRef();
  const introRef = useRef(0);

  useFrame(({ clock }) => {
    if (!satelliteRef.current) return;

    const time = clock.getElapsedTime();
    const angle = time * 0.22;
    const radius = 4.25;

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle * 1.15) * 0.95;
    const z = Math.sin(angle) * radius;

    satelliteRef.current.position.lerp(new THREE.Vector3(x, y, z), 0.025);

    const direction = new THREE.Vector3(-x, -y, -z).normalize();
    const rotation = new THREE.Quaternion();
    const forward = new THREE.Vector3(0, 0, -1);

    rotation.setFromUnitVectors(forward, direction);
    satelliteRef.current.quaternion.slerp(rotation, 0.04);

    satelliteRef.current.rotation.z += Math.sin(time * 1.5) * 0.001;

    const wanted = phase >= 6 ? 1 : 0.001;
    introRef.current += (wanted - introRef.current) * 0.05;
    satelliteRef.current.scale.setScalar(introRef.current);
  });

  return (
    <group ref={satelliteRef} name="SATELLITE_TRACK">
      <GLB path="/models/satellite.glb" targetSize={1.35} />
      <pointLight color="#58ddff" intensity={2.5} distance={3} />
    </group>
  );
}

/* =========================================================
   SCAN RAY

   A single beam from the satellite to the region. It draws
   itself in — not just fades — so it reads as an active scan
   rather than a static line switching on.
========================================================= */

function ScanRay({ active }) {
  const lineRef = useRef();
  const growth = useRef(0);

  const satellite = useRef(new THREE.Vector3());
  const region = useRef(new THREE.Vector3());
  const midpoint = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useFrame(({ scene }) => {
    if (!lineRef.current) return;

    growth.current += ((active ? 1 : 0) - growth.current) * 0.06;

    if (growth.current < 0.01) {
      lineRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;

    const satelliteObject = scene.getObjectByName("SATELLITE_TRACK");
    const regionObject = scene.getObjectByName("REGION_TRACK");

    if (!satelliteObject || !regionObject) return;

    satelliteObject.getWorldPosition(satellite.current);
    regionObject.getWorldPosition(region.current);

    const grown = new THREE.Vector3().lerpVectors(
      region.current,
      satellite.current,
      easeOutCubic(growth.current)
    );

    midpoint.current.addVectors(region.current, grown).multiplyScalar(0.5);
    direction.current.subVectors(grown, region.current);

    const length = direction.current.length();
    if (length < 0.001) {
      lineRef.current.visible = false;
      return;
    }

    lineRef.current.position.copy(midpoint.current);
    lineRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.current.clone().normalize()
    );
    lineRef.current.scale.y = length;

    if (lineRef.current.material) {
      lineRef.current.material.opacity = 0.7 * easeOutCubic(growth.current);
    }
  });

  return (
    <mesh ref={lineRef} visible={false}>
      <cylinderGeometry args={[0.007, 0.022, 1, 10]} />
      <meshBasicMaterial color="#69e8ff" transparent opacity={0} />
    </mesh>
  );
}

/* =========================================================
   DETECTION DOTS

   Points light up one at a time near the region, each with a
   short delay after the last.
========================================================= */

function DetectionDots({ active }) {
  const groupRef = useRef();
  const activatedAt = useRef(null);

  const dots = useMemo(
    () => [
      [0.15, 0.05, 0.09],
      [0.2, -0.03, 0.08],
      [0.26, 0.03, 0.07],
      [0.1, -0.11, 0.06],
      [0.17, -0.17, 0.06],
      [0.31, -0.1, 0.05],
      [0.25, -0.21, 0.05],
    ],
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.getElapsedTime();

    if (active && activatedAt.current === null) activatedAt.current = time;
    if (!active) activatedAt.current = null;

    groupRef.current.children.forEach((child, index) => {
      if (activatedAt.current === null) {
        child.scale.setScalar(0.001);
        return;
      }

      const delay = index * 0.16;
      const elapsed = time - activatedAt.current - delay;

      if (elapsed <= 0) {
        child.scale.setScalar(0.001);
        return;
      }

      const pop = easeOutCubic(Math.min(elapsed / 0.4, 1));
      const pulse = 1 + Math.sin(time * 3.2 + index) * 0.12;

      child.scale.setScalar(pop * pulse);
    });
  });

  return (
    <group ref={groupRef}>
      {dots.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.024, 12, 12]} />
          <meshBasicMaterial color="#66eaff" />
        </mesh>
      ))}
    </group>
  );
}

/* =========================================================
   CAMERA
========================================================= */

function CameraController({ phase }) {
  useFrame(({ camera }) => {
    let target = new THREE.Vector3(0, 0.2, 11);

    if (phase >= 6) target = new THREE.Vector3(0, 0.1, 9.5);
    if (phase >= 7) target = new THREE.Vector3(0, 0.05, 7.4);
    if (phase >= 8) target = new THREE.Vector3(0, 0.0, 6.1);

    camera.position.lerp(target, 0.022);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* =========================================================
   WORLD
========================================================= */

function World({ phase }) {
  return (
    <>
      <ambientLight intensity={0.22} />
      <directionalLight position={[5, 3, 6]} intensity={3.4} />
      <directionalLight position={[-5, 1, 3]} intensity={1.1} color="#258fca" />
      <pointLight position={[0, 1, 6]} intensity={1.2} color="#2acfff" />

      <Stars radius={100} depth={60} count={1500} factor={1.6} saturation={0} fade speed={0.14} />

      <EarthSystem phase={phase} />
      <Satellite phase={phase} />
      <ScanRay active={phase >= 7} />

      <CameraController phase={phase} />
    </>
  );
}

/* =========================================================
   FAKE CURSOR

   Drives the search screen the way a hand would: it moves to
   "+", clicks, moves down to the upload row, clicks, moves
   into the field while the query types, then moves to send
   and clicks. Every move and click is visible, not implied.
========================================================= */

// Recalculated against the live layout: plus/upload assume the
// pill is still collapsed (card has no extra padding yet), while
// field/send assume the card has already grown to hold the two
// attachment thumbnails, which pushes the pill itself down.
const CURSOR_POINTS = {
  rest: { top: 108, left: 236 },
  plus: { top: 30, left: 30 },
  upload: { top: 96, left: 40 },
  field: { top: 134, left: 145 },
  send: { top: 134, right: 42 },
};

function Cursor({ phase }) {
  let point = CURSOR_POINTS.rest;

  if (phase === 1) point = CURSOR_POINTS.plus;
  else if (phase === 2) point = CURSOR_POINTS.upload;
  else if (phase === 3) point = CURSOR_POINTS.field;
  else if (phase >= 4) point = CURSOR_POINTS.send;

  const visible = phase <= 4;
  const clicking = phase === 1 || phase === 2 || phase === 4;

  const style = {
    top: `${point.top}px`,
    left: point.left !== undefined ? `${point.left}px` : "auto",
    right: point.right !== undefined ? `${point.right}px` : "auto",
    opacity: visible ? 1 : 0,
  };

  return (
    <div className="fake-cursor" style={style}>
      <svg viewBox="0 0 24 24" className="cursor-glyph">
        <path
          d="M4 2.4 18.8 9l-6.3 1.9L10.6 17 4 2.4Z"
          fill="#12181c"
          stroke="#ffffff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      {clicking && <span key={phase} className="cursor-click" />}
    </div>
  );
}

/* =========================================================
   SEARCH INTERFACE

   A rounded card holding both the attachment previews and the
   input pill, driven entirely by the cursor: it opens the
   upload menu, resolves it into two uploaded image thumbnails
   sitting inside the same card, then types out a comparison
   query and sends it.
========================================================= */

function SearchInterface({ phase }) {
  const [query, setQuery] = useState("");
  const text = "What changed in this region?";

  useEffect(() => {
    if (phase !== 3) return;

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setQuery(text.slice(0, index));
      if (index >= text.length) clearInterval(timer);
    }, 55);

    return () => clearInterval(timer);
  }, [phase]);

  const menuStage = phase === 1;
  const attachmentsVisible = phase >= 2;
  const typing = phase >= 3;
  const ready = phase >= 4;
  const exiting = phase >= 5;

  return (
    <div className={`search-interface ${exiting ? "search-exit" : ""}`}>
      <div className="search-panel">
        <h1>
          What do you want
          <br />
          to know?
        </h1>

        <p className="search-copy">Upload two images and see what's changed.</p>

        <div className="search-pill-wrap">
          <Cursor phase={phase} />

          <div className={`search-card ${attachmentsVisible ? "card-has-attachments" : ""} ${ready ? "card-ready" : ""}`}>
            <div className={`attachment-row ${attachmentsVisible ? "attachment-row-open" : ""}`}>
              <div
                className="attachment-thumb"
                style={{ backgroundImage: `url(${regionPrevious})` }}
              >
                <span className="attachment-name">previous_scan.tif</span>
                <span className="attachment-check">
                  <IconCheck />
                </span>
              </div>

              <div
                className="attachment-thumb"
                style={{ backgroundImage: `url(${regionCurrent})` }}
              >
                <span className="attachment-name">current_scan.tif</span>
                <span className="attachment-check">
                  <IconCheck />
                </span>
              </div>
            </div>

            <div className="search-pill">
              <div className="pill-plus">
                <IconPlus />
              </div>

              <div className="pill-text">
                {typing ? (
                  <>
                    {query}
                    <span className="pill-caret" />
                  </>
                ) : (
                  <span className="pill-placeholder">Ask anything</span>
                )}
              </div>

              <div className={`pill-action ${ready ? "action-ready" : ""}`}>
                {ready ? <IconArrowUp /> : <IconMic />}
              </div>
            </div>
          </div>

          <div className={`upload-dropdown ${menuStage ? "dropdown-open" : ""}`}>
            <div className="dropdown-face">
              <div className="dropdown-row">
                <IconUpload />
                <span>Upload files</span>
              </div>
              <div className="dropdown-row">
                <IconDrive />
                <span>Add from Drive</span>
              </div>
              <div className="dropdown-row dropdown-row-more">
                <IconMore />
                <span>More uploads</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPARISON CARDS

   The payoff: what the satellite found, shown as a centered
   before/after readout with the real region imagery and the
   key figures behind the detection, rather than a message.
========================================================= */

function ComparisonCards({ active }) {
  return (
    <div className={`comparison-cards ${active ? "cards-visible" : ""}`}>
      <div className="compare-header">
        <span className="compare-badge">Change detected</span>
        <h2 className="compare-title"></h2>
        <p className="compare-sub">Central India · 22.5°N, 79.0°E</p>
      </div>

      <div className="compare-row">
        <div className="compare-card">
          <div
            className="card-thumb"
            style={{ backgroundImage: `url(${regionPrevious})` }}
          />
          <div className="card-meta">
            <span className="card-label">Previous</span>
            <span className="card-sub">Jan 2024</span>
            <p className="card-desc">
              Dense, continuous vegetation cover with minimal built-up area
              or road infrastructure.
            </p>
          </div>
        </div>

        <div className="compare-card">
          <div
            className="card-thumb"
            style={{ backgroundImage: `url(${regionCurrent})` }}
          />
          <div className="card-meta">
            <span className="card-label">Current</span>
            <span className="card-sub">Sep 2026</span>
            <p className="card-desc">
              Visible clearing along the northern edge, with new access
              roads and scattered structures.
            </p>
          </div>
        </div>
      </div>

      <div className="compare-stats">
        <div className="stat">
          <span className="stat-value">-12.4%</span>
          <span className="stat-label">Vegetation cover</span>
        </div>
        <div className="stat">
          <span className="stat-value">4,280 km²</span>
          <span className="stat-label">Area affected</span>
        </div>
        <div className="stat">
          <span className="stat-value">94%</span>
          <span className="stat-label">Confidence</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN SPLASH
========================================================= */

export default function Splash({ onFinish }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), TIMELINE.MENU_OPEN),
      setTimeout(() => setPhase(2), TIMELINE.FILES_UPLOADED),
      setTimeout(() => setPhase(3), TIMELINE.TYPING_START),
      setTimeout(() => setPhase(4), TIMELINE.QUERY_READY),
      setTimeout(() => setPhase(5), TIMELINE.SPACE_REVEAL),
      setTimeout(() => setPhase(6), TIMELINE.SATELLITE_FOCUS),
      setTimeout(() => setPhase(7), TIMELINE.RAY_ACTIVE),
      setTimeout(() => setPhase(8), TIMELINE.CAMERA_ZOOM),
      setTimeout(() => setPhase(9), TIMELINE.DETECTION),
      setTimeout(() => {
        if (onFinish) onFinish();
      }, TIMELINE.FINISH),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className="splash">
      <SearchInterface phase={phase} />

      <div className={`space-scene ${phase >= 5 ? "space-enter" : ""}`}>
        <Canvas
          camera={{ position: [0, 0.2, 11], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#010508"]} />
          <Suspense fallback={null}>
            <World phase={phase} />
          </Suspense>
        </Canvas>
      </div>

      <ComparisonCards active={phase >= 9} />

      <button className="skip-button" onClick={onFinish}>
        Skip
      </button>
    </div>
  );
}

/* =========================================================
   PRELOAD
========================================================= */

useGLTF.preload("/models/earth.glb");
useGLTF.preload("/models/satellite.glb");