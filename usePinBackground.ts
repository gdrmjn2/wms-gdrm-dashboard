/**
 * usePinBackground.ts
 * Jalankan animasi partikel + glow di canvas saat PIN screen terbuka.
 * Import dan panggil di dalam PinScreen component.
 *
 * Cara pakai:
 *   import { usePinBackground } from "@/hooks/usePinBackground";
 *   usePinBackground("bg-canvas");
 */

import { useEffect } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  a: number;
}

export function usePinBackground(canvasId: string) {
  useEffect(() => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const particles: Particle[] = [];

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    /* Create particles */
    for (let i = 0; i < 70; i++) {
      particles.push({
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        r:  Math.random() * 1.8 + 0.4,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        a:  Math.random() * 0.5 + 0.15,
      });
    }

    function draw() {
      const W = canvas!.width;
      const H = canvas!.height;

      ctx!.clearRect(0, 0, W, H);

      /* Solid background */
      ctx!.fillStyle = "#05080f";
      ctx!.fillRect(0, 0, W, H);

      /* Blue glow — top-left */
      const g1 = ctx!.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, W * 0.42);
      g1.addColorStop(0, "rgba(37,99,235,0.09)");
      g1.addColorStop(1, "transparent");
      ctx!.fillStyle = g1;
      ctx!.fillRect(0, 0, W, H);

      /* Gold glow — bottom-right */
      const g2 = ctx!.createRadialGradient(W * 0.8, H * 0.72, 0, W * 0.8, H * 0.72, W * 0.38);
      g2.addColorStop(0, "rgba(240,180,41,0.07)");
      g2.addColorStop(1, "transparent");
      ctx!.fillStyle = g2;
      ctx!.fillRect(0, 0, W, H);

      /* Move & draw particles */
      particles.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > W) p.dx *= -1;
        if (p.y < 0 || p.y > H) p.dy *= -1;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(120,150,255,${p.a})`;
        ctx!.fill();
      });

      /* Draw connections */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(80,120,220,${0.18 * (1 - dist / 100)})`;
            ctx!.lineWidth   = 0.6;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasId]);
}
