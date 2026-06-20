// AuthPage.js — Split-card · Image left panel · Clean right form
// Fully converted to Tailwind CSS
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
  @keyframes fillBar {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
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
    <div className="w-full h-full relative overflow-hidden flex flex-col items-start justify-between p-8"
      style={{ background: "linear-gradient(160deg, #0a1628 0%, #0d1f3e 30%, #12103a 60%, #0a1628 100%)" }}>

      {/* Ambient blob 1 */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "10%", left: "5%", width: "70%", height: "65%",
          background: "radial-gradient(ellipse at 40% 40%, rgba(0,210,190,.55) 0%, rgba(0,150,220,.30) 35%, transparent 70%)",
          filter: "blur(52px)", animation: "floatBlob 9s ease-in-out infinite",
        }} />

      {/* Ambient blob 2 */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "20%", left: "20%", width: "65%", height: "60%",
          background: "radial-gradient(ellipse at 55% 55%, rgba(160,60,255,.50) 0%, rgba(100,30,200,.28) 40%, transparent 72%)",
          filter: "blur(56px)", animation: "floatBlob2 11s ease-in-out infinite",
        }} />

      {/* Ambient blob 3 */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "30%", left: "-8%", width: "55%", height: "50%",
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,180,230,.35) 0%, transparent 68%)",
          filter: "blur(40px)", animation: "floatBlob 14s ease-in-out infinite reverse",
        }} />

      {/* Noise */}
      <div className="absolute inset-0 pointer-events-none opacity-55"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }} />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ backdropFilter: "blur(8px)" }}>
          <img src={Rebate} alt="Logo" className="w-[50px] h-[50px] object-contain" />
        </div>
        <span className="text-[13px] font-bold text-white/85 tracking-[0.2px]"
          style={{ fontFamily: "'Sora', sans-serif" }}>
          Rebate Management System
        </span>
      </div>

      {/* Central swirl */}
      <div className="absolute pointer-events-none z-[2]"
        style={{ top: "8%", left: "50%", transform: "translateX(-50%)", width: "300px", height: "300px" }}>
        <div className="absolute rounded-full"
          style={{ inset: "-10px", background: "radial-gradient(circle, rgba(0,210,190,.18) 0%, transparent 70%)", filter: "blur(16px)" }} />
        <div className="absolute rounded-full"
          style={{ inset: "10px", background: "conic-gradient(from 0deg, rgba(0,210,190,.0) 0deg, rgba(0,210,190,.85) 90deg, rgba(0,180,240,.70) 160deg, rgba(0,210,190,.0) 200deg, rgba(0,210,190,.0) 360deg)", filter: "blur(3px)", animation: "swirl 8s linear infinite", opacity: 0.85 }} />
        <div className="absolute rounded-full"
          style={{ inset: "28px", background: "conic-gradient(from 120deg, rgba(160,60,255,.0) 0deg, rgba(160,60,255,.80) 80deg, rgba(200,80,255,.60) 150deg, rgba(160,60,255,.0) 200deg, rgba(160,60,255,.0) 360deg)", filter: "blur(3.5px)", animation: "swirlRv 10s linear infinite", opacity: 0.80 }} />
        <div className="absolute rounded-full"
          style={{ inset: "52px", background: "conic-gradient(from 240deg, rgba(255,80,180,.0) 0deg, rgba(255,80,180,.65) 70deg, rgba(255,120,200,.50) 130deg, rgba(255,80,180,.0) 190deg, rgba(255,80,180,.0) 360deg)", filter: "blur(4px)", animation: "swirl 12s linear infinite", opacity: 0.70 }} />
        <div className="absolute rounded-full"
          style={{ inset: "80px", background: "radial-gradient(circle at 38% 38%, rgba(220,240,255,.22) 0%, rgba(120,180,255,.08) 50%, transparent 75%)", backdropFilter: "blur(1px)" }} />
        <div className="absolute rounded-full bg-white/[0.06]"
          style={{ inset: "130px" }} />
      </div>

      {/* Dark gradient scrim */}
      <div className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none"
        style={{ height: "55%", background: "linear-gradient(to bottom, transparent 0%, rgba(8,14,30,.82) 55%, rgba(8,14,30,.97) 100%)" }} />

      {/* Bottom carousel */}
      <div className="relative z-10 w-full">
        <div style={{ minHeight: "108px", animation: textAnimation }}>
          {/* Icon pill */}
          <div className="inline-flex items-center gap-[7px] rounded-[20px] mb-[10px]"
            style={{
              background: "rgba(255,255,255,.07)",
              border: `1px solid ${slide.accent}44`,
              padding: "5px 12px 5px 8px",
            }}>
            <div style={{ color: slide.accent }} className="flex items-center justify-center">
              {React.cloneElement(slide.icon, { size: 15, strokeWidth: 1.8 })}
            </div>
            <span className="text-[10px] font-semibold tracking-[0.4px] uppercase"
              style={{ color: slide.accent, fontFamily: "'DM Sans', sans-serif" }}>
              {currentSlide === 0 ? "Management" : currentSlide === 1 ? "Tracking" : "Reports"}
            </span>
          </div>

          {/* Heading */}
          <h2 className="m-0 mb-2 text-white whitespace-pre-line"
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "20px", fontWeight: 800, lineHeight: 1.3,
              letterSpacing: "-.3px",
              textShadow: "0 1px 16px rgba(0,0,0,.90), 0 2px 4px rgba(0,0,0,.70)",
            }}>
            {slide.heading.split("\n").map((line, li) => (
              <span key={li} className="block">
                {li === 0
                  ? <span style={{ color: slide.accent }}>{line}</span>
                  : line
                }
              </span>
            ))}
          </h2>

          <p className="m-0 text-[12px] font-normal leading-[1.65] max-w-[230px]"
            style={{ color: "rgba(255,255,255,.60)", textShadow: "0 1px 6px rgba(0,0,0,.70)" }}>
            {slide.description}
          </p>
        </div>

        {/* Dots */}
        <div className="flex gap-[6px] mt-4 items-center">
          {CAROUSEL_SLIDES.map((s, i) => (
            <button key={i} onClick={() => handleDotClick(i)} title={`Slide ${i + 1}`}
              className="p-0 border-none cursor-pointer h-[6px] rounded-[3px] transition-all duration-[350ms]"
              style={{
                width: i === currentSlide ? "20px" : "6px",
                background: i === currentSlide ? slide.accent : "rgba(255,255,255,.20)",
                boxShadow: i === currentSlide ? `0 0 8px 1px ${slide.accent}55` : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Sign-in loading overlay ────────────────────────────────────────────────
   Simplified: no checkmark badge, just spinning rings + logo + background + progress bar.
────────────────────────────────────────────────────────────────────────────── */
function TransitionOverlay({ visible, displayName }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!visible) { setStage(0); return; }
    const t1 = setTimeout(() => setStage(1), 750);
    const t2 = setTimeout(() => setStage(2), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  if (!visible) return null;

  const messages = [
    "Verifying credentials…",
    `Welcome back${displayName ? `, ${displayName}` : ""}!`,
    "Preparing your dashboard…",
  ];

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #0a1628 0%, #0d1f3e 30%, #12103a 60%, #0a1628 100%)",
        fontFamily: "'DM Sans', sans-serif",
      }}>

      {/* Ambient blobs */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "12%", left: "8%", width: "50%", height: "50%",
          background: "radial-gradient(ellipse at 40% 40%, rgba(0,210,190,.40) 0%, rgba(0,150,220,.20) 35%, transparent 70%)",
          filter: "blur(70px)", animation: "floatBlob 9s ease-in-out infinite",
        }} />
      <div className="absolute pointer-events-none rounded-full"
        style={{
          bottom: "10%", right: "10%", width: "48%", height: "46%",
          background: "radial-gradient(ellipse at 55% 55%, rgba(160,60,255,.38) 0%, rgba(100,30,200,.20) 40%, transparent 72%)",
          filter: "blur(70px)", animation: "floatBlob2 11s ease-in-out infinite",
        }} />

      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }} />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="absolute rounded-full opacity-50 pointer-events-none"
          style={{
            left: `${14 + i * 14}%`, top: `${68 + (i % 3) * 7}%`,
            width: "4px", height: "4px",
            background: i % 2 === 0 ? "#60a5fa" : "#a78bfa",
            animation: `floatUp ${3 + i * .4}s ease-in-out infinite`,
            animationDelay: `${i * .3}s`,
          }} />
      ))}

      {/* Centered content */}
      <div className="relative flex flex-col items-center" style={{ animation: "slideIn .5s cubic-bezier(.2,0,.2,1)" }}>

        {/* Logo + swirl rings */}
        <div className="relative mb-8" style={{ width: "148px", height: "148px" }}>

          {/* Soft pulsing glow */}
          <div className="absolute rounded-full pointer-events-none"
            style={{
              inset: "-20px",
              background: "radial-gradient(circle, rgba(99,102,241,.35) 0%, transparent 70%)",
              filter: "blur(20px)", animation: "pulse2 2.2s ease-in-out infinite",
            }} />

          {/* Ring 1 */}
          <div className="absolute rounded-full"
            style={{
              inset: 0,
              background: "conic-gradient(from 0deg, rgba(96,165,250,0) 0deg, rgba(96,165,250,.9) 90deg, rgba(56,189,248,.7) 160deg, rgba(96,165,250,0) 200deg, rgba(96,165,250,0) 360deg)",
              filter: "blur(2px)", animation: "swirl 3.4s linear infinite",
            }} />

          {/* Ring 2 */}
          <div className="absolute rounded-full"
            style={{
              inset: "14px",
              background: "conic-gradient(from 140deg, rgba(167,139,250,0) 0deg, rgba(167,139,250,.85) 80deg, rgba(192,132,252,.6) 150deg, rgba(167,139,250,0) 200deg, rgba(167,139,250,0) 360deg)",
              filter: "blur(2.5px)", animation: "swirlRv 4.2s linear infinite",
            }} />

          {/* Static ring track */}
          <div className="absolute rounded-full border border-white/[0.08]" style={{ inset: "14px" }} />

          {/* Logo plate */}
          <div className="absolute rounded-full flex items-center justify-center"
            style={{
              inset: "30px",
              background: "rgba(13,20,40,.85)",
              border: "1px solid rgba(255,255,255,.12)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 8px 28px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)",
            }}>
            <img src={Rebate} alt="" className="w-[46px] h-[46px] object-contain" />
          </div>
        </div>

        {/* Status text */}
        <div className="relative mb-[22px] min-w-[220px]" style={{ height: "22px" }}>
          {messages.map((msg, i) => (
            <p key={i}
              className="absolute left-1/2 top-0 m-0 whitespace-nowrap font-semibold text-[#f1f5f9] transition-opacity duration-[350ms]"
              style={{
                transform: "translateX(-50%)",
                fontFamily: "'Sora', sans-serif",
                fontSize: "14px",
                opacity: stage === i ? 1 : 0,
              }}>
              {msg}
            </p>
          ))}
        </div>

        {/* Progress bar */}
        <div className="rounded-[3px] overflow-hidden" style={{ width: "168px", height: "3px", background: "rgba(255,255,255,.10)" }}>
          <div className="h-full rounded-[3px]"
            style={{
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
              animation: "fillBar 2.2s cubic-bezier(.4,0,.2,1) forwards",
            }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Floating-label input ───────────────────────────────────────────────────── */
function Field({ label, icon: Icon, type = "text", value, onChange,
  disabled, placeholder, right, autoComplete, isDark }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  const borderColor = focused
    ? "#3b82f6"
    : isDark ? "rgba(255,255,255,.10)" : "#e2e8f0";

  return (
    <div className="relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="absolute left-[14px] top-1/2 -translate-y-1/2 z-[2] pointer-events-none transition-colors duration-150"
        style={{ color: focused ? "#3b82f6" : isDark ? "rgba(255,255,255,.25)" : "#94a3b8" }}>
        <Icon size={14} />
      </div>

      <label className="absolute left-[42px] z-[2] pointer-events-none transition-all duration-150"
        style={{
          top: lifted ? "7px" : "50%",
          transform: lifted ? "none" : "translateY(-50%)",
          fontSize: lifted ? "9px" : "13px",
          fontWeight: lifted ? 600 : 400,
          letterSpacing: lifted ? ".8px" : "0",
          textTransform: lifted ? "uppercase" : "none",
          color: focused ? "#3b82f6" : isDark ? "rgba(255,255,255,.30)" : "#94a3b8",
        }}>
        {label}
      </label>

      <input
        type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        disabled={disabled} autoComplete={autoComplete}
        placeholder={focused ? placeholder : ""}
        className="w-full rounded-xl outline-none transition-all duration-150"
        style={{
          height: "54px",
          paddingLeft: "42px",
          paddingRight: right ? "44px" : "14px",
          paddingTop: lifted ? "16px" : "0",
          fontSize: "13.5px",
          fontFamily: "'DM Sans', sans-serif",
          background: isDark
            ? (focused ? "rgba(59,130,246,.06)" : "rgba(255,255,255,.04)")
            : (focused ? "#f8faff" : "#f8fafc"),
          color: isDark ? "#f1f5f9" : "#0f172a",
          border: `1.5px solid ${borderColor}`,
          boxShadow: focused ? "0 0 0 3px rgba(59,130,246,.10)" : "none",
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      {right && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[2]">
          {right}
        </div>
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
    { label: "Weak",   color: "#ef4444" },
    { label: "Fair",   color: "#f97316" },
    { label: "Good",   color: "#eab308" },
    { label: "Strong", color: "#22c55e" },
  ];
  const lv = levels[Math.max(0, score - 1)];

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 h-[3px] rounded-[3px] transition-all duration-[250ms]"
            style={{ background: i <= score ? lv.color : isDark ? "#1e293b" : "#e2e8f0" }} />
        ))}
      </div>
      <p className="m-0 text-[10px] font-semibold" style={{ color: lv.color }}>{lv.label}</p>
    </div>
  );
}

/* ─── Password-change modal ──────────────────────────────────────────────────── */
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
        {/* Gradient header banner */}
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

          <h2 className="relative z-[2] m-0 mb-1 text-[18px] font-extrabold text-white tracking-[-0.2px]"
            style={{ fontFamily: "'Sora', sans-serif" }}>
            Set a New Password
          </h2>
          <p className="relative z-[2] m-0 text-[12px] text-white/[0.70] leading-[1.55] max-w-[320px]">
            This is a first-time login. Please create a new password to continue.
          </p>
        </div>

        {/* User chip */}
        <div className={[
          "mt-[18px] mx-6 px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5",
          isDark ? "bg-white/[0.04]" : "bg-black/[0.02]",
          dividerBorder,
        ].join(" ")}>
          <div className={[
            "w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center",
            "text-[13px] font-bold border",
            isDark
              ? "bg-[rgba(99,102,241,0.18)] border-[rgba(99,102,241,0.30)] text-[#a5b4fc]"
              : "bg-[#eef2ff] border-[#c7d2fe] text-[#4f46e5]",
          ].join(" ")}>
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
          <span className={[
            "text-[9px] font-bold tracking-[0.4px] uppercase px-2 py-1 rounded-full border",
            isDark
              ? "text-[#34d399] bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.20)]"
              : "text-[#059669] bg-[#ecfdf5] border-[#a7f3d0]",
          ].join(" ")}>
            First Login
          </span>
        </div>

        {/* Body / form */}
        <div className="px-6 pt-4 pb-6 flex flex-col gap-3">
          {pwdError && (
            <div className={[
              "flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-xs border",
              isDark
                ? "bg-[rgba(239,68,68,0.10)] border-[rgba(239,68,68,0.30)] text-[#fca5a5]"
                : "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]",
            ].join(" ")}>
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
            <div className={[
              "px-3 py-2.5 rounded-[10px] border flex flex-col gap-2",
              isDark ? "bg-white/[0.03]" : "bg-black/[0.02]",
              dividerBorder,
            ].join(" ")}>
              {[
                { ok: newPwd.length >= 6,                           label: "At least 6 characters" },
                { ok: newPwd === confirmPwd && newPwd.length > 0,   label: "Passwords match" },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={[
                    "w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-200",
                    ok ? "bg-[#10b981]" : isDark ? "bg-[#1e293b]" : "bg-[#e2e8f0]",
                  ].join(" ")}>
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
  const [authedName, setAuthedName] = useState("");
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
    saving: false, saved: false, error: false,
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
    setThemeSaveStatus({ saving: true, saved: false, error: false });
    try {
      updateTheme(newTheme);
      localStorage.setItem("userTheme", newTheme);
      localStorage.setItem("lastActiveTheme", newTheme);
      const stored = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = stored.UserID || stored.User_ID;
      if (userId) {
        await axios.post(`${API_BASE}/user/preferences/save?db=${DB_NAME}`, {
          userId, preferenceKey: "theme",
          preferenceValue: newTheme.charAt(0).toUpperCase() + newTheme.slice(1),
        });
      }
      setThemeSaveStatus({ saving: false, saved: true, error: false });
    } catch {
      localStorage.setItem("userTheme", isDark ? "light" : "dark");
      localStorage.setItem("lastActiveTheme", isDark ? "light" : "dark");
      setThemeSaveStatus({ saving: false, saved: false, error: true });
    }
    setTimeout(() => setThemeSaveStatus({ saving: false, saved: false, error: false }), 2800);
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
          userId: uid, preferenceKey: "theme",
          preferenceValue: theme.charAt(0).toUpperCase() + theme.slice(1),
        });
    } catch { /* non-blocking */ }
    setAuthedName(userData?.DisplayName || userData?.UserName || userCode.trim());
    setTransitioning(true);
    await new Promise(resolve => setTimeout(resolve, 2200));
    navigate("/HomePage", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!userCode || !password) { setError("Please enter both username and password."); return; }
    setSigningIn(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: userCode.trim(), password }),
      });
      if (!res.ok)
        throw new Error(res.status === 401 ? "Invalid username or password." : `Server error (${res.status})`);
      const result = await res.json();
      if (result.success) {
        if (result.user?.OneLogPwd === 1 || result.OneLogPwd === 1) {
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: userCode.trim(), currentPassword: password, newPassword: newPwd }),
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
  const cardBg     = isDark ? "rgba(13,20,40,.97)"    : "rgba(255,255,255,.98)";
  const heading    = isDark ? "#f1f5f9"               : "#0f172a";
  const subtext    = isDark ? "rgba(255,255,255,.36)" : "#94a3b8";

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <TransitionOverlay visible={transitioning} displayName={authedName} />

      {/* Page */}
      <div className={`min-h-screen flex items-center justify-center relative transition-colors duration-300 ${isDark ? "bg-[#0a0f1e]" : "bg-[#f0f4f8]"}`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* Page glow */}
        <div className="fixed pointer-events-none z-0"
          style={{
            top: "30%", left: "50%", transform: "translateX(-50%)",
            width: "600px", height: "400px",
            background: "radial-gradient(ellipse, rgba(59,130,246,.06) 0%, transparent 70%)",
            filter: "blur(40px)",
          }} />

        {/* Theme toggle */}
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-2">
          {themeSaveStatus.saving && (
            <span className="text-[#3b82f6] text-[11px] flex items-center gap-1">
              <Loader2 size={11} style={{ animation: "spinSlow .8s linear infinite" }} /> Saving…
            </span>
          )}
          {themeSaveStatus.saved && (
            <span className="text-[#10b981] text-[11px] flex items-center gap-1">
              <CheckCircle size={11} /> Saved
            </span>
          )}
          {themeSaveStatus.error && (
            <span className="text-[#ef4444] text-[11px] flex items-center gap-1">
              <X size={11} /> Error
            </span>
          )}
          <button
            onClick={handleThemeToggle}
            title={isDark ? "Switch to Light" : "Switch to Dark"}
            className={[
              "w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer",
              "border-[1.5px] transition-all duration-200",
              "shadow-[0_2px_12px_rgba(0,0,0,.10)]",
              isDark
                ? "border-white/10 bg-[rgba(15,23,42,.90)]"
                : "border-black/10 bg-[rgba(255,255,255,.90)]",
            ].join(" ")}
            style={{ backdropFilter: "blur(8px)" }}>
            {isDark
              ? <Sun  size={14} color="#fbbf24" />
              : <Moon size={14} color="#64748b" />
            }
          </button>
        </div>

        {/* ══ SPLIT CARD ══ */}
        <div
          className="relative z-10 flex rounded-[20px] overflow-hidden transition-all duration-[550ms]"
          style={{
            width: "min(880px, calc(100vw - 32px))",
            minHeight: "520px",
            boxShadow: isDark
              ? "0 32px 80px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.06)"
              : "0 20px 60px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.06)",
            opacity:   mounted ? 1 : 0,
            transform: mounted ? "translateY(0) scale(1)" : "translateY(22px) scale(.98)",
          }}>

          {/* LEFT panel */}
          <div className="brand-panel flex-shrink-0 min-h-[520px]" style={{ width: "42%" }}>
            <BrandPanel isDark={isDark} />
          </div>

          {/* RIGHT: login form */}
          <div className="flex-1 flex flex-col relative overflow-hidden"
            style={{ background: cardBg, padding: "48px 44px" }}>

            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,.30), transparent)" }} />

            {/* Mobile logo row */}
            <div className="mobile-logo-row hidden items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${isDark ? "bg-[rgba(59,130,246,.14)] border-[rgba(59,130,246,.24)]" : "bg-[#eff6ff] border-[#bfdbfe]"}`}>
                <img src={Rebate} alt="Logo" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight" style={{ color: heading }}>
                  Rebate Management System
                </div>
                <div className="flex items-center gap-[5px] mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] inline-block"
                    style={{ animation: "pulse2 2s ease-in-out infinite" }} />
                  <span className="text-[10px]" style={{ color: subtext }}>Secure portal · v1.0</span>
                </div>
              </div>
            </div>

            {/* Scrollable main content */}
            <div className="flex-1 flex flex-col justify-center">

              {/* Header */}
              <div className="mb-7">
                <h1 className="m-0 mb-1.5 font-bold tracking-[-0.4px] leading-tight relative z-[5]"
                  style={{
                    fontSize: "26px",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    fontFamily: "'Sora', sans-serif",
                  }}>
                  Welcome!
                </h1>
                <p className="m-0 text-[13px] font-normal relative z-[5]"
                  style={{ color: isDark ? "rgba(255,255,255,.45)" : "#64748b" }}>
                  Sign in to your RMS account to continue
                </p>
              </div>

              {/* Error banner */}
              {error && (
                <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl mb-[18px] border text-xs ${isDark ? "bg-[rgba(239,68,68,.10)] border-[rgba(239,68,68,.28)] text-[#fca5a5]" : "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]"}`}
                  style={{ animation: "slideIn .25s ease" }}>
                  <AlertCircle size={13} className="flex-shrink-0 mt-px" />
                  <p className="m-0 flex-1 leading-[1.5]">{error}</p>
                  <button onClick={() => setError("")}
                    className="bg-transparent border-none cursor-pointer p-0 opacity-60"
                    style={{ color: "inherit" }}>
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="bg-transparent border-none cursor-pointer p-1 rounded-md"
                      style={{ color: isDark ? "rgba(255,255,255,.28)" : "#94a3b8" }}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  }
                />

                {/* Remember me */}
                <label className="flex items-center gap-2 cursor-pointer select-none -mt-0.5">
                  <button type="button" onClick={() => setRememberMe(!rememberMe)}
                    className="flex items-center justify-center flex-shrink-0 rounded cursor-pointer transition-all duration-150 p-0 border-0"
                    style={{
                      width: "16px", height: "16px", borderRadius: "4px",
                      border: `1.5px solid ${rememberMe ? "#3b82f6" : isDark ? "rgba(255,255,255,.18)" : "#cbd5e1"}`,
                      background: rememberMe ? "#3b82f6" : "transparent",
                    }}>
                    {rememberMe && <CheckCircle size={9} color="#fff" />}
                  </button>
                  <span className="text-xs" style={{ color: subtext }}>Remember me</span>
                </label>

                {/* Sign In button */}
                <button type="submit" disabled={signingIn}
                  className="h-[52px] rounded-xl border-none text-white text-sm font-semibold tracking-[0.2px] flex items-center justify-center gap-2 transition-all duration-200 mt-1"
                  style={{
                    background: signingIn
                      ? "#2563eb"
                      : "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: signingIn ? "not-allowed" : "pointer",
                    boxShadow: signingIn ? "none" : "0 8px 24px rgba(59,130,246,.35)",
                    opacity: signingIn ? 0.80 : 1,
                  }}>
                  {signingIn
                    ? <><Loader2 size={15} style={{ animation: "spinSlow .8s linear infinite" }} />Signing in…</>
                    : <>Sign In <ArrowRight size={14} /></>
                  }
                </button>
              </form>
            </div>

            {/* Footer: version + help tooltip */}
            <div className="mt-5 pt-3.5 relative flex justify-center items-center">
              <span className="text-[10px] font-medium tracking-[0.3px] flex items-center gap-[5px]"
                style={{ fontFamily: "'DM Sans', sans-serif", color: isDark ? "rgba(255,255,255,.28)" : "#94a3b8" }}>
                <Shield size={10} className="opacity-55" />
                RMS v0.0.1
              </span>

              {/* Help tooltip */}
              <div className="tooltip-hover absolute right-0" style={{ lineHeight: 0 }}>
                <HelpCircle
                  size={17} strokeWidth={1.6}
                  style={{ color: isDark ? "rgba(255,255,255,.30)" : "#94a3b8", transition: "color .15s" }}
                />
                <div className="tooltip-text">
                  <strong style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: "#f1f5f9" }}>
                    Need help?
                  </strong>
                  <span style={{ opacity: 0.75 }}>• No account yet?</span> Contact your system administrator.
                  <br />
                  <span style={{ opacity: 0.75 }}>• Forgot password?</span> Reach out to support or reset via admin.
                  <br />
                  <span style={{ opacity: 0.75 }}>• First-time login?</span> Use your temporary password.
                </div>
              </div>
            </div>
          </div>
        </div>

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

      {/* Password-change modal */}
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