import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface ParticleEffectProps {
  trigger: boolean;
  position: { x: number; y: number };
  particleCount?: number;
  colors?: string[];
  type?: 'flip' | 'reveal' | 'war';
}

export default function ParticleEffect({
  trigger,
  position,
  particleCount = 12,
  colors = ['#8B5CF6', '#F59E0B', '#A78BFA', '#FCD34D'],
  type = 'flip',
}: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const newParticles: Particle[] = Array.from({ length: particleCount }).map((_, i) => {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = type === 'war' ? 4 : type === 'reveal' ? 3 : 2;
      return {
        id: i,
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.1, // gravity
            life: p.life - 0.05,
          }))
          .filter((p) => p.life > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [trigger, position, particleCount, colors, type]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: particle.x,
            top: particle.y,
            background: particle.color,
            boxShadow: `0 0 ${8 * particle.life}px ${particle.color}`,
            opacity: particle.life,
          }}
          animate={{
            scale: [1, 0],
            opacity: [particle.life, 0],
          }}
          transition={{ duration: 0.8 }}
        />
      ))}
    </div>
  );
}

/**
 * Glow Effect Component for card reveals
 */
export function GlowEffect({
  trigger,
  position,
  duration = 0.6,
  color = '#8B5CF6',
}: {
  trigger: boolean;
  position: { x: number; y: number };
  duration?: number;
  color?: string;
}) {
  if (!trigger) return null;

  return (
    <motion.div
      className="fixed pointer-events-none z-40"
      style={{
        left: position.x - 60,
        top: position.y - 60,
        width: 120,
        height: 120,
      }}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 2, opacity: 0 }}
      transition={{ duration }}
      onAnimationComplete={() => {
        // Animation complete
      }}
    >
      <div
        className="w-full h-full rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}, transparent)`,
          filter: 'blur(20px)',
        }}
      />
    </motion.div>
  );
}

/**
 * Sound Effect Player
 */
export function playSound(soundPath: string, volume: number = 0.5) {
  try {
    const audio = new Audio(soundPath);
    audio.volume = volume;
    audio.play().catch(() => {
      // Silently fail if audio can't play
    });
  } catch {
    // Silently fail
  }
}
