import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '../../context/ThemeContext';

function FloatingShape({ geometry, position, color, speed = 1, rotationAxis = [0.01, 0.01, 0] }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += rotationAxis[0] * speed;
      meshRef.current.rotation.y += rotationAxis[1] * speed;
      meshRef.current.rotation.z += rotationAxis[2] * speed;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed * 0.5) * 0.003;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position}>
        {geometry}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.6}
          roughness={0.2}
          metalness={0.8}
          wireframe={false}
        />
      </mesh>
    </Float>
  );
}

function ParticleField({ count = 200, theme }) {
  const points = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return positions;
  }, [count]);

  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={theme === 'dark' ? '#818cf8' : '#667eea'}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function Scene() {
  const { theme } = useTheme();

  const colors = useMemo(() => ({
    shape1: theme === 'dark' ? '#818cf8' : '#667eea',
    shape2: theme === 'dark' ? '#a78bfa' : '#764ba2',
    shape3: theme === 'dark' ? '#c084fc' : '#f093fb',
    shape4: theme === 'dark' ? '#67e8f9' : '#06b6d4',
  }), [theme]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.4} color={colors.shape1} />

      <FloatingShape
        geometry={<icosahedronGeometry args={[1, 0]} />}
        position={[-3, 2, -5]}
        color={colors.shape1}
        speed={0.8}
        rotationAxis={[0.005, 0.008, 0.003]}
      />
      <FloatingShape
        geometry={<torusKnotGeometry args={[0.6, 0.2, 100, 16]} />}
        position={[3.5, -1.5, -4]}
        color={colors.shape2}
        speed={0.6}
        rotationAxis={[0.008, 0.005, 0.002]}
      />
      <FloatingShape
        geometry={<octahedronGeometry args={[0.8, 0]} />}
        position={[-2, -2.5, -3]}
        color={colors.shape3}
        speed={1}
        rotationAxis={[0.006, 0.01, 0.004]}
      />
      <FloatingShape
        geometry={<dodecahedronGeometry args={[0.7, 0]} />}
        position={[4, 2.5, -6]}
        color={colors.shape4}
        speed={0.7}
        rotationAxis={[0.007, 0.006, 0.005]}
      />
      <FloatingShape
        geometry={<torusGeometry args={[0.5, 0.2, 16, 32]} />}
        position={[0, 3, -5]}
        color={colors.shape2}
        speed={0.9}
        rotationAxis={[0.004, 0.007, 0.006]}
      />

      <ParticleField count={300} theme={theme} />
      <Stars radius={50} depth={50} count={1000} factor={3} saturation={0} fade speed={1} />
    </>
  );
}

export default function AnimatedBackground() {
  const { theme } = useTheme();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      background: theme === 'dark'
        ? 'radial-gradient(ellipse at 50% 50%, #0f0f2e 0%, #050510 100%)'
        : 'radial-gradient(ellipse at 50% 50%, #fafafc 0%, #d8dbe9 100%)',
    }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
