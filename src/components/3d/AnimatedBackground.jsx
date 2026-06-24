import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useTheme } from '../../context/ThemeContext';

function Scene() {
  return (
    <Stars radius={50} depth={50} count={1000} factor={3} saturation={0} fade speed={1} />
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
        ? 'radial-gradient(ellipse at 50% 50%, #241802 0%, #0a0701 100%)'
        : 'radial-gradient(ellipse at 50% 50%, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)',
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
