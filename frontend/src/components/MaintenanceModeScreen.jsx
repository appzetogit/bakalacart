import { useEffect, useState, useCallback } from "react";

const RECHECK_SECONDS = 30;

export default function MaintenanceModeScreen() {
  const [countdown, setCountdown] = useState(RECHECK_SECONDS);
  const [isChecking, setIsChecking] = useState(false);
  const [dots, setDots] = useState(".");

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  // Countdown timer — hits 0, reloads page to re-check
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.location.reload();
          return RECHECK_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(t);
  }, []);

  const handleRetry = useCallback(() => {
    setIsChecking(true);
    setTimeout(() => window.location.reload(), 400);
  }, []);

  // Progress percentage for ring
  const pct = ((RECHECK_SECONDS - countdown) / RECHECK_SECONDS) * 100;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Animated blobs */}
      <div style={{
        position: "absolute", top: "-15%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
        animation: "blobFloat 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 70%)",
        animation: "blobFloat 10s ease-in-out infinite reverse",
      }} />
      <div style={{
        position: "absolute", top: "40%", right: "5%",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)",
        animation: "blobFloat 12s ease-in-out infinite 2s",
      }} />

      {/* Dotted grid overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 28,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        padding: "48px 40px",
        maxWidth: 440, width: "90%",
        textAlign: "center",
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6)",
      }}>

        {/* Animated tool icon */}
        <div style={{
          width: 100, height: 100, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          boxShadow: "0 0 0 12px rgba(99,102,241,0.15), 0 0 0 24px rgba(99,102,241,0.07)",
          animation: "iconPulse 3s ease-in-out infinite",
        }}>
          {/* Wrench SVG */}
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        {/* Brand */}
        <div style={{
          fontSize: 13, fontWeight: 700, letterSpacing: "0.18em",
          color: "rgba(165,180,252,0.8)", marginBottom: 10, textTransform: "uppercase",
        }}>
          Bakalaa
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: "#fff",
          margin: "0 0 12px", lineHeight: 1.2,
        }}>
          We'll be back soon!
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: 15, color: "rgba(203,213,225,0.8)",
          lineHeight: 1.65, margin: "0 auto 32px", maxWidth: 320,
        }}>
          We're currently performing scheduled maintenance to improve your experience{dots}
        </p>

        {/* Divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
          marginBottom: 32,
        }} />

        {/* Auto-retry countdown ring */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 28 }}>
          <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: "rotate(-90deg)" }}>
              {/* Background circle */}
              <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              {/* Progress circle */}
              <circle
                cx="24" cy="24" r={r}
                fill="none"
                stroke="url(#countGrad)"
                strokeWidth="3"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.9s linear" }}
              />
              <defs>
                <linearGradient id="countGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <span style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
            }}>
              {countdown}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(148,163,184,0.85)", textAlign: "left" }}>
            Auto-checking in <strong style={{ color: "#a5b4fc" }}>{countdown}s</strong><br />
            <span style={{ fontSize: 12, opacity: 0.7 }}>Page will reload automatically</span>
          </p>
        </div>

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 14,
            border: "none",
            cursor: isChecking ? "not-allowed" : "pointer",
            background: isChecking
              ? "rgba(99,102,241,0.3)"
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.02em",
            transition: "all 0.2s ease",
            transform: isChecking ? "scale(0.98)" : "scale(1)",
            boxShadow: isChecking ? "none" : "0 4px 20px rgba(99,102,241,0.4)",
          }}
        >
          {isChecking ? "Checking status…" : "🔄 Check Now"}
        </button>

        {/* Footer note */}
        <p style={{
          marginTop: 20, fontSize: 12,
          color: "rgba(148,163,184,0.55)", lineHeight: 1.6,
        }}>
          If this persists, please contact support.
        </p>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes blobFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 0 0 12px rgba(99,102,241,0.15), 0 0 0 24px rgba(99,102,241,0.07); }
          50%       { box-shadow: 0 0 0 16px rgba(99,102,241,0.22), 0 0 0 32px rgba(99,102,241,0.09); }
        }
      `}</style>
    </div>
  );
}
