// Clean matte Fabry-Pérot cavity-QED schematic (React-Three-Fiber).
// Grounded pixel-for-pixel in real Nature/APS figures (arXiv:2502.19833 — hourglass mode + blue
// atom + white bg; arXiv:2407.04784 — standing wave as stacked salmon antinode shells). The whole
// point is the matte scientific look: meshStandardMaterial metalness 0, white background, N8AO for
// depth — NO bloom, NO neon, NO clearcoat/envMap reflections, NO auto-rotate.
import { OrbitControls, PerspectiveCamera, ContactShadows, SoftShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import { useMemo } from "react";

const GAP = 6;
const HALF = GAP / 2;

/** Standing wave: ~19 flattened salmon antinode shells along the cavity axis (x), thin along x and
 *  wide transversely, modulated by the Gaussian waist envelope. Brightness rises with coupling g. */
function StandingWave({ g }: { g: number }) {
  const nodes = useMemo(() => {
    const N = 19, xR = 2.6, w0 = 0.32;
    const out: { x: number; w: number; op: number }[] = [];
    for (let i = 0; i < N; i++) {
      const x = -HALF + (GAP * (i + 0.5)) / N;
      const w = w0 * Math.sqrt(1 + (x / xR) ** 2); // transverse waist envelope (pinched at mirrors)
      const env = Math.exp(-(x * x) / (2 * 2.3 * 2.3)); // axial Gaussian (brightest at the waist)
      const op = Math.min(0.5, (0.1 + 0.34 * (0.35 + 0.65 * Math.min(Math.max(g, 0), 5) / 5)) * env);
      out.push({ x, w, op });
    }
    return out;
  }, [g]);
  return (
    <>
      {nodes.map((n, i) => (
        <mesh key={i} position={[n.x, 0, 0]} scale={[0.12, n.w, n.w]}>
          <sphereGeometry args={[1, 22, 16]} />
          <meshStandardMaterial color="#ff7d8a" roughness={0.6} metalness={0} transparent opacity={n.op} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** One mirror: matte slate-blue cylinder substrate + pale-blue inner face + thin cyan coating rim. */
function Mirror({ side }: { side: 1 | -1 }) {
  const xInner = side * HALF;
  const xBody = side * (HALF + 0.6);
  return (
    <group>
      <mesh position={[xBody, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[4.5, 4.5, 1.2, 64]} />
        <meshStandardMaterial color="#42536d" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[xInner, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[4.45, 64]} />
        <meshStandardMaterial color="#b4c4dc" roughness={0.5} metalness={0.1} side={2} />
      </mesh>
      <mesh position={[xInner, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[4.45, 0.06, 12, 90]} />
        <meshStandardMaterial color="#04c6df" roughness={0.4} metalness={0} />
      </mesh>
    </group>
  );
}

export function CavityScene({ g }: { g: number }) {
  return (
    <Canvas flat shadows dpr={[1, 2]} gl={{ antialias: true }} style={{ background: "#f5f5f3" }}>
      <PerspectiveCamera makeDefault fov={30} position={[13, 5.5, 17]} />
      <hemisphereLight args={["#ffffff", "#d6d8d8", 0.7]} />
      <ambientLight intensity={0.2} />
      <directionalLight castShadow intensity={1.4} position={[6, 9, 6]} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <SoftShadows size={26} samples={16} focus={0} />

      <Mirror side={-1} />
      <Mirror side={1} />
      <StandingWave g={g} />
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.45, 32, 24]} />
        <meshStandardMaterial color="#3d59a7" roughness={0.85} metalness={0} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.2, 0]} receiveShadow>
        <planeGeometry args={[48, 48]} />
        <meshStandardMaterial color="#f5f5f3" roughness={1} />
      </mesh>
      <ContactShadows position={[0, -4.18, 0]} opacity={0.5} scale={22} blur={2.4} far={9} resolution={512} color="#1c1c1c" frames={1} />

      <EffectComposer>
        <N8AO aoRadius={0.7} distanceFalloff={1} intensity={2.2} quality="high" color="black" />
      </EffectComposer>
      <OrbitControls makeDefault autoRotate={false} enablePan={false} minDistance={6} maxDistance={45} target={[0, 0, 0]} />
    </Canvas>
  );
}
