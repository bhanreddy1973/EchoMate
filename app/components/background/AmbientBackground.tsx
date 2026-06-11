"use client";

import { useRef, useEffect } from "react";
import { useEmotion } from "@/context/EmotionContext";

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  opacity: number;
  opacityDir: number;
}

export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const { accentColor } = useEmotion();

  /* Particle canvas */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    /* Seed particles */
    particlesRef.current = Array.from({ length: 55 }, () => ({
      x:          Math.random() * window.innerWidth,
      y:          Math.random() * window.innerHeight,
      r:          0.8 + Math.random() * 1.8,
      vx:         (Math.random() - 0.5) * 0.18,
      vy:         -0.08 - Math.random() * 0.14,
      opacity:    0.15 + Math.random() * 0.5,
      opacityDir: Math.random() > 0.5 ? 1 : -1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += p.opacityDir * 0.003;
        if (p.opacity >= 0.7 || p.opacity <= 0.08) p.opacityDir *= -1;

        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.55})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>

      {/* Deep void base */}
      <div className="absolute inset-0 bg-void" />

      {/* SVG noise texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Ambient gradient blobs */}
      <div
        className="absolute rounded-full"
        style={{
          width: 700, height: 500,
          top: "18%", left: "50%",
          background: `radial-gradient(ellipse at center, ${accentColor}22 0%, transparent 70%)`,
          filter: "blur(80px)",
          transform: "translate(-58%, -50%)",
          animation: "blob-drift-a 26s ease-in-out infinite",
          transition: "background 1.4s ease",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 600, height: 420,
          top: "38%", left: "50%",
          background: `radial-gradient(ellipse at center, ${accentColor}16 0%, transparent 70%)`,
          filter: "blur(80px)",
          transform: "translate(-42%, -50%)",
          animation: "blob-drift-b 34s ease-in-out infinite",
          transition: "background 1.4s ease",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 400, height: 280,
          bottom: "14%", left: "50%",
          background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: "translateX(-50%)",
          animation: "blob-drift-c 20s ease-in-out infinite",
        }}
      />

      {/* Subtle top vignette */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: "linear-gradient(to bottom, rgba(4,4,10,0.8) 0%, transparent 100%)" }}
      />
      {/* Bottom vignette */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{ background: "linear-gradient(to top, rgba(4,4,10,0.7) 0%, transparent 100%)" }}
      />

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.7 }} />
    </div>
  );
}
