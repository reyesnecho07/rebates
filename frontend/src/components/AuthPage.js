// AuthPage.js — DB-synced theme toggle + persistent theme across logout + enhanced UI
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Eye, EyeOff, User, Lock, X, KeyRound,
  AlertCircle, CheckCircle, Shield, ArrowRight,
  Sun, Moon, Loader2,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import Rebate from "../assets/Rebate.png";

const API_BASE = "http://192.168.100.193:3009/api";
const DB_NAME  = "USER";

/* ── Injected keyframes ────────────────────────────────────────────────────── */
const bgStyles = `
  @keyframes spinRing   { from{transform:rotate(0deg)}  to{transform:rotate(360deg)} }
  @keyframes spinRingRv { from{transform:rotate(360deg)} to{transform:rotate(0deg)}  }
  @keyframes floatA { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-22px) rotate(8deg)} }
  @keyframes floatB { 0%,100%{transform:translateY(0) rotate(45deg)} 50%{transform:translateY(18px) rotate(52deg)} }
  @keyframes pulseFade { 0%,100%{opacity:.06} 50%{opacity:.14} }
  @keyframes dashScroll { to{stroke-dashoffset:-40} }
`;

/* ── Animated canvas: constellation particle network ───────────────────────── */
function ParticleCanvas({ isDark }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx   = canvas.getContext("2d");
    const COUNT = 62;
    const REACH = 145;
    const dotRgb  = isDark ? "96,165,250" : "59,130,246";
    const lineRgb = isDark ? "99,102,241" : "99,102,241";
    const SHAPES  = ["circle","circle","circle","circle","square","triangle"];

    const particles = Array.from({ length: COUNT }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      vx:    (Math.random() - 0.5) * 0.38,
      vy:    (Math.random() - 0.5) * 0.38,
      r:     Math.random() * 1.8 + 0.8,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      spin:  (Math.random() - 0.5) * 0.012,
      angle: Math.random() * Math.PI * 2,
    }));

    let running = true;
    function draw() {
      if (!running) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.angle += p.spin;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W+10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H+10) p.y = -10;
      });

      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < REACH) {
            const a = (1 - d/REACH) * (isDark ? 0.18 : 0.12);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${lineRgb},${a})`;
            ctx.lineWidth   = 0.55;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        ctx.fillStyle = `rgba(${dotRgb},${isDark ? 0.40 : 0.28})`;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.shape === "square") {
          ctx.rotate(p.angle);
          const s = p.r * 2.2;
          ctx.fillRect(-s, -s, s*2, s*2);
        } else if (p.shape === "triangle") {
          ctx.rotate(p.angle);
          const h = p.r * 2.8;
          ctx.beginPath();
          ctx.moveTo(0, -h);
          ctx.lineTo(h*0.86, h*0.5);
          ctx.lineTo(-h*0.86, h*0.5);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ── SVG ornamental overlay ─────────────────────────────────────────────────── */
function OrnamentalLayer({ isDark }) {
  const s  = isDark ? "rgba(96,165,250,"  : "rgba(59,130,246,";
  const s2 = isDark ? "rgba(99,102,241,"  : "rgba(79,70,229,";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">

      {/* Large rotating dashed ring — top-left */}
      <div style={{ position:"absolute", top:"-160px", left:"-160px",
        width:"520px", height:"520px", animation:"spinRing 55s linear infinite" }}>
        <svg width="520" height="520" viewBox="0 0 520 520">
          <circle cx="260" cy="260" r="230"
            stroke={`${s}0.10)`} strokeWidth="1" fill="none" strokeDasharray="10 18" />
          <circle cx="260" cy="260" r="190"
            stroke={`${s2}0.07)`} strokeWidth="0.7" fill="none" strokeDasharray="4 22" />
        </svg>
      </div>

      {/* Counter-rotating ring — bottom-right */}
      <div style={{ position:"absolute", bottom:"-150px", right:"-150px",
        width:"540px", height:"540px", animation:"spinRingRv 70s linear infinite" }}>
        <svg width="540" height="540" viewBox="0 0 540 540">
          <circle cx="270" cy="270" r="240"
            stroke={`${s2}0.09)`} strokeWidth="1" fill="none" strokeDasharray="8 20" />
          <circle cx="270" cy="270" r="195"
            stroke={`${s}0.06)`} strokeWidth="0.7" fill="none" strokeDasharray="3 26" />
        </svg>
      </div>

      {/* Pulsing center halo */}
      <div style={{ position:"absolute", top:"50%", left:"50%",
        width:"700px", height:"700px", transform:"translate(-50%,-50%)",
        animation:"pulseFade 7s ease-in-out infinite" }}>
        <svg width="700" height="700" viewBox="0 0 700 700">
          <circle cx="350" cy="350" r="320"
            stroke={`${s}1)`} strokeWidth="0.8" fill="none" />
        </svg>
      </div>

      {/* Corner bracket — top-left */}
      <svg width="80" height="80" viewBox="0 0 80 80"
        style={{ position:"absolute", top:"28px", left:"28px", opacity: isDark ? 0.22 : 0.18 }}>
        <path d="M60 10 L10 10 L10 60" fill="none"
          stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="3" fill={isDark ? "#60a5fa" : "#3b82f6"} />
      </svg>

      {/* Corner bracket — bottom-right */}
      <svg width="80" height="80" viewBox="0 0 80 80"
        style={{ position:"absolute", bottom:"28px", right:"28px", opacity: isDark ? 0.22 : 0.18 }}>
        <path d="M20 70 L70 70 L70 20" fill="none"
          stroke={isDark ? "#818cf8" : "#6366f1"} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="70" cy="70" r="3" fill={isDark ? "#818cf8" : "#6366f1"} />
      </svg>

      {/* Corner bracket — top-right */}
      <svg width="60" height="60" viewBox="0 0 60 60"
        style={{ position:"absolute", top:"28px", right:"28px", opacity: isDark ? 0.15 : 0.13 }}>
        <path d="M10 10 L50 10 L50 50" fill="none"
          stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1.2"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Corner bracket — bottom-left */}
      <svg width="60" height="60" viewBox="0 0 60 60"
        style={{ position:"absolute", bottom:"28px", left:"28px", opacity: isDark ? 0.15 : 0.13 }}>
        <path d="M50 50 L10 50 L10 10" fill="none"
          stroke={isDark ? "#818cf8" : "#6366f1"} strokeWidth="1.2"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Floating hexagon — top-right */}
      <svg width="64" height="64" viewBox="0 0 64 64"
        style={{ position:"absolute", top:"12%", right:"10%",
          animation:"floatA 11s ease-in-out infinite", opacity: isDark ? 0.22 : 0.17 }}>
        <polygon points="32,4 58,18 58,46 32,60 6,46 6,18"
          fill="none" stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1.2" />
      </svg>

      {/* Floating diamond — bottom-left */}
      <svg width="44" height="44" viewBox="0 0 44 44"
        style={{ position:"absolute", bottom:"14%", left:"9%",
          animation:"floatB 14s ease-in-out infinite 1s", opacity: isDark ? 0.20 : 0.15 }}>
        <rect x="8" y="8" width="28" height="28" fill="none"
          stroke={isDark ? "#818cf8" : "#6366f1"}
          strokeWidth="1.2" transform="rotate(45 22 22)" rx="2" />
      </svg>

      {/* Floating triangle — left-middle */}
      <svg width="38" height="38" viewBox="0 0 38 38"
        style={{ position:"absolute", top:"42%", left:"7%",
          animation:"floatA 16s ease-in-out infinite 2.5s", opacity: isDark ? 0.18 : 0.13 }}>
        <polygon points="19,4 34,32 4,32"
          fill="none" stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1.1" />
      </svg>

      {/* Floating circle-target — right-middle */}
      <svg width="40" height="40" viewBox="0 0 40 40"
        style={{ position:"absolute", top:"55%", right:"7%",
          animation:"floatB 13s ease-in-out infinite 0.8s", opacity: isDark ? 0.18 : 0.14 }}>
        <circle cx="20" cy="20" r="15"
          fill="none" stroke={isDark ? "#818cf8" : "#6366f1"} strokeWidth="1.1" />
        <circle cx="20" cy="20" r="4"
          fill={isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.18)"} />
      </svg>

      {/* Floating small hexagon — bottom-right */}
      <svg width="32" height="32" viewBox="0 0 32 32"
        style={{ position:"absolute", bottom:"22%", right:"14%",
          animation:"floatA 18s ease-in-out infinite 3s", opacity: isDark ? 0.20 : 0.16 }}>
        <polygon points="16,2 28,9 28,23 16,30 4,23 4,9"
          fill="none" stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1" />
      </svg>

      {/* Floating plus — top-left area */}
      <svg width="24" height="24" viewBox="0 0 24 24"
        style={{ position:"absolute", top:"22%", left:"14%",
          animation:"floatB 20s ease-in-out infinite 1.5s", opacity: isDark ? 0.22 : 0.16 }}>
        <line x1="12" y1="2" x2="12" y2="22"
          stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="2" y1="12" x2="22" y2="12"
          stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1.4" strokeLinecap="round" />
      </svg>

      {/* Animated dashed line — left edge */}
      <svg width="180" height="2"
        style={{ position:"absolute", top:"35%", left:0, opacity: isDark ? 0.12 : 0.09 }}>
        <line x1="0" y1="1" x2="180" y2="1"
          stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth="1" strokeDasharray="6 10"
          style={{ animation:"dashScroll 3s linear infinite" }} />
      </svg>

      {/* Animated dashed line — right edge */}
      <svg width="160" height="2"
        style={{ position:"absolute", top:"65%", right:0, opacity: isDark ? 0.12 : 0.09 }}>
        <line x1="0" y1="1" x2="160" y2="1"
          stroke={isDark ? "#818cf8" : "#6366f1"} strokeWidth="1" strokeDasharray="6 10"
          style={{ animation:"dashScroll 4s linear infinite reverse" }} />
      </svg>

      {/* Dot grid cluster — top-right */}
      <svg width="60" height="60" viewBox="0 0 60 60"
        style={{ position:"absolute", top:"8%", right:"22%", opacity: isDark ? 0.25 : 0.18 }}>
        {[0,1,2].flatMap(row => [0,1,2].map(col => (
          <circle key={`${row}-${col}`}
            cx={10+col*20} cy={10+row*20} r="2"
            fill={isDark ? "#60a5fa" : "#3b82f6"} />
        )))}
      </svg>

      {/* Dot grid cluster — bottom-left */}
      <svg width="60" height="60" viewBox="0 0 60 60"
        style={{ position:"absolute", bottom:"10%", left:"20%", opacity: isDark ? 0.20 : 0.14 }}>
        {[0,1,2].flatMap(row => [0,1,2].map(col => (
          <circle key={`${row}-${col}`}
            cx={10+col*20} cy={10+row*20} r="2"
            fill={isDark ? "#818cf8" : "#6366f1"} />
        )))}
      </svg>

      {/* Ambient blobs */}
      <div style={{
        position:"absolute", top:"-100px", left:"-100px",
        width:"420px", height:"420px", borderRadius:"50%",
        background: isDark ? "rgba(30,64,175,0.14)" : "rgba(147,197,253,0.30)",
        filter:"blur(90px)", transition:"background 0.5s",
      }} />
      <div style={{
        position:"absolute", bottom:"-80px", right:"-80px",
        width:"380px", height:"380px", borderRadius:"50%",
        background: isDark ? "rgba(67,56,202,0.11)" : "rgba(165,180,252,0.25)",
        filter:"blur(90px)", transition:"background 0.5s",
      }} />
    </div>
  );
}

/* ── Full-screen sign-in overlay ───────────────────────────────────────────── */
function TransitionOverlay({ visible, isDark }) {
  if (!visible) return null;
  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-colors duration-200 ${
      isDark ? "bg-slate-900" : "bg-white"
    }`}>
      <div className="relative w-16 h-16 mb-6">
        <div className={`absolute inset-0 rounded-full border-2 ${isDark ? "border-slate-800" : "border-slate-100"}`} />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-b-blue-300/40 animate-spin"
          style={{ animationDuration:"1.8s", animationDirection:"reverse" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield size={18} className={isDark ? "text-blue-400" : "text-blue-500"} />
        </div>
      </div>
      <p className={`text-[13px] font-bold tracking-wide ${isDark ? "text-slate-200" : "text-slate-700"}`}>Signing in…</p>
      <p className={`text-[11px] mt-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Verifying your credentials</p>
      <div className="flex gap-1.5 mt-5">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay:`${i*0.15}s`, animationDuration:"0.8s" }} />
        ))}
      </div>
    </div>
  );
}

/* ── Floating-label input ──────────────────────────────────────────────────── */
function Field({ label, icon:Icon, type="text", value, onChange, disabled, placeholder, right, autoComplete, isDark }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <Icon size={14} className={`transition-colors duration-150 ${
          focused
            ? isDark ? "text-blue-400" : "text-blue-500"
            : isDark ? "text-slate-500" : "text-slate-400"
        }`} />
      </div>
      <label className={`absolute left-9 z-10 pointer-events-none transition-all duration-150 ${
        lifted
          ? ("top-[6px] text-[9px] font-bold tracking-widest uppercase "+(isDark?"text-blue-400":"text-blue-600"))
          : ("top-1/2 -translate-y-1/2 text-[13px] "+(isDark?"text-slate-500":"text-slate-400"))
      }`}>{label}</label>
      <input
        type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        disabled={disabled} autoComplete={autoComplete}
        placeholder={focused ? placeholder : ""}
        className={[
          "w-full h-12 pl-9 text-[13px] rounded-xl border outline-none transition-all duration-150",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          right ? "pr-10" : "pr-3",
          lifted ? "pt-4" : "pt-0",
          isDark
            ? ("bg-slate-800/80 text-slate-100 placeholder-slate-600 "+(focused?"border-blue-500 ring-2 ring-blue-500/15 shadow-sm shadow-blue-500/10":"border-slate-700 hover:border-slate-600"))
            : ("bg-slate-50/80 text-slate-800 placeholder-slate-400 "+(focused?"border-blue-500 ring-2 ring-blue-500/10 shadow-sm shadow-blue-500/10":"border-slate-200 hover:border-slate-300")),
        ].join(" ")}
      />
      {right && <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10">{right}</div>}
    </div>
  );
}

/* ── Main Login Component ──────────────────────────────────────────────────── */
export default function Login() {
  const { theme, updateTheme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [userCode, setUserCode]           = useState("");
  const [password, setPassword]           = useState("");
  const [showPwd, setShowPwd]             = useState(false);
  const [rememberMe, setRememberMe]       = useState(false);
  const [error, setError]                 = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [signingIn, setSigningIn]         = useState(false);

  const [showModal, setShowModal]           = useState(false);
  const [newPwd, setNewPwd]                 = useState("");
  const [confirmPwd, setConfirmPwd]         = useState("");
  const [showNewPwd, setShowNewPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdError, setPwdError]             = useState("");
  const [changing, setChanging]             = useState(false);
  const [tempResult, setTempResult]         = useState(null);

  const [themeSaveStatus, setThemeSaveStatus] = useState({
    saving:false, saved:false, error:false, message:"",
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    const rem = localStorage.getItem("rememberedUser");
    if (rem) { setUserCode(rem); setRememberMe(true); }
    const lastTheme = localStorage.getItem("lastActiveTheme") || localStorage.getItem("userTheme");
    if (lastTheme && lastTheme !== theme) updateTheme(lastTheme);
    return () => clearTimeout(t);
  }, []);

  const handleThemeToggle = async () => {
    const newTheme = isDark ? "light" : "dark";
    setThemeSaveStatus({ saving:true, saved:false, error:false, message:"Saving theme..." });
    try {
      updateTheme(newTheme);
      localStorage.setItem("userTheme", newTheme);
      localStorage.setItem("lastActiveTheme", newTheme);
      const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = storedUser.UserID || storedUser.User_ID;
      if (userId) {
        const response = await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`,
          { userId, preferenceKey:"theme",
            preferenceValue: newTheme.charAt(0).toUpperCase()+newTheme.slice(1) });
        if (response.data.success) setThemeSaveStatus({ saving:false, saved:true, error:false, message:"Theme saved!" });
        else throw new Error("DB returned failure");
      } else {
        setThemeSaveStatus({ saving:false, saved:true, error:false, message:"Theme saved locally" });
      }
    } catch {
      localStorage.setItem("userTheme", isDark ? "light" : "dark");
      localStorage.setItem("lastActiveTheme", isDark ? "light" : "dark");
      setThemeSaveStatus({ saving:false, saved:false, error:true, message:"Error saving theme" });
    }
    setTimeout(() => setThemeSaveStatus({ saving:false, saved:false, error:false, message:"" }), 3000);
  };

  const goHome = async (userData) => {
    localStorage.setItem("currentUser", JSON.stringify(userData));
    localStorage.setItem("userTheme", theme);
    localStorage.setItem("lastActiveTheme", theme);
    if (rememberMe) localStorage.setItem("rememberedUser", userCode.trim());
    else localStorage.removeItem("rememberedUser");
    try {
      const userId = userData.UserID || userData.User_ID;
      if (userId) {
        await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
          userId, preferenceKey:"theme",
          preferenceValue: theme.charAt(0).toUpperCase()+theme.slice(1),
        });
      }
    } catch { /* non-blocking */ }
    navigate("/HomePage", { replace:true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!userCode || !password) { setError("Please enter both username and password."); return; }
    setSigningIn(true); setTransitioning(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userCode:userCode.trim(), password }),
      });
      if (!res.ok) throw new Error(res.status===401?"Invalid username or password.":`Server error (${res.status})`);
      const result = await res.json();
      if (result.success) {
        if (result.user?.OneLogPwd===1 || result.OneLogPwd===1) {
          setTempResult(result); setSigningIn(false); setTransitioning(false);
          setShowModal(true); return;
        }
        await goHome(result.user);
      } else { throw new Error("Incorrect credentials. Please try again."); }
    } catch (err) {
      setSigningIn(false); setTransitioning(false);
      setError(err.message || "Network error. Check your connection.");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError("");
    if (!newPwd || !confirmPwd) { setPwdError("Both fields are required."); return; }
    if (newPwd !== confirmPwd)  { setPwdError("Passwords do not match."); return; }
    if (newPwd.length < 6)      { setPwdError("Password must be at least 6 characters."); return; }
    setChanging(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userCode:userCode.trim(), currentPassword:password, newPassword:newPwd }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setShowModal(false); setNewPwd(""); setConfirmPwd(""); setTempResult(null);
        setTransitioning(true); await goHome(data.user);
      } else { setPwdError(data.error || "Password change failed."); }
    } catch (err) { setPwdError(err.message || "Network error."); }
    finally { setChanging(false); }
  };

  const strength = (() => {
    if (!newPwd) return 0;
    let s = 0;
    if (newPwd.length >= 6)  s++;
    if (newPwd.length >= 10) s++;
    if (/[A-Z]/.test(newPwd)) s++;
    if (/[0-9!@#$%^&*]/.test(newPwd)) s++;
    return s;
  })();
  const SM = [null,
    { label:"Weak",   color:"#ef4444" },
    { label:"Fair",   color:"#f97316" },
    { label:"Good",   color:"#eab308" },
    { label:"Strong", color:"#22c55e" },
  ][strength];

  const tp   = isDark ? "text-slate-100" : "text-slate-800";
  const ts   = isDark ? "text-slate-400" : "text-slate-500";
  const hdiv = isDark ? "border-slate-700/60" : "border-slate-100";
  const card = isDark
    ? "bg-slate-800/95 border-slate-700/80 shadow-black/60"
    : "bg-white/95 border-slate-200/80 shadow-slate-300/40";

  return (
    <>
      <style>{bgStyles}</style>
      <TransitionOverlay visible={transitioning} isDark={isDark} />

      <div className={"min-h-screen flex items-center justify-center relative transition-colors duration-300 "+
        (isDark ? "bg-slate-900" : "bg-[#eef2f7]")}>

        {/* Animated constellation canvas */}
        <ParticleCanvas isDark={isDark} />

        {/* SVG geometric ornaments */}
        <OrnamentalLayer isDark={isDark} />

        {/* Dot-grid texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: isDark
            ? "radial-gradient(circle, rgba(255,255,255,0.020) 1px, transparent 1px)"
            : "radial-gradient(circle, rgba(0,0,0,0.032) 1px, transparent 1px)",
          backgroundSize:"28px 28px",
        }} />

        {/* Theme toggle */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {themeSaveStatus.saving && (
            <div className="flex items-center gap-1 text-[11px] text-blue-500">
              <Loader2 size={11} className="animate-spin" /><span>Saving…</span>
            </div>
          )}
          {themeSaveStatus.saved && !themeSaveStatus.error && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-500">
              <CheckCircle size={11} /><span>Saved</span>
            </div>
          )}
          {themeSaveStatus.error && (
            <div className="flex items-center gap-1 text-[11px] text-red-500">
              <X size={11} /><span>Error</span>
            </div>
          )}
          <button onClick={handleThemeToggle}
            title={isDark ? "Switch to Light" : "Switch to Dark"}
            className={"w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-200 group "+(
              isDark
                ? "bg-slate-800/90 border-slate-700 hover:border-slate-500 hover:bg-slate-700"
                : "bg-white/90 border-slate-200 hover:border-slate-300 shadow-sm hover:shadow"
            )}>
            {isDark
              ? <Sun  size={13} className="text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
              : <Moon size={13} className="text-slate-500 group-hover:-rotate-12 transition-transform duration-300" />
            }
          </button>
        </div>

        {/* Watermark */}
        <div className={`absolute bottom-4 left-4 text-[10px] font-mono tracking-widest select-none ${
          isDark ? "text-slate-700" : "text-slate-300"
        }`}>RMS v1.0</div>

        {/* Login Card */}
        <div className={`w-full max-w-[368px] mx-4 relative transition-all duration-500 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
        }`}>
          <div className={`absolute -inset-px rounded-2xl blur-xl opacity-0 transition-opacity duration-500 ${
            mounted ? "opacity-100" : ""
          } ${isDark ? "bg-blue-900/20" : "bg-blue-200/40"}`} />

          <div className={`relative rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-sm ${card}`}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

            <div className={`px-6 pt-6 pb-5 border-b flex items-center gap-3.5 ${hdiv}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-sm ${
                isDark ? "bg-slate-900/80 border-slate-700" : "bg-slate-50 border-slate-200"
              }`}>
                <img src={Rebate} alt="Logo" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <h1 className={`text-[13px] font-bold leading-none tracking-tight ${tp}`}>
                  Rebate Management System
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  <p className={`text-[11px] ${ts}`}>Secure portal · v1.0</p>
                </div>
              </div>
            </div>

            <div className="px-6 pt-5 pb-1">
              <p className={`text-[12px] font-semibold tracking-widest uppercase ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}>Sign in to continue</p>
            </div>

            <div className="px-6 pb-6 pt-3 space-y-3">
              {error && (
                <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-[12px] ${
                  isDark?"bg-red-950/30 border-red-800/50 text-red-300":"bg-red-50 border-red-200 text-red-700"
                }`}>
                  <AlertCircle size={13} className="mt-px flex-shrink-0" />
                  <p className="leading-snug">{error}</p>
                  <button onClick={() => setError("")} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <Field label="UserID" icon={User} isDark={isDark}
                  value={userCode} onChange={e => setUserCode(e.target.value)}
                  disabled={signingIn} placeholder="USERID" autoComplete="username" />

                <Field label="Password" icon={Lock} isDark={isDark}
                  type={showPwd ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  disabled={signingIn} placeholder="••••••••" autoComplete="current-password"
                  right={
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className={`p-1 rounded transition-colors ${isDark?"text-slate-500 hover:text-slate-300":"text-slate-400 hover:text-slate-600"}`}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  } />

                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <button type="button" onClick={() => setRememberMe(!rememberMe)}
                    className={`w-4 h-4 rounded-md flex-shrink-0 border flex items-center justify-center transition-all duration-150 ${
                      rememberMe
                        ? "bg-blue-500 border-blue-500"
                        : isDark ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-white"
                    }`}>
                    {rememberMe && <CheckCircle size={9} className="text-white" />}
                  </button>
                  <span className={`text-[12px] select-none ${ts}`}>Remember me</span>
                </label>

                <button type="submit" disabled={signingIn}
                  className="relative w-full h-11 rounded-xl text-[13px] font-semibold text-white
                    bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.99]
                    shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35
                    transition-all duration-150 overflow-hidden group
                    disabled:opacity-80 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2 mt-1">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600 pointer-events-none" />
                  {signingIn ? (
                    <><Loader2 size={14} className="animate-spin relative" /><span className="relative">Signing in…</span></>
                  ) : (
                    <><span className="relative">Sign In</span><ArrowRight size={13} className="relative group-hover:translate-x-0.5 transition-transform duration-150" /></>
                  )}
                </button>
              </form>

              <p className={`text-center text-[10px] pt-1 ${isDark?"text-slate-600":"text-slate-400"}`}>
                Protected by enterprise-grade security
              </p>
            </div>
          </div>
        </div>

        {/* Password Change Modal */}
        {showModal && tempResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)" }}>
            <div className={`w-full max-w-[390px] rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-sm ${card}`}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

              <div className={`px-6 py-4 border-b flex items-center gap-3 ${hdiv}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  isDark?"bg-amber-950/40 border-amber-800/40":"bg-amber-50 border-amber-200"
                }`}>
                  <KeyRound size={14} className={isDark?"text-amber-400":"text-amber-600"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-bold ${tp}`}>Password Change Required</p>
                  <p className={`text-[11px] ${ts}`}>First-time login security policy</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              </div>

              <div className={`mx-6 mt-4 px-3 py-2.5 rounded-xl border flex items-center gap-2.5 ${
                isDark?"bg-slate-900/50 border-slate-700":"bg-slate-50 border-slate-200"
              }`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 border ${
                  isDark?"bg-blue-900/40 text-blue-300 border-blue-800/50":"bg-blue-50 text-blue-600 border-blue-100"
                }`}>
                  {(tempResult.user?.DisplayName || userCode).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-semibold truncate ${tp}`}>{tempResult.user?.DisplayName || userCode}</p>
                  <p className={`text-[10px] ${ts}`}>ID: {tempResult.user?.User_ID}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  isDark?"bg-emerald-950/40 border-emerald-800/40 text-emerald-400":"bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}>First Login</span>
              </div>

              <div className="px-6 py-4 space-y-3">
                {pwdError && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] ${
                    isDark?"bg-red-950/30 border-red-800/50 text-red-300":"bg-red-50 border-red-200 text-red-700"
                  }`}>
                    <AlertCircle size={12} className="flex-shrink-0" /><p>{pwdError}</p>
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <Field label="New Password" icon={Lock} isDark={isDark}
                    type={showNewPwd ? "text" : "password"}
                    value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    disabled={changing} placeholder="Min. 6 characters" autoComplete="new-password"
                    right={
                      <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                        className={`p-1 rounded transition-colors ${isDark?"text-slate-500 hover:text-slate-300":"text-slate-400 hover:text-slate-600"}`}>
                        {showNewPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    } />

                  {newPwd.length > 0 && SM && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                            style={{ background: i<=strength ? SM.color : isDark?"#334155":"#e2e8f0" }} />
                        ))}
                      </div>
                      <p className="text-[10px] font-semibold" style={{ color:SM.color }}>{SM.label}</p>
                    </div>
                  )}

                  <Field label="Confirm Password" icon={KeyRound} isDark={isDark}
                    type={showConfirmPwd ? "text" : "password"}
                    value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                    disabled={changing} placeholder="Repeat password" autoComplete="new-password"
                    right={
                      <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className={`p-1 rounded transition-colors ${isDark?"text-slate-500 hover:text-slate-300":"text-slate-400 hover:text-slate-600"}`}>
                        {showConfirmPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    } />

                  {confirmPwd.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {newPwd === confirmPwd
                        ? <><CheckCircle size={11} className="text-emerald-500"/><span className="text-[11px] text-emerald-600 font-medium">Passwords match</span></>
                        : <><X size={11} className="text-red-500"/><span className="text-[11px] text-red-500 font-medium">Passwords don't match</span></>
                      }
                    </div>
                  )}

                  <div className={`px-3 py-2.5 rounded-xl border text-[11px] space-y-1.5 ${
                    isDark?"bg-slate-900/40 border-slate-700":"bg-slate-50 border-slate-200"
                  }`}>
                    {[
                      { ok: newPwd.length >= 6,                         label:"At least 6 characters" },
                      { ok: newPwd === confirmPwd && newPwd.length > 0, label:"Passwords match" },
                    ].map(({ ok, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors duration-200 ${
                          ok ? "bg-emerald-500" : isDark ? "bg-slate-700" : "bg-slate-200"
                        }`}>
                          {ok && <CheckCircle size={8} className="text-white" />}
                        </div>
                        <span className={ok ? "text-emerald-600 font-medium" : ts}>{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button type="button" disabled={changing}
                      onClick={() => { setShowModal(false); setNewPwd(""); setConfirmPwd(""); setPwdError(""); }}
                      className={`flex-1 h-9 rounded-xl text-[12px] font-semibold border transition-all duration-150 disabled:opacity-40 ${
                        isDark
                          ? "bg-transparent border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}>Cancel</button>
                    <button type="submit" disabled={changing}
                      className="flex-1 h-9 rounded-xl text-[12px] font-semibold text-white
                        bg-blue-600 hover:bg-blue-700 transition-all duration-150
                        shadow-md shadow-blue-500/20 disabled:opacity-60
                        relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 pointer-events-none" />
                      {changing
                        ? <div className="flex items-center justify-center gap-1.5">
                            <Loader2 size={13} className="animate-spin" /><span>Saving…</span>
                          </div>
                        : <span className="relative">Update Password</span>
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}