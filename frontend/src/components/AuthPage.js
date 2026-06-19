// AuthPage.js — Split-card · Image left panel · Clean right form
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Eye, EyeOff, Lock, X, KeyRound,
  AlertCircle, CheckCircle, Shield, ShieldCheck, ArrowRight,
  Sun, Moon, Loader2, User, HelpCircle, LayoutDashboard, Users, BarChart3,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import Rebate from "../assets/Rebate.png";
const API_BASE = "http://192.168.100.193:3009/api";
const DB_NAME  = "USER";
/* ─── Global styles & keyframes ─────────────────────────────────────────────── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Sora:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  @keyframes floatUp    { 0%,100%{transform:translateY(0)}      50%{transform:translateY(-14px)} }
  @keyframes spinSlow   { from{transform:rotate(0deg)}          to{transform:rotate(360deg)} }
  @keyframes pulse2     { 0%,100%{opacity:.5}                   50%{opacity:1} }
  @keyframes slideIn    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes floatBlob  {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(18px,-22px) scale(1.04); }
    66%     { transform: translate(-14px,16px) scale(.97); }
  }
  @keyframes floatBlob2 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(-20px,18px) scale(1.05); }
    66%     { transform: translate(16px,-14px) scale(.96); }
  }
  @keyframes swirl {
    0%   { transform: rotate(0deg)   scale(1);    opacity:.90; }
    50%  { transform: rotate(180deg) scale(1.06); opacity:1;   }
    100% { transform: rotate(360deg) scale(1);    opacity:.90; }
  }
  @keyframes swirlRv {
    0%   { transform: rotate(0deg)   scale(1.05); }
    100% { transform: rotate(-360deg) scale(1.05); }
  }
  @keyframes carouselFadeIn {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes carouselFadeOut {
    from { opacity:1; transform:translateY(0); }
    to   { opacity:0; transform:translateY(-14px); }
  }
  /* ── Tooltip ── */
  .tooltip-hover {
    position: relative;
    display: inline-flex;
    cursor: pointer;
  }
  .tooltip-hover .tooltip-text {
    visibility: hidden;
    opacity: 0;
    width: 260px;
    background-color: #0f172aee;
    backdrop-filter: blur(14px);
    color: #f1f5f9;
    text-align: left;
    border-radius: 14px;
    padding: 12px 14px;
    position: absolute;
    z-index: 200;
    /* open UPWARD from the bottom-right icon */
    bottom: calc(100% + 10px);
    right: 0;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.6;
    transition: opacity 0.2s ease, visibility 0.2s;
    pointer-events: none;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 12px 30px -4px rgba(0,0,0,0.35);
    white-space: normal;
    font-family: 'DM Sans', sans-serif;
  }
  .tooltip-hover:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
  /* arrow points downward toward the icon */
  .tooltip-hover .tooltip-text::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 10px;
    border-width: 6px;
    border-style: solid;
    border-color: #0f172aee transparent transparent transparent;
  }
  @media (max-width: 639px) {
    .tooltip-hover .tooltip-text {
      width: 220px;
      right: -8px;
      font-size: 11px;
    }
  }
`;
/* ─── Carousel slides ────────────────────────────────────────────────────────── */
const CAROUSEL_SLIDES = [
  {
    heading:     "Simplify Rebate\nManagement",
    description: "Manage rebate centralized records with flexible configuration and full audit trails.",
    accent:      "#60a5fa",
    icon:        <LayoutDashboard size={22} strokeWidth={1.7} />,
  },
  {
    heading:     "Track Customers\nEarned Rebates Instantly",
    description: "Monitor customer earned rebates, payout progress, and rebate balances in real time.",
    accent:      "#a78bfa",
    icon:        <Users size={22} strokeWidth={1.7} />,
  },
  {
    heading:     "View Customers\nReports",
    description: "Access detailed customer rebate reports, summaries, and transaction insights easily.",
    accent:      "#34d399",
    icon:        <BarChart3 size={22} strokeWidth={1.7} />,
  },
];
const SLIDE_DURATION = 4000;
/* ─── Left decorative panel ──────────────────────────────────────────────────── */
function BrandPanel({ isDark }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [animatingIn,  setAnimatingIn]  = useState(false);
  const timerRef = useRef(null);
  const goToSlide = (next) => {
    if (animatingOut || animatingIn) return;
    setAnimatingOut(true);
    setTimeout(() => {
      setCurrentSlide(next);
      setAnimatingOut(false);
      setAnimatingIn(true);
      setTimeout(() => setAnimatingIn(false), 420);
    }, 320);
  };
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentSlide(prev => {
        const next = (prev + 1) % CAROUSEL_SLIDES.length;
        goToSlide(next);
        return prev;
      });
    }, SLIDE_DURATION);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleDotClick = (i) => {
    if (i === currentSlide) return;
    clearInterval(timerRef.current);
    goToSlide(i);
    timerRef.current = setInterval(() => {
      setCurrentSlide(prev => {
        const next = (prev + 1) % CAROUSEL_SLIDES.length;
        goToSlide(next);
        return prev;
      });
    }, SLIDE_DURATION);
  };
  const slide = CAROUSEL_SLIDES[currentSlide];
  const textAnimation = animatingOut
    ? "carouselFadeOut .32s cubic-bezier(.4,0,.6,1) forwards"
    : animatingIn
    ? "carouselFadeIn .42s cubic-bezier(.2,0,.2,1) forwards"
    : "none";
  return (
    <div style={{
      width:"100%", height:"100%", position:"relative", overflow:"hidden",
      background:"linear-gradient(160deg, #0a1628 0%, #0d1f3e 30%, #12103a 60%, #0a1628 100%)",
      display:"flex", flexDirection:"column",
      alignItems:"flex-start", justifyContent:"space-between",
      padding:"32px 32px 28px",
    }}>
      {/* Ambient blobs */}
      <div style={{
        position:"absolute", top:"10%", left:"5%",
        width:"70%", height:"65%",
        background:"radial-gradient(ellipse at 40% 40%, rgba(0,210,190,.55) 0%, rgba(0,150,220,.30) 35%, transparent 70%)",
        filter:"blur(52px)", borderRadius:"50%",
        animation:"floatBlob 9s ease-in-out infinite", pointerEvents:"none",
      }} />
      <div style={{
        position:"absolute", top:"20%", left:"20%",
        width:"65%", height:"60%",
        background:"radial-gradient(ellipse at 55% 55%, rgba(160,60,255,.50) 0%, rgba(100,30,200,.28) 40%, transparent 72%)",
        filter:"blur(56px)", borderRadius:"50%",
        animation:"floatBlob2 11s ease-in-out infinite", pointerEvents:"none",
      }} />
      <div style={{
        position:"absolute", top:"30%", left:"-8%",
        width:"55%", height:"50%",
        background:"radial-gradient(ellipse at 50% 50%, rgba(0,180,230,.35) 0%, transparent 68%)",
        filter:"blur(40px)", borderRadius:"50%",
        animation:"floatBlob 14s ease-in-out infinite reverse", pointerEvents:"none",
      }} />
      {/* Noise */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        backgroundSize:"180px 180px", opacity:.55,
      }} />
      {/* Logo */}
      <div style={{ position:"relative", zIndex:10, display:"flex", alignItems:"center", gap:"10px" }}>
        <div style={{
          width:"36px", height:"36px", borderRadius:"10px",
          backdropFilter:"blur(8px)",
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        }}>
          <img src={Rebate} alt="Logo"
            style={{ width:"50px", height:"50px", objectFit:"contain" }} />
        </div>
        <span style={{
          fontFamily:"'Sora', sans-serif",
          fontSize:"13px", fontWeight:700, color:"rgba(255,255,255,.85)",
          letterSpacing:".2px",
        }}>Rebate Management System</span>
      </div>
      {/* Central swirl — clamped to top 62% so it never bleeds over the text zone */}
      <div style={{
        position:"absolute",
        top:"8%", left:"50%",
        transform:"translateX(-50%)",
        width:"300px", height:"300px",
        zIndex:2, pointerEvents:"none",
      }}>
        <div style={{
          position:"absolute", inset:"-10px", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(0,210,190,.18) 0%, transparent 70%)",
          filter:"blur(16px)",
        }} />
        <div style={{
          position:"absolute", inset:"10px", borderRadius:"50%",
          background:"conic-gradient(from 0deg, rgba(0,210,190,.0) 0deg, rgba(0,210,190,.85) 90deg, rgba(0,180,240,.70) 160deg, rgba(0,210,190,.0) 200deg, rgba(0,210,190,.0) 360deg)",
          filter:"blur(3px)", animation:"swirl 8s linear infinite", opacity:.85,
        }} />
        <div style={{
          position:"absolute", inset:"28px", borderRadius:"50%",
          background:"conic-gradient(from 120deg, rgba(160,60,255,.0) 0deg, rgba(160,60,255,.80) 80deg, rgba(200,80,255,.60) 150deg, rgba(160,60,255,.0) 200deg, rgba(160,60,255,.0) 360deg)",
          filter:"blur(3.5px)", animation:"swirlRv 10s linear infinite", opacity:.80,
        }} />
        <div style={{
          position:"absolute", inset:"52px", borderRadius:"50%",
          background:"conic-gradient(from 240deg, rgba(255,80,180,.0) 0deg, rgba(255,80,180,.65) 70deg, rgba(255,120,200,.50) 130deg, rgba(255,80,180,.0) 190deg, rgba(255,80,180,.0) 360deg)",
          filter:"blur(4px)", animation:"swirl 12s linear infinite", opacity:.70,
        }} />
        <div style={{
          position:"absolute", inset:"80px", borderRadius:"50%",
          background:"radial-gradient(circle at 38% 38%, rgba(220,240,255,.22) 0%, rgba(120,180,255,.08) 50%, transparent 75%)",
          backdropFilter:"blur(1px)",
        }} />
        <div style={{
          position:"absolute", inset:"130px", borderRadius:"50%",
          background:"rgba(255,255,255,.06)",
        }} />
      </div>
      {/* Dark gradient scrim — covers the bottom ~45% so decorative elements
          never paint over the carousel text */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0,
        height:"55%",
        background:"linear-gradient(to bottom, transparent 0%, rgba(8,14,30,.82) 55%, rgba(8,14,30,.97) 100%)",
        zIndex:3, pointerEvents:"none",
      }} />
      {/* Bottom carousel — z-index above scrim */}
      <div style={{ position:"relative", zIndex:10, width:"100%" }}>
        <div style={{ minHeight:"108px", animation: textAnimation }}>
          {/* Icon pill */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"7px",
            background:"rgba(255,255,255,.07)",
            border:`1px solid ${slide.accent}44`,
            borderRadius:"20px", padding:"5px 12px 5px 8px",
            marginBottom:"10px",
          }}>
            <div style={{
              color: slide.accent,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {React.cloneElement(slide.icon, { size:15, strokeWidth:1.8 })}
            </div>
            <span style={{
              fontSize:"10px", fontWeight:600, color: slide.accent,
              letterSpacing:".4px", textTransform:"uppercase",
              fontFamily:"'DM Sans', sans-serif",
            }}>
              {currentSlide === 0 ? "Management" : currentSlide === 1 ? "Tracking" : "Reports"}
            </span>
          </div>
          {/* Heading — plain white with colored first word for legibility */}
          <h2 style={{
            margin:"0 0 8px",
            fontFamily:"'Sora', sans-serif",
            fontSize:"20px", fontWeight:800, lineHeight:1.3,
            letterSpacing:"-.3px",
            color:"#ffffff",
            whiteSpace:"pre-line",
            /* Strong text-shadow so it reads over any blob that drifts behind */
            textShadow:"0 1px 16px rgba(0,0,0,.90), 0 2px 4px rgba(0,0,0,.70)",
          }}>
            {/* Colour only the accent word(s) */}
            {slide.heading.split("\n").map((line, li) => (
              <span key={li} style={{ display:"block" }}>
                {li === 0
                  ? <span style={{ color: slide.accent }}>{line}</span>
                  : line
                }
              </span>
            ))}
          </h2>
          <p style={{
            margin:0,
            fontSize:"12px", fontWeight:400,
            color:"rgba(255,255,255,.60)", lineHeight:1.65,
            maxWidth:"230px",
            textShadow:"0 1px 6px rgba(0,0,0,.70)",
          }}>
            {slide.description}
          </p>
        </div>
        {/* Dots */}
        <div style={{ display:"flex", gap:"6px", marginTop:"16px", alignItems:"center" }}>
          {CAROUSEL_SLIDES.map((s, i) => (
            <button key={i} onClick={() => handleDotClick(i)} title={`Slide ${i + 1}`}
              style={{
                padding:0, border:"none", cursor:"pointer",
                height:"6px",
                width: i === currentSlide ? "20px" : "6px",
                borderRadius:"3px",
                background: i === currentSlide ? slide.accent : "rgba(255,255,255,.20)",
                transition:"width .35s cubic-bezier(.4,0,.2,1), background .35s ease",
                boxShadow: i === currentSlide ? `0 0 8px 1px ${slide.accent}55` : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
/* ─── Sign-in transition overlay ─────────────────────────────────────────────── */
function TransitionOverlay({ visible, isDark }) {
  if (!visible) return null;
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background: isDark ? "#0f172a" : "#fff",
      fontFamily:"'DM Sans', sans-serif",
    }}>
      <div style={{ position:"relative", width:"54px", height:"54px", marginBottom:"20px" }}>
        <div style={{
          position:"absolute", inset:0, borderRadius:"50%",
          border:`2px solid ${isDark?"#1e293b":"#f1f5f9"}`,
        }} />
        <div style={{
          position:"absolute", inset:0, borderRadius:"50%",
          border:"2px solid transparent", borderTopColor:"#3b82f6",
          animation:"spinSlow .9s linear infinite",
        }} />
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Shield size={16} color={isDark?"#60a5fa":"#3b82f6"} />
        </div>
      </div>
      <p style={{ color:isDark?"#e2e8f0":"#1e293b", fontSize:"13px", fontWeight:700, margin:0 }}>
        Signing in…
      </p>
      <p style={{ color:isDark?"#475569":"#94a3b8", fontSize:"11px", margin:"6px 0 18px" }}>
        Verifying credentials
      </p>
      <div style={{ display:"flex", gap:"6px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width:"6px", height:"6px", borderRadius:"50%", background:"#3b82f6",
            animation:"floatUp .7s ease-in-out infinite",
            animationDelay:`${i*.15}s`,
          }} />
        ))}
      </div>
    </div>
  );
}
/* ─── Floating-label input ───────────────────────────────────────────────────── */
function Field({ label, icon: Icon, type="text", value, onChange,
                  disabled, placeholder, right, autoComplete, isDark }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  const borderColor = focused
    ? "#3b82f6"
    : isDark ? "rgba(255,255,255,.10)" : "#e2e8f0";
  return (
    <div style={{ position:"relative", fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{
        position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)",
        zIndex:2, pointerEvents:"none",
        color: focused ? "#3b82f6" : isDark ? "rgba(255,255,255,.25)" : "#94a3b8",
        transition:"color .15s",
      }}>
        <Icon size={14} />
      </div>
      <label style={{
        position:"absolute", left:"42px", zIndex:2, pointerEvents:"none",
        transition:"all .15s ease",
        top:       lifted ? "7px"  : "50%",
        transform: lifted ? "none" : "translateY(-50%)",
        fontSize:  lifted ? "9px"  : "13px",
        fontWeight: lifted ? 600 : 400,
        letterSpacing: lifted ? ".8px" : "0",
        textTransform: lifted ? "uppercase" : "none",
        color: focused
          ? "#3b82f6"
          : isDark ? "rgba(255,255,255,.30)" : "#94a3b8",
      }}>{label}</label>
      <input
        type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        disabled={disabled} autoComplete={autoComplete}
        placeholder={focused ? placeholder : ""}
        style={{
          width:"100%", height:"54px",
          paddingLeft:"42px", paddingRight: right ? "44px" : "14px",
          paddingTop: lifted ? "16px" : "0",
          fontSize:"13.5px", fontFamily:"'DM Sans', sans-serif",
          background: isDark
            ? (focused ? "rgba(59,130,246,.06)" : "rgba(255,255,255,.04)")
            : (focused ? "#f8faff" : "#f8fafc"),
          color: isDark ? "#f1f5f9" : "#0f172a",
          border:`1.5px solid ${borderColor}`,
          borderRadius:"12px", outline:"none",
          boxShadow: focused ? "0 0 0 3px rgba(59,130,246,.10)" : "none",
          transition:"border-color .15s, box-shadow .15s, background .15s",
          opacity: disabled ? .45 : 1,
          cursor:  disabled ? "not-allowed" : "text",
        }}
      />
      {right && (
        <div style={{
          position:"absolute", right:"12px", top:"50%",
          transform:"translateY(-50%)", zIndex:2,
        }}>{right}</div>
      )}
    </div>
  );
}
/* ─── Password strength bar ─────────────────────────────────────────────────── */
function StrengthMeter({ password, isDark }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 6)           score++;
  if (password.length >= 10)          score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9!@#$%^&*]/.test(password)) score++;
  const levels = [
    { label:"Weak",   color:"#ef4444" },
    { label:"Fair",   color:"#f97316" },
    { label:"Good",   color:"#eab308" },
    { label:"Strong", color:"#22c55e" },
  ];
  const lv = levels[Math.max(0, score - 1)];
  return (
    <div style={{ marginTop:"6px" }}>
      <div style={{ display:"flex", gap:"4px", marginBottom:"4px" }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex:1, height:"3px", borderRadius:"3px",
            background: i <= score ? lv.color : isDark ? "#1e293b" : "#e2e8f0",
            transition:"background .25s",
          }} />
        ))}
      </div>
      <p style={{ margin:0, fontSize:"10px", fontWeight:600, color:lv.color }}>{lv.label}</p>
    </div>
  );
}
/* ─── Password-change modal (Tailwind) ───────────────────────────────────────
   This is the only piece that was redesigned. It now uses Tailwind utility
   classes instead of inline style objects, and pulls its palette from the
   same indigo/blue/violet gradient + "pill" language used on the brand panel
   and the Sign In button, instead of the old mismatched amber theme.
   NOTE: this assumes Tailwind is configured in this project (postcss +
   tailwind.config content globs covering this file). The rest of AuthPage.js
   intentionally stays on inline styles, untouched, as requested.
────────────────────────────────────────────────────────────────────────────── */
function PasswordChangeModal({
  isDark,
  tempResult, userCode,
  newPwd, setNewPwd, confirmPwd, setConfirmPwd,
  showNewPwd, setShowNewPwd, showConfirmPwd, setShowConfirmPwd,
  pwdError, changing, onSubmit, onClose,
}) {
  const headingText = isDark ? "text-[#f1f5f9]" : "text-[#0f172a]";
  const subText      = isDark ? "text-white/[0.36]" : "text-[#94a3b8]";
  const dividerBorder = isDark ? "border-white/[0.07]" : "border-[#f1f5f9]";

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-[rgba(8,12,24,0.65)] backdrop-blur-[12px]">
      <div
        className={[
          "w-[min(440px,100%)] rounded-[22px] overflow-hidden border",
          "font-['DM_Sans',sans-serif] animate-[slideIn_.32s_cubic-bezier(.2,0,.2,1)]",
          isDark
            ? "bg-[rgba(13,20,40,0.97)] border-white/[0.07] shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]"
            : "bg-white/[0.98] border-black/[0.07] shadow-[0_32px_80px_rgba(15,23,42,0.2),0_0_0_1px_rgba(0,0,0,0.04)]",
        ].join(" ")}
      >
        {/* ── Gradient header banner — echoes the brand-panel palette ── */}
        <div className="relative overflow-hidden px-6 pt-6 pb-5 bg-[linear-gradient(135deg,#1d4ed8_0%,#4338ca_55%,#6d28d9_100%)]">
          <div className="pointer-events-none absolute -top-[35%] -left-[10%] w-[60%] h-[150%] rounded-full blur-[28px] bg-[radial-gradient(ellipse,rgba(255,255,255,0.20)_0%,transparent_68%)] animate-[floatBlob_8s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute -bottom-[45%] -right-[12%] w-[58%] h-[140%] rounded-full blur-[26px] bg-[radial-gradient(ellipse,rgba(129,140,248,0.45)_0%,transparent_70%)] animate-[floatBlob2_10s_ease-in-out_infinite]" />

          <button
            type="button"
            onClick={onClose}
            disabled={changing}
            className={[
              "absolute top-3.5 right-3.5 z-[3] w-[26px] h-[26px] rounded-lg",
              "bg-white/[0.12] border border-white/[0.18] flex items-center justify-center",
              changing ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            ].join(" ")}
          >
            <X size={12} className="text-white/[0.85]" />
          </button>

          <div className="relative z-[2] w-[42px] h-[42px] rounded-[13px] bg-white/[0.14] backdrop-blur-[8px] border border-white/[0.24] flex items-center justify-center mb-3.5">
            <ShieldCheck size={19} className="text-white" strokeWidth={1.8} />
          </div>

          <div className="relative z-[2] inline-flex items-center gap-1.5 bg-white/[0.12] border border-white/[0.20] rounded-full pl-2 pr-2.5 py-1 mb-2.5">
            <Lock size={10} className="text-[#a5b4fc]" />
            <span className="text-[9.5px] font-bold text-[#e0e7ff] tracking-[0.5px] uppercase">
              Security Required
            </span>
          </div>

          <h2 className="relative z-[2] m-0 mb-1 font-['Sora',sans-serif] text-[18px] font-extrabold text-white tracking-[-0.2px]">
            Set a New Password
          </h2>
          <p className="relative z-[2] m-0 text-[12px] text-white/[0.70] leading-[1.55] max-w-[320px]">
            This is a first-time login. Please create a new password to continue.
          </p>
        </div>

        {/* User chip */}
        <div
          className={[
            "mt-[18px] mx-6 px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5",
            isDark ? "bg-white/[0.04]" : "bg-black/[0.02]",
            dividerBorder,
          ].join(" ")}
        >
          <div
            className={[
              "w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center",
              "text-[13px] font-bold border",
              isDark
                ? "bg-[rgba(99,102,241,0.18)] border-[rgba(99,102,241,0.30)] text-[#a5b4fc]"
                : "bg-[#eef2ff] border-[#c7d2fe] text-[#4f46e5]",
            ].join(" ")}
          >
            {(tempResult.user?.DisplayName || userCode).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`m-0 mb-px text-xs font-semibold truncate ${headingText}`}>
              {tempResult.user?.DisplayName || userCode}
            </p>
            <p className={`m-0 text-[10px] ${subText}`}>
              ID: {tempResult.user?.User_ID}
            </p>
          </div>
          <span
            className={[
              "text-[9px] font-bold tracking-[0.4px] uppercase px-2 py-1 rounded-full border",
              isDark
                ? "text-[#34d399] bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.20)]"
                : "text-[#059669] bg-[#ecfdf5] border-[#a7f3d0]",
            ].join(" ")}
          >
            First Login
          </span>
        </div>

        {/* Body / form */}
        <div className="px-6 pt-4 pb-6 flex flex-col gap-3">
          {pwdError && (
            <div
              className={[
                "flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-xs border",
                isDark
                  ? "bg-[rgba(239,68,68,0.10)] border-[rgba(239,68,68,0.30)] text-[#fca5a5]"
                  : "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]",
              ].join(" ")}
            >
              <AlertCircle size={12} className="flex-shrink-0" />
              {pwdError}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <Field
                label="New Password" icon={Lock} isDark={isDark}
                type={showNewPwd ? "text" : "password"}
                value={newPwd} onChange={e => setNewPwd(e.target.value)}
                disabled={changing} placeholder="Min. 6 characters" autoComplete="new-password"
                right={
                  <button
                    type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                    className={`bg-transparent border-0 cursor-pointer p-1 ${isDark ? "text-white/[0.28]" : "text-[#94a3b8]"}`}
                  >
                    {showNewPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                }
              />
              <StrengthMeter password={newPwd} isDark={isDark} />
            </div>

            <div>
              <Field
                label="Confirm Password" icon={KeyRound} isDark={isDark}
                type={showConfirmPwd ? "text" : "password"}
                value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                disabled={changing} placeholder="Repeat password" autoComplete="new-password"
                right={
                  <button
                    type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className={`bg-transparent border-0 cursor-pointer p-1 ${isDark ? "text-white/[0.28]" : "text-[#94a3b8]"}`}
                  >
                    {showConfirmPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                }
              />
              {confirmPwd.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {newPwd === confirmPwd ? (
                    <>
                      <CheckCircle size={11} className="text-[#10b981]" />
                      <span className="text-[11px] font-medium text-[#10b981]">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X size={11} className="text-[#ef4444]" />
                      <span className="text-[11px] font-medium text-[#ef4444]">Passwords don't match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Requirements checklist */}
            <div
              className={[
                "px-3 py-2.5 rounded-[10px] border flex flex-col gap-2",
                isDark ? "bg-white/[0.03]" : "bg-black/[0.02]",
                dividerBorder,
              ].join(" ")}
            >
              {[
                { ok: newPwd.length >= 6,                       label: "At least 6 characters" },
                { ok: newPwd === confirmPwd && newPwd.length > 0, label: "Passwords match" },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={[
                      "w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-200",
                      ok ? "bg-[#10b981]" : isDark ? "bg-[#1e293b]" : "bg-[#e2e8f0]",
                    ].join(" ")}
                  >
                    {ok && <CheckCircle size={9} className="text-white" />}
                  </div>
                  <span className={`text-[11px] ${ok ? "font-medium text-[#10b981]" : `font-normal ${subText}`}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-1">
              <button
                type="button"
                disabled={changing}
                onClick={onClose}
                className={[
                  "flex-1 h-11 rounded-xl bg-transparent border-[1.5px] text-[12.5px] font-semibold",
                  changing ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                  isDark ? "border-white/10 text-white/[0.48]" : "border-[#e2e8f0] text-[#64748b]",
                ].join(" ")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={changing}
                className={[
                  "flex-1 h-11 rounded-xl border-0 text-white text-[12.5px] font-semibold",
                  "flex items-center justify-center gap-1.5",
                  "bg-[linear-gradient(135deg,#2563eb,#6366f1)] shadow-[0_6px_18px_rgba(59,130,246,0.28)]",
                  changing ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                ].join(" ")}
              >
                {changing
                  ? <><Loader2 size={13} className="animate-[spinSlow_.8s_linear_infinite]" />Saving…</>
                  : "Update Password"
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
/* ─── Main component ────────────────────────────────────────────────────────── */
export default function Login() {
  const { theme, updateTheme } = useTheme();
  const isDark  = theme === "dark";
  const navigate = useNavigate();
  const [userCode,   setUserCode]   = useState("");
  const [password,   setPassword]   = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error,      setError]      = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [signingIn,  setSigningIn]  = useState(false);
  const [mounted,    setMounted]    = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [newPwd,         setNewPwd]         = useState("");
  const [confirmPwd,     setConfirmPwd]     = useState("");
  const [showNewPwd,     setShowNewPwd]     = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdError,       setPwdError]       = useState("");
  const [changing,       setChanging]       = useState(false);
  const [tempResult,     setTempResult]     = useState(null);
  const [themeSaveStatus, setThemeSaveStatus] = useState({
    saving:false, saved:false, error:false,
  });
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    const rem = localStorage.getItem("rememberedUser");
    if (rem) { setUserCode(rem); setRememberMe(true); }
    const lastTheme = localStorage.getItem("lastActiveTheme") || localStorage.getItem("userTheme");
    if (lastTheme && lastTheme !== theme) updateTheme(lastTheme);
    return () => clearTimeout(t);
  }, []);
  const handleThemeToggle = async () => {
    const newTheme = isDark ? "light" : "dark";
    setThemeSaveStatus({ saving:true, saved:false, error:false });
    try {
      updateTheme(newTheme);
      localStorage.setItem("userTheme", newTheme);
      localStorage.setItem("lastActiveTheme", newTheme);
      const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = stored.UserID || stored.User_ID;
      if (userId) {
        await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
          userId, preferenceKey:"theme",
          preferenceValue: newTheme.charAt(0).toUpperCase() + newTheme.slice(1),
        });
      }
      setThemeSaveStatus({ saving:false, saved:true, error:false });
    } catch {
      localStorage.setItem("userTheme", isDark ? "light" : "dark");
      localStorage.setItem("lastActiveTheme", isDark ? "light" : "dark");
      setThemeSaveStatus({ saving:false, saved:false, error:true });
    }
    setTimeout(() => setThemeSaveStatus({ saving:false, saved:false, error:false }), 2800);
  };
  const goHome = async (userData) => {
    localStorage.setItem("currentUser", JSON.stringify(userData));
    localStorage.setItem("userTheme", theme);
    localStorage.setItem("lastActiveTheme", theme);
    if (rememberMe) localStorage.setItem("rememberedUser", userCode.trim());
    else            localStorage.removeItem("rememberedUser");
    try {
      const uid = userData.UserID || userData.User_ID;
      if (uid)
        await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
          userId: uid, preferenceKey:"theme",
          preferenceValue: theme.charAt(0).toUpperCase() + theme.slice(1),
        });
    } catch { /* non-blocking */ }
    setTransitioning(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    navigate("/HomePage", { replace:true });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!userCode || !password) { setError("Please enter both username and password."); return; }
    setSigningIn(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userCode: userCode.trim(), password }),
      });
      if (!res.ok)
        throw new Error(res.status===401 ? "Invalid username or password." : `Server error (${res.status})`);
      const result = await res.json();
      if (result.success) {
        if (result.user?.OneLogPwd===1 || result.OneLogPwd===1) {
          setSigningIn(false);
          setTempResult(result);
          setShowModal(true);
          return;
        }
        await goHome(result.user);
      } else {
        throw new Error("Incorrect credentials. Please try again.");
      }
    } catch (err) {
      setSigningIn(false);
      setError(err.message || "Network error. Check your connection.");
    }
  };
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError("");
    if (!newPwd || !confirmPwd) { setPwdError("Both fields are required."); return; }
    if (newPwd !== confirmPwd)  { setPwdError("Passwords do not match."); return; }
    if (newPwd.length < 6)     { setPwdError("Password must be at least 6 characters."); return; }
    setChanging(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userCode:userCode.trim(), currentPassword:password, newPassword:newPwd }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setNewPwd(""); setConfirmPwd(""); setTempResult(null);
        await goHome(data.user);
      } else {
        setPwdError(data.error || "Password change failed.");
        setChanging(false);
      }
    } catch (err) {
      setPwdError(err.message || "Network error.");
      setChanging(false);
    }
  };
  /* ── Derived tokens ── */
  const pageBg     = isDark ? "#0a0f1e"              : "#f0f4f8";
  const cardBg     = isDark ? "rgba(13,20,40,.97)"   : "rgba(255,255,255,.98)";
  const cardBorder = isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)";
  const heading    = isDark ? "#f1f5f9"              : "#0f172a";
  const subtext    = isDark ? "rgba(255,255,255,.36)" : "#94a3b8";
  const divBorder  = isDark ? "rgba(255,255,255,.07)" : "#f1f5f9";
  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <TransitionOverlay visible={transitioning} isDark={isDark} />
      {/* Page */}
      <div style={{
        minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background: pageBg, fontFamily:"'DM Sans', sans-serif",
        position:"relative", transition:"background .3s",
      }}>
        {/* Page glow */}
        <div style={{
          position:"fixed", top:"30%", left:"50%", transform:"translateX(-50%)",
          width:"600px", height:"400px",
          background:"radial-gradient(ellipse, rgba(59,130,246,.06) 0%, transparent 70%)",
          filter:"blur(40px)", pointerEvents:"none", zIndex:0,
        }} />
        {/* Theme toggle */}
        <div style={{
          position:"fixed", top:"16px", right:"16px", zIndex:100,
          display:"flex", alignItems:"center", gap:"8px",
        }}>
          {themeSaveStatus.saving && (
            <span style={{ color:"#3b82f6", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}>
              <Loader2 size={11} style={{ animation:"spinSlow .8s linear infinite" }} /> Saving…
            </span>
          )}
          {themeSaveStatus.saved && (
            <span style={{ color:"#10b981", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}>
              <CheckCircle size={11} /> Saved
            </span>
          )}
          {themeSaveStatus.error && (
            <span style={{ color:"#ef4444", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}>
              <X size={11} /> Error
            </span>
          )}
          <button onClick={handleThemeToggle}
            title={isDark?"Switch to Light":"Switch to Dark"}
            style={{
              width:"36px", height:"36px", borderRadius:"12px",
              border:`1.5px solid ${isDark?"rgba(255,255,255,.10)":"rgba(0,0,0,.10)"}`,
              background: isDark ? "rgba(15,23,42,.90)" : "rgba(255,255,255,.90)",
              backdropFilter:"blur(8px)",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", boxShadow:"0 2px 12px rgba(0,0,0,.10)",
              transition:"all .2s",
            }}>
            {isDark
              ? <Sun  size={14} color="#fbbf24" />
              : <Moon size={14} color="#64748b" />
            }
          </button>
        </div>
        {/* ══ SPLIT CARD ══ */}
        <div style={{
          position:"relative", zIndex:10,
          width:"min(880px, calc(100vw - 32px))",
          minHeight:"520px",
          display:"flex", borderRadius:"20px", overflow:"hidden",
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.06)"
            : "0 20px 60px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.06)",
          opacity:   mounted ? 1 : 0,
          transform: mounted ? "translateY(0) scale(1)" : "translateY(22px) scale(.98)",
          transition:"opacity .55s ease, transform .55s ease",
        }}>
          {/* LEFT panel */}
          <div className="brand-panel" style={{ width:"42%", flexShrink:0, minHeight:"520px" }}>
            <BrandPanel isDark={isDark} />
          </div>
          {/* RIGHT: login form — uses flex column with space-between so the
              version/tooltip footer sticks to the bottom */}
          <div style={{
            flex:1, background: cardBg,
            display:"flex", flexDirection:"column",
            padding:"48px 44px",
            position:"relative", overflow:"hidden",
          }}>
            {/* Top accent line */}
            <div style={{
              position:"absolute", top:0, left:0, right:0, height:"1px",
              background:"linear-gradient(90deg, transparent, rgba(59,130,246,.30), transparent)",
            }} />
            {/* Mobile logo row */}
            <div className="mobile-logo-row" style={{
              display:"none", alignItems:"center", gap:"12px", marginBottom:"24px",
            }}>
              <div style={{
                width:"40px", height:"40px", borderRadius:"12px",
                background: isDark ? "rgba(59,130,246,.14)" : "#eff6ff",
                border:`1px solid ${isDark?"rgba(59,130,246,.24)":"#bfdbfe"}`,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              }}>
                <img src={Rebate} alt="Logo" style={{ width:"24px", height:"24px", objectFit:"contain" }} />
              </div>
              <div>
                <div style={{ fontSize:"12px", fontWeight:700, color:heading, lineHeight:1.2 }}>
                  Rebate Management System
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"4px" }}>
                  <span style={{
                    width:"6px", height:"6px", borderRadius:"50%", background:"#10b981",
                    display:"inline-block", animation:"pulse2 2s ease-in-out infinite",
                  }} />
                  <span style={{ color:subtext, fontSize:"10px" }}>Secure portal · v1.0</span>
                </div>
              </div>
            </div>
            {/* ── SCROLLABLE MAIN CONTENT (grows to fill) ── */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
              {/* Header — NO extra wrapper that clips the text, plain div */}
              <div style={{ marginBottom:"28px" }}>
                <h1 style={{
                  margin:"0 0 6px",
                  fontSize:"26px",
                  fontWeight:700,
                  /* Explicit solid color — no gradient clip, no transparency */
                  color: isDark ? "#f1f5f9" : "#0f172a",
                  letterSpacing:"-.4px",
                  lineHeight:1.2,
                  fontFamily:"'Sora', sans-serif",
                  /* Safety: make sure nothing above can accidentally hide it */
                  position:"relative",
                  zIndex:5,
                }}>Welcome!</h1>
                <p style={{
                  margin:0,
                  color: isDark ? "rgba(255,255,255,.45)" : "#64748b",
                  fontSize:"13px",
                  fontWeight:400,
                  position:"relative",
                  zIndex:5,
                }}>
                  Sign in to your RMS account to continue
                </p>
              </div>
              {/* Error banner */}
              {error && (
                <div style={{
                  display:"flex", alignItems:"flex-start", gap:"10px",
                  padding:"10px 14px", borderRadius:"12px", marginBottom:"18px",
                  background: isDark ? "rgba(239,68,68,.10)" : "#fef2f2",
                  border:`1px solid ${isDark?"rgba(239,68,68,.28)":"#fecaca"}`,
                  color: isDark ? "#fca5a5" : "#b91c1c",
                  fontSize:"12px", animation:"slideIn .25s ease",
                }}>
                  <AlertCircle size={13} style={{ flexShrink:0, marginTop:"1px" }} />
                  <p style={{ margin:0, flex:1, lineHeight:1.5 }}>{error}</p>
                  <button onClick={() => setError("")} style={{
                    background:"none", border:"none", cursor:"pointer",
                    padding:0, opacity:.6, color:"inherit",
                  }}><X size={12} /></button>
                </div>
              )}
              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                <Field
                  label="Username" icon={User} isDark={isDark}
                  value={userCode} onChange={e => setUserCode(e.target.value)}
                  disabled={signingIn} placeholder="Enter your user ID" autoComplete="username"
                />
                <Field
                  label="Password" icon={Lock} isDark={isDark}
                  type={showPwd ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  disabled={signingIn} placeholder="••••••••" autoComplete="current-password"
                  right={
                    <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                      background:"none", border:"none", cursor:"pointer", padding:"4px",
                      color: isDark ? "rgba(255,255,255,.28)" : "#94a3b8", borderRadius:"6px",
                    }}>
                      {showPwd ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  }
                />
                {/* Remember me */}
                <label style={{
                  display:"flex", alignItems:"center", gap:"8px",
                  cursor:"pointer", userSelect:"none", marginTop:"-2px",
                }}>
                  <button type="button" onClick={() => setRememberMe(!rememberMe)} style={{
                    width:"16px", height:"16px", borderRadius:"4px", flexShrink:0,
                    border:`1.5px solid ${rememberMe?"#3b82f6":isDark?"rgba(255,255,255,.18)":"#cbd5e1"}`,
                    background: rememberMe ? "#3b82f6" : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    cursor:"pointer", transition:"all .15s", padding:0,
                  }}>
                    {rememberMe && <CheckCircle size={9} color="#fff"/>}
                  </button>
                  <span style={{ color:subtext, fontSize:"12px" }}>Remember me</span>
                </label>
                {/* Sign In button */}
                <button type="submit" disabled={signingIn} style={{
                  height:"52px", borderRadius:"12px", border:"none",
                  background: signingIn
                    ? "#2563eb"
                    : "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
                  color:"#fff", fontSize:"14px", fontWeight:600,
                  fontFamily:"'DM Sans', sans-serif", letterSpacing:".2px",
                  cursor: signingIn ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
                  boxShadow: signingIn ? "none" : "0 8px 24px rgba(59,130,246,.35)",
                  transition:"all .2s", opacity: signingIn ? .80 : 1,
                  marginTop:"4px",
                }}>
                  {signingIn
                    ? <><Loader2 size={15} style={{ animation:"spinSlow .8s linear infinite" }}/>Signing in…</>
                    : <>Sign In <ArrowRight size={14}/></>
                  }
                </button>
              </form>
            </div>
            {/* ── FOOTER: version tag + help tooltip — pinned to the bottom ── */}
            <div
              style={{
                marginTop: "20px",
                paddingTop: "14px",
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* Version badge */}
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.3px",
                  color: isDark ? "rgba(255,255,255,.28)" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Shield size={10} style={{ opacity: 0.55 }} />
                RMS v0.0.1
              </span>
              {/* Help tooltip — pinned right */}
              <div
                className="tooltip-hover"
                style={{
                  lineHeight: 0,
                  position: "absolute",
                  right: 0,
                }}
              >
                <HelpCircle
                  size={17}
                  strokeWidth={1.6}
                  style={{
                    color: isDark ? "rgba(255,255,255,.30)" : "#94a3b8",
                    transition: "color .15s",
                  }}
                />
                <div className="tooltip-text">
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "12px",
                      color: "#f1f5f9",
                    }}
                  >
                    Need help?
                  </strong>
                  <span style={{ opacity: 0.75 }}>• No account yet?</span> Contact your
                  system administrator.
                  <br />
                  <span style={{ opacity: 0.75 }}>• Forgot password?</span> Reach out to
                  support or reset via admin.
                  <br />
                  <span style={{ opacity: 0.75 }}>• First-time login?</span> Use your
                  temporary password.
                </div>
              </div>
            </div>
          </div>{/* end right panel */}
        </div>{/* end split card */}
        {/* Responsive breakpoints */}
        <style>{`
          @media (min-width: 640px) {
            .brand-panel     { display: block !important; }
            .mobile-logo-row { display: none  !important; }
          }
          @media (max-width: 639px) {
            .brand-panel     { display: none  !important; }
            .mobile-logo-row { display: flex  !important; }
          }
        `}</style>
      </div>
      {/* ══ Password-change modal (Tailwind-based, redesigned) ══ */}
      {showModal && tempResult && (
        <PasswordChangeModal
          isDark={isDark}
          tempResult={tempResult}
          userCode={userCode}
          newPwd={newPwd} setNewPwd={setNewPwd}
          confirmPwd={confirmPwd} setConfirmPwd={setConfirmPwd}
          showNewPwd={showNewPwd} setShowNewPwd={setShowNewPwd}
          showConfirmPwd={showConfirmPwd} setShowConfirmPwd={setShowConfirmPwd}
          pwdError={pwdError}
          changing={changing}
          onSubmit={handlePasswordChange}
          onClose={() => { setShowModal(false); setNewPwd(""); setConfirmPwd(""); setPwdError(""); }}
        />
      )}
    </>
  );
}