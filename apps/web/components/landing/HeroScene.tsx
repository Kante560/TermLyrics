"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Full-bleed waveform particle field: a grid of points displaced by
 * layered sine waves, tinted from deep green to the brand accent by
 * displacement height. Mouse moves the camera slightly; scroll fades
 * the whole scene out so it never fights the content below the fold.
 */
export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0a, 18, 46);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 5.2, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const COLS = 140;
    const ROWS = 60;
    const SPACING = 0.42;
    const count = COLS * ROWS;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color("#0d3320");
    const peakColor = new THREE.Color("#1db954");

    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        positions[i * 3] = (c - COLS / 2) * SPACING;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (r - ROWS / 2) * SPACING;
        i++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const scratch = new THREE.Color();

    function displace(t: number) {
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      const col = geometry.attributes.color as THREE.BufferAttribute;
      let idx = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = (c - COLS / 2) * SPACING;
          const z = (r - ROWS / 2) * SPACING;
          const y =
            Math.sin(x * 0.55 + t * 1.1) * 0.55 +
            Math.sin(z * 0.5 + t * 0.7) * 0.4 +
            Math.sin((x + z) * 0.28 + t * 1.6) * 0.3;
          pos.setY(idx, y);
          const h = THREE.MathUtils.clamp((y + 1.25) / 2.5, 0, 1);
          scratch.copy(baseColor).lerp(peakColor, h * h);
          col.setXYZ(idx, scratch.r, scratch.g, scratch.b);
          idx++;
        }
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }

    let raf = 0;
    const clock = new THREE.Clock();

    function frame() {
      const t = clock.getElapsedTime();
      displace(t);

      camera.position.x += (pointer.x * 1.6 - camera.position.x) * 0.04;
      camera.position.y += (5.2 - pointer.y * 1.2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      // Fade against scroll so the field dissolves as content arrives.
      const fade = 1 - Math.min(window.scrollY / (window.innerHeight * 0.9), 1);
      material.opacity = 0.9 * fade;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      displace(2.4);
      renderer.render(scene, camera);
    } else {
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
