import { useEffect, useRef } from "react";
import type * as THREE from "three";

type FormSaathiSceneProps = {
  label: string;
};

/**
 * A small procedural 3D document stack for FormSaathi's sign-in experience.
 * Three.js is dynamically imported so the WebGL scene does not block the
 * initial React render. Drag to rotate; pointer movement adds subtle parallax.
 */
export default function FormSaathiScene({ label }: FormSaathiSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let disposeScene: (() => void) | undefined;

    void import("three").then((THREE) => {
      if (cancelled || !hostRef.current) return;

      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
        camera.position.set(0, 0, 8.4);

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.18;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.className = "formsaathi-scene-canvas";
        host.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 2.15));
        const keyLight = new THREE.DirectionalLight(0xfff8e9, 3.1);
        keyLight.position.set(-3.5, 5, 6);
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x9dc5a5, 2.0);
        rimLight.position.set(4, -2, -3);
        scene.add(rimLight);

        const goldLight = new THREE.PointLight(0xd6b47c, 1.3, 8);
        goldLight.position.set(2.6, 1.7, 3.5);
        scene.add(goldLight);

        const rig = new THREE.Group();
        rig.position.set(0.78, -0.04, 0);
        rig.scale.setScalar(0.78);
        scene.add(rig);

        const paper = new THREE.MeshStandardMaterial({
          color: 0xf8f7ef,
          roughness: 0.93,
          metalness: 0,
        });
        const paperShade = new THREE.MeshStandardMaterial({
          color: 0xe4e9df,
          roughness: 0.95,
        });
        const folder = new THREE.MeshStandardMaterial({
          color: 0x52765d,
          roughness: 0.76,
        });
        const deepGreen = new THREE.MeshStandardMaterial({
          color: 0x315b46,
          roughness: 0.64,
        });
        const ink = new THREE.MeshStandardMaterial({
          color: 0xa9b6a8,
          roughness: 0.9,
        });
        const softInk = new THREE.MeshStandardMaterial({
          color: 0xd2d9cf,
          roughness: 0.92,
        });
        const gold = new THREE.MeshStandardMaterial({
          color: 0xc7a16c,
          roughness: 0.5,
          metalness: 0.16,
        });
        const white = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.7,
        });

        const addBox = (
          parent: THREE.Object3D,
          width: number,
          height: number,
          depth: number,
          material: THREE.Material,
          x: number,
          y: number,
          z: number,
        ) => {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            material,
          );
          mesh.position.set(x, y, z);
          parent.add(mesh);
          return mesh;
        };

        const addSphere = (
          parent: THREE.Object3D,
          radius: number,
          material: THREE.Material,
          x: number,
          y: number,
          z: number,
        ) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 28, 20),
            material,
          );
          mesh.position.set(x, y, z);
          parent.add(mesh);
          return mesh;
        };

        // Folder body and tab.
        addBox(rig, 3.02, 0.3, 0.48, folder, 0, -1.62, -0.12);
        addBox(rig, 0.92, 0.2, 0.44, folder, -0.92, -1.39, -0.13);
        addBox(rig, 2.88, 0.11, 0.42, deepGreen, 0, -1.45, 0.02);

        // Three sheets, offset just enough to show their depth.
        const sheets = [
          { x: -0.19, y: 0.01, z: -0.28, rz: 0.09, material: paperShade },
          { x: 0.03, y: 0.08, z: -0.08, rz: -0.048, material: paper },
          { x: 0.17, y: 0.12, z: 0.12, rz: -0.105, material: paper },
        ];

        sheets.forEach((sheet, index) => {
          const page = addBox(
            rig,
            2.62,
            3.28,
            0.08,
            sheet.material,
            sheet.x,
            sheet.y,
            sheet.z,
          );
          page.rotation.z = sheet.rz;
          if (index === 0) page.rotation.y = -0.04;
        });

        // Printed content on the front sheet.
        const details = new THREE.Group();
        details.position.set(0.17, 0.12, 0.17);
        details.rotation.z = -0.105;
        rig.add(details);

        addBox(details, 0.92, 0.09, 0.025, deepGreen, -0.48, 1.16, 0.03);
        addBox(details, 0.48, 0.045, 0.025, gold, 0.53, 1.16, 0.03);
        addBox(details, 1.72, 0.035, 0.02, ink, -0.03, 0.76, 0.03);
        addBox(details, 1.48, 0.035, 0.02, softInk, -0.15, 0.49, 0.03);
        addBox(details, 1.69, 0.035, 0.02, softInk, -0.045, 0.21, 0.03);
        addBox(details, 1.22, 0.035, 0.02, softInk, -0.28, -0.07, 0.03);
        addBox(details, 1.68, 0.035, 0.02, softInk, -0.05, -0.35, 0.03);
        addBox(details, 0.94, 0.035, 0.02, softInk, -0.42, -0.63, 0.03);

        // A verified mark: a soft green seal and a simple raised check.
        const seal = new THREE.Mesh(
          new THREE.TorusGeometry(0.205, 0.025, 10, 56),
          gold,
        );
        seal.position.set(0.78, -1.07, 0.06);
        details.add(seal);
        addBox(details, 0.2, 0.045, 0.025, deepGreen, 0.73, -1.06, 0.1).rotation.z = -0.72;
        addBox(details, 0.12, 0.045, 0.025, deepGreen, 0.86, -1.015, 0.1).rotation.z = 0.78;

        // A small identity card floats beside the paper stack.
        const card = new THREE.Group();
        card.position.set(-1.56, 0.62, 0.52);
        card.rotation.z = 0.13;
        rig.add(card);
        addBox(card, 0.92, 0.68, 0.08, paper, 0, 0, 0);
        addSphere(card, 0.13, folder, -0.25, 0.13, 0.06);
        addBox(card, 0.34, 0.035, 0.025, ink, 0.2, 0.17, 0.06);
        addBox(card, 0.43, 0.03, 0.025, softInk, 0.15, 0.04, 0.06);
        addBox(card, 0.55, 0.03, 0.025, softInk, 0.08, -0.1, 0.06);

        // Orbit line, quiet floating markers and distant particles.
        const orbit = new THREE.Mesh(
          new THREE.TorusGeometry(2.12, 0.012, 8, 160),
          new THREE.MeshBasicMaterial({
            color: 0xb6c9b5,
            transparent: true,
            opacity: 0.58,
          }),
        );
        orbit.position.set(0.06, 0.06, -0.23);
        orbit.rotation.set(0.91, 0.14, -0.28);
        rig.add(orbit);

        const orbitSecond = new THREE.Mesh(
          new THREE.TorusGeometry(2.3, 0.006, 8, 160),
          new THREE.MeshBasicMaterial({
            color: 0xd0b786,
            transparent: true,
            opacity: 0.38,
          }),
        );
        orbitSecond.rotation.set(1.18, -0.4, 0.62);
        rig.add(orbitSecond);

        const accents = new THREE.Group();
        rig.add(accents);
        const goldDot = addSphere(accents, 0.105, gold, 1.72, 0.82, 0.24);
        const greenDot = addSphere(accents, 0.075, folder, -1.78, -0.78, 0.14);
        addSphere(accents, 0.045, gold, -1.62, 1.38, -0.1);
        addSphere(accents, 0.055, deepGreen, 1.48, -1.32, -0.12);

        const particleCount = 210;
        const particlePositions = new Float32Array(particleCount * 3);
        for (let index = 0; index < particleCount; index += 1) {
          const radius = 2.5 + Math.random() * 1.7;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          particlePositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
          particlePositions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          particlePositions[index * 3 + 2] = radius * Math.cos(phi);
        }
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(particlePositions, 3),
        );
        const particles = new THREE.Points(
          particleGeometry,
          new THREE.PointsMaterial({
            color: 0xe0e8d8,
            size: 0.018,
            transparent: true,
            opacity: 0.52,
            sizeAttenuation: true,
            depthWrite: false,
          }),
        );
        scene.add(particles);

        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        let frame = 0;
        let pointerDown = false;
        let previousX = 0;
        let previousY = 0;
        let pointerX = 0;
        let pointerY = 0;
        let targetRotationX = -0.045;
        let targetRotationY = 0.08;

        const render = () => renderer.render(scene, camera);

        const resize = () => {
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          camera.aspect = width / height;
          camera.position.z = width < 540 ? 9.25 : 8.4;
          camera.updateProjectionMatrix();
          rig.position.x = width < 540 ? 0.45 : 0.78;
          renderer.setSize(width, height, false);
          render();
        };

        const onPointerDown = (event: PointerEvent) => {
          pointerDown = true;
          previousX = event.clientX;
          previousY = event.clientY;
          host.classList.add("is-dragging");
          host.setPointerCapture(event.pointerId);
        };

        const onPointerMove = (event: PointerEvent) => {
          const bounds = host.getBoundingClientRect();
          pointerX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
          pointerY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * -2;

          if (pointerDown) {
            targetRotationY += (event.clientX - previousX) * 0.006;
            targetRotationX += (event.clientY - previousY) * 0.004;
            previousX = event.clientX;
            previousY = event.clientY;
          }

          if (reducedMotion) {
            rig.rotation.x = targetRotationX + pointerY * 0.08;
            rig.rotation.y = targetRotationY + pointerX * 0.1;
            render();
          }
        };

        const onPointerUp = (event: PointerEvent) => {
          pointerDown = false;
          host.classList.remove("is-dragging");
          if (host.hasPointerCapture(event.pointerId)) {
            host.releasePointerCapture(event.pointerId);
          }
        };

        const onPointerLeave = () => {
          if (!pointerDown) {
            pointerX = 0;
            pointerY = 0;
          }
        };

        host.addEventListener("pointerdown", onPointerDown);
        host.addEventListener("pointermove", onPointerMove);
        host.addEventListener("pointerup", onPointerUp);
        host.addEventListener("pointercancel", onPointerUp);
        host.addEventListener("pointerleave", onPointerLeave);

        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        const animate = (time: number) => {
          if (!reducedMotion) {
            targetRotationY += 0.00055;
            rig.rotation.x += (targetRotationX + pointerY * 0.09 - rig.rotation.x) * 0.035;
            rig.rotation.y += (targetRotationY + pointerX * 0.12 - rig.rotation.y) * 0.035;
            rig.position.y = -0.04 + Math.sin(time * 0.00065) * 0.065;
            orbit.rotation.z = -0.28 + Math.sin(time * 0.00024) * 0.07;
            orbitSecond.rotation.y += 0.00022;
            accents.rotation.y = Math.sin(time * 0.00032) * 0.12;
            goldDot.position.y = 0.82 + Math.sin(time * 0.0011) * 0.09;
            greenDot.position.x = -1.78 + Math.cos(time * 0.0008) * 0.05;
            particles.rotation.y -= 0.00012;
          }
          render();
          if (!reducedMotion) frame = window.requestAnimationFrame(animate);
        };

        if (reducedMotion) render();
        else frame = window.requestAnimationFrame(animate);

        disposeScene = () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          host.removeEventListener("pointerdown", onPointerDown);
          host.removeEventListener("pointermove", onPointerMove);
          host.removeEventListener("pointerup", onPointerUp);
          host.removeEventListener("pointercancel", onPointerUp);
          host.removeEventListener("pointerleave", onPointerLeave);
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
              object.geometry.dispose();
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              materials.forEach((material) => material.dispose());
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (error) {
        console.warn("FormSaathi 3D scene could not start.", error);
        host.dataset.sceneFallback = "true";
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.warn("Three.js could not be loaded for the FormSaathi scene.", error);
        host.dataset.sceneFallback = "true";
      }
    });

    return () => {
      cancelled = true;
      disposeScene?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="formsaathi-scene"
      role="img"
      aria-label={label}
    />
  );
}
