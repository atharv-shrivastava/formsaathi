import { useEffect, useRef } from "react";

interface PaperSceneProps {
  className?: string;
  label: string;
}

export default function PaperScene({ className = "", label }: PaperSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let disposeScene: (() => void) | undefined;

    void import("three").then((THREE) => {
      if (cancelled || !hostRef.current) return;

      const host = hostRef.current;
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
        camera.position.set(0, 0, 8.8);

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power"
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute("aria-hidden", "true");
        host.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 2.1));
        const keyLight = new THREE.DirectionalLight(0xfff8e9, 3.2);
        keyLight.position.set(-3.5, 5, 6);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x9dbda5, 1.7);
        rimLight.position.set(4, -2, -3);
        scene.add(rimLight);

        const rig = new THREE.Group();
        scene.add(rig);

        const paperMaterial = new THREE.MeshStandardMaterial({
          color: 0xfaf9f3,
          roughness: 0.92,
          metalness: 0
        });
        const backPaperMaterial = new THREE.MeshStandardMaterial({
          color: 0xe5e9df,
          roughness: 0.95
        });
        const folderMaterial = new THREE.MeshStandardMaterial({
          color: 0x315b46,
          roughness: 0.76
        });
        const inkMaterial = new THREE.MeshStandardMaterial({
          color: 0x718174,
          roughness: 0.9
        });
        const softInkMaterial = new THREE.MeshStandardMaterial({
          color: 0xd5ddd1,
          roughness: 0.9
        });
        const goldMaterial = new THREE.MeshStandardMaterial({
          color: 0xc49a62,
          roughness: 0.52,
          metalness: 0.16
        });
        const greenMaterial = new THREE.MeshStandardMaterial({
          color: 0x6f9476,
          roughness: 0.56,
          metalness: 0.08
        });

        const addBox = (
          parent: THREE.Object3D,
          width: number,
          height: number,
          depth: number,
          material: THREE.Material,
          x: number,
          y: number,
          z: number
        ) => {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
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
          z: number
        ) => {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), material);
          mesh.position.set(x, y, z);
          parent.add(mesh);
          return mesh;
        };

        // A quiet folio supports three offset sheets, giving the stack real depth.
        addBox(rig, 3.08, 0.28, 0.42, folderMaterial, 0.04, -1.72, -0.04);
        addBox(rig, 2.94, 0.16, 0.34, backPaperMaterial, -0.02, -1.55, 0.02);

        const sheets = [
          { x: -0.18, y: 0.02, z: -0.22, rz: 0.105, material: backPaperMaterial },
          { x: 0.04, y: 0.08, z: -0.06, rz: -0.055, material: paperMaterial },
          { x: 0.18, y: 0.12, z: 0.12, rz: -0.115, material: paperMaterial }
        ];
        sheets.forEach((sheet, index) => {
          const page = addBox(rig, 2.72, 3.42, 0.085, sheet.material, sheet.x, sheet.y, sheet.z);
          page.rotation.z = sheet.rz;
          if (index === 0) page.rotation.y = -0.035;
        });

        const details = new THREE.Group();
        details.position.set(0.18, 0.12, 0.19);
        details.rotation.z = -0.115;
        rig.add(details);

        addBox(details, 0.92, 0.085, 0.018, folderMaterial, -0.54, 1.14, 0.03);
        addBox(details, 0.42, 0.045, 0.018, goldMaterial, 0.48, 1.14, 0.03);
        addBox(details, 1.66, 0.035, 0.018, softInkMaterial, -0.08, 0.76, 0.03);
        addBox(details, 1.42, 0.035, 0.018, softInkMaterial, -0.2, 0.48, 0.03);
        addBox(details, 1.68, 0.035, 0.018, softInkMaterial, -0.07, 0.20, 0.03);
        addBox(details, 1.2, 0.035, 0.018, softInkMaterial, -0.31, -0.08, 0.03);
        addBox(details, 1.66, 0.035, 0.018, softInkMaterial, -0.08, -0.36, 0.03);
        addBox(details, 0.72, 0.035, 0.018, softInkMaterial, -0.55, -0.64, 0.03);

        // A compact verification stamp on the page.
        addBox(details, 0.43, 0.43, 0.055, greenMaterial, 0.79, -1.04, 0.055);
        addBox(details, 0.22, 0.045, 0.018, 0xffffff === 0 ? paperMaterial : new THREE.MeshStandardMaterial({ color: 0xffffff }), 0.76, -1.06, 0.095).rotation.z = -0.72;
        addBox(details, 0.13, 0.045, 0.018, new THREE.MeshStandardMaterial({ color: 0xffffff }), 0.88, -1.01, 0.095).rotation.z = 0.82;

        const orbit = new THREE.Mesh(
          new THREE.TorusGeometry(2.02, 0.012, 8, 100),
          new THREE.MeshStandardMaterial({ color: 0x94ad98, transparent: true, opacity: 0.6, roughness: 0.8 })
        );
        orbit.position.set(0.12, 0.05, -0.18);
        orbit.rotation.set(0.92, 0.16, -0.28);
        rig.add(orbit);

        const accents = new THREE.Group();
        rig.add(accents);
        const goldDot = addSphere(accents, 0.105, goldMaterial, 1.72, 0.7, 0.22);
        const greenDot = addSphere(accents, 0.075, greenMaterial, -1.72, -0.72, 0.1);
        addSphere(accents, 0.045, goldMaterial, -1.55, 1.3, -0.12);
        addSphere(accents, 0.055, greenMaterial, 1.46, -1.32, -0.12);

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let frame = 0;
        let targetX = 0;
        let targetY = 0;
        const onPointerMove = (event: PointerEvent) => {
          const rect = host.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.18;
          targetX = ((event.clientY - rect.top) / rect.height - 0.5) * 0.1;
        };
        const onPointerLeave = () => {
          targetX = 0;
          targetY = 0;
        };
        host.addEventListener("pointermove", onPointerMove, { passive: true });
        host.addEventListener("pointerleave", onPointerLeave);

        const resize = () => {
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          renderer.render(scene, camera);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        const animate = (time: number) => {
          rig.rotation.x += ((-0.045 + Math.sin(time * 0.00042) * 0.035 + targetX) - rig.rotation.x) * 0.035;
          rig.rotation.y += ((Math.sin(time * 0.00031) * 0.09 + targetY) - rig.rotation.y) * 0.035;
          rig.position.y = Math.sin(time * 0.0007) * 0.055;
          accents.rotation.y = Math.sin(time * 0.00035) * 0.12;
          goldDot.position.y = 0.7 + Math.sin(time * 0.0011) * 0.09;
          greenDot.position.x = -1.72 + Math.cos(time * 0.0008) * 0.05;
          renderer.render(scene, camera);
          if (!reducedMotion) frame = window.requestAnimationFrame(animate);
        };

        if (reducedMotion) {
          renderer.render(scene, camera);
        } else {
          frame = window.requestAnimationFrame(animate);
        }

        disposeScene = () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          host.removeEventListener("pointermove", onPointerMove);
          host.removeEventListener("pointerleave", onPointerLeave);
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => material.dispose());
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        host.dataset.sceneFallback = "true";
      }
    }).catch(() => {
      if (hostRef.current) hostRef.current.dataset.sceneFallback = "true";
    });

    return () => {
      cancelled = true;
      disposeScene?.();
    };
  }, []);

  return <div ref={hostRef} className={"paper-scene " + className} role="img" aria-label={label} />;
}
