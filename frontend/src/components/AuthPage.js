// src/pages/AuthPage.js
// Split-card · Image left panel · Clean right form
// Uses the shared design system in src/design-system.jsx.
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Eye, EyeOff, Lock, X, KeyRound,
  AlertCircle, CheckCircle, Shield, ShieldCheck, ArrowRight,
  Loader2, User, LayoutDashboard, Users, BarChart3,
} from "lucide-react";

/* ── Design system (one import does it all) ──────────────────────── */
import {
  PALETTE,
  useTokens,
  DesignPage,
  GlassCard,
  Field,
  StrengthMeter,
  ThemeToggle,
  PrimaryButton,
} from "../design-system";

import Rebate from "../assets/Rebate.png";

const API_BASE = "/api";
const DB_NAME  = "USER";

/* ─── Carousel slides ─────────────────────────────────────────────── */
const CAROUSEL_SLIDES = [
  {
    heading:     "Simplify Rebate\nManagement",
    description: "Manage rebate centralized records with flexible configuration and full audit trails.",
    accent:      PALETTE.blue,
    icon:        <LayoutDashboard size={22} strokeWidth={1.7} />,
  },
  {
    heading:     "Track Customers\nEarned Rebates Instantly",
    description: "Monitor customer earned rebates, payout progress, and rebate balances in real time.",
    accent:      PALETTE.purple,
    icon:        <Users size={22} strokeWidth={1.7} />,
  },
  {
    heading:     "View Customers\nReports",
    description: "Access detailed customer rebate reports, summaries, and transaction insights easily.",
    accent:      PALETTE.green,
    icon:        <BarChart3 size={22} strokeWidth={1.7} />,
  },
];
const SLIDE_DURATION = 4000;

/* ─── Left decorative panel ──────────────────────────────────────── */
function BrandPanel() {
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
      style={{ background: "linear-gradient(160deg, #050b18 0%, #0a1730 30%, #0d0a2e 60%, #050b18 100%)" }}>

      {/* Ambient blob 1 — blue */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "10%", left: "5%", width: "70%", height: "65%",
          background: "radial-gradient(ellipse at 40% 40%, rgba(10,132,255,.55) 0%, rgba(10,132,255,.22) 35%, transparent 70%)",
          filter: "blur(52px)", animation: "floatBlob 9s ease-in-out infinite",
        }} />

      {/* Ambient blob 2 — purple */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "20%", left: "20%", width: "65%", height: "60%",
          background: "radial-gradient(ellipse at 55% 55%, rgba(191,90,242,.50) 0%, rgba(191,90,242,.22) 40%, transparent 72%)",
          filter: "blur(56px)", animation: "floatBlob2 11s ease-in-out infinite",
        }} />

      {/* Ambient blob 3 — soft blue glow */}
      <div className="absolute pointer-events-none rounded-full"
        style={{
          top: "30%", left: "-8%", width: "55%", height: "50%",
          background: "radial-gradient(ellipse at 50% 50%, rgba(10,132,255,.35) 0%, transparent 68%)",
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
        <span className="text-[13px] font-bold text-white/85 tracking-[0.2px]">
          Rebate Management System
        </span>
      </div>

      {/* Central swirl */}
      <div className="absolute pointer-events-none z-[2]"
        style={{ top: "8%", left: "50%", transform: "translateX(-50%)", width: "300px", height: "300px" }}>
        <div className="absolute rounded-full"
          style={{ inset: "-10px", background: `radial-gradient(circle, ${PALETTE.blue}2e 0%, transparent 70%)`, filter: "blur(16px)" }} />
        <div className="absolute rounded-full"
          style={{ inset: "10px", background: `conic-gradient(from 0deg, ${PALETTE.blue}00 0deg, ${PALETTE.blue}d9 90deg, ${PALETTE.blue}b3 160deg, ${PALETTE.blue}00 200deg, ${PALETTE.blue}00 360deg)`, filter: "blur(3px)", animation: "swirl 8s linear infinite", opacity: 0.85 }} />
        <div className="absolute rounded-full"
          style={{ inset: "28px", background: `conic-gradient(from 120deg, ${PALETTE.purple}00 0deg, ${PALETTE.purple}cc 80deg, ${PALETTE.purple}99 150deg, ${PALETTE.purple}00 200deg, ${PALETTE.purple}00 360deg)`, filter: "blur(3.5px)", animation: "swirlRv 10s linear infinite", opacity: 0.80 }} />
        <div className="absolute rounded-full"
          style={{ inset: "52px", background: `conic-gradient(from 240deg, ${PALETTE.purple}00 0deg, ${PALETTE.purple}a6 70deg, ${PALETTE.purple}80 130deg, ${PALETTE.purple}00 190deg, ${PALETTE.purple}00 360deg)`, filter: "blur(4px)", animation: "swirl 12s linear infinite", opacity: 0.70 }} />
        <div className="absolute rounded-full"
          style={{ inset: "80px", background: "radial-gradient(circle at 38% 38%, rgba(220,240,255,.22) 0%, rgba(120,180,255,.08) 50%, transparent 75%)", backdropFilter: "blur(1px)" }} />
        <div className="absolute rounded-full bg-white/[0.06]"
          style={{ inset: "130px" }} />
      </div>

      {/* Dark gradient scrim */}
      <div className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none"
        style={{ height: "55%", background: "linear-gradient(to bottom, transparent 0%, rgba(5,10,25,.82) 55%, rgba(5,10,25,.97) 100%)" }} />

      {/* Bottom carousel */}
      <div className="relative z-10 w-full">
        <div style={{ minHeight: "108px", animation: textAnimation }}>
          {/* Icon pill */}
          <div className="inline-flex items-center gap-[7px] rounded-[999px] mb-[10px]"
            style={{
              background: "rgba(255,255,255,.07)",
              border: `1px solid ${slide.accent}44`,
              padding: "5px 12px 5px 8px",
            }}>
            <div style={{ color: slide.accent }} className="flex items-center justify-center">
              {React.cloneElement(slide.icon, { size: 15, strokeWidth: 1.8 })}
            </div>
            <span className="text-[10px] font-semibold tracking-[0.4px] uppercase"
              style={{ color: slide.accent }}>
              {currentSlide === 0 ? "Management" : currentSlide === 1 ? "Tracking" : "Reports"}
            </span>
          </div>

          {/* Heading */}
          <h2 className="m-0 mb-2 text-white whitespace-pre-line"
            style={{
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

/* ─── Slim top progress bar ─────────────────────────────────────── */
/*  active      → bar is rendered
 *  completing  → grows to 100% (after successful login)
 *  idle        → slowly grows to ~72% while we wait for the API
 */
function TopProgressBar({ active, completing }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!active) { setMounted(false); return; }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "5px",
        zIndex: 2147483647,   // guaranteed on top
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: mounted ? (completing ? "100%" : "72%") : "0%",
          background: `linear-gradient(90deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`,
          boxShadow: `0 0 14px 2px ${PALETTE.blue}cc, 0 0 4px ${PALETTE.purple}cc`,
          borderRadius: "0 4px 4px 0",
          transition: completing
            ? "width .55s cubic-bezier(.4,0,.2,1)"
            : "width 4.5s cubic-bezier(.1,.55,.35,1)",
        }}
      />
    </div>
  );
}

/* ─── Password-change modal ──────────────────────────────────────── */
function PasswordChangeModal({
  tempResult, userCode,
  newPwd, setNewPwd, confirmPwd, setConfirmPwd,
  showNewPwd, setShowNewPwd, showConfirmPwd, setShowConfirmPwd,
  pwdError, changing, onSubmit, onClose,
}) {
  const { isDark, K } = useTokens();

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,24,0.65)", backdropFilter: "blur(12px)" }}>
      <div
        className="ds-glass ds-pop w-[min(440px,100%)] rounded-[22px] overflow-hidden"
        style={{
          background: K.glassDeep,
          border: `1px solid ${K.rim}`,
          boxShadow: K.shadow,
        }}
      >
        {/* Gradient header banner */}
        <div className="relative overflow-hidden px-6 pt-6 pb-5"
          style={{ background: `linear-gradient(135deg, ${PALETTE.blue} 0%, #6d5be0 55%, ${PALETTE.purple} 100%)` }}>
          <div className="pointer-events-none absolute -top-[35%] -left-[10%] w-[60%] h-[150%] rounded-full blur-[28px]"
            style={{ background: "radial-gradient(ellipse,rgba(255,255,255,0.22) 0%,transparent 68%)", animation: "floatBlob 8s ease-in-out infinite" }} />
          <div className="pointer-events-none absolute -bottom-[45%] -right-[12%] w-[58%] h-[140%] rounded-full blur-[26px]"
            style={{ background: "radial-gradient(ellipse,rgba(191,90,242,0.55) 0%,transparent 70%)", animation: "floatBlob2 10s ease-in-out infinite" }} />

          <button
            type="button"
            onClick={onClose}
            disabled={changing}
            className="absolute top-3.5 right-3.5 z-[3] w-[26px] h-[26px] rounded-lg flex items-center justify-center border"
            style={{
              background: "rgba(255,255,255,.12)",
              borderColor: "rgba(255,255,255,.18)",
              cursor: changing ? "not-allowed" : "pointer",
              opacity: changing ? 0.5 : 1,
            }}
          >
            <X size={12} className="text-white/[0.85]" />
          </button>

          <div className="relative z-[2] w-[42px] h-[42px] rounded-[13px] flex items-center justify-center mb-3.5 border"
            style={{ background: "rgba(255,255,255,.14)", borderColor: "rgba(255,255,255,.24)", backdropFilter: "blur(8px)" }}>
            <ShieldCheck size={19} className="text-white" strokeWidth={1.8} />
          </div>

          <div className="relative z-[2] inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 mb-2.5 border"
            style={{ background: "rgba(255,255,255,.12)", borderColor: "rgba(255,255,255,.20)" }}>
            <Lock size={10} className="text-[#cfd8ff]" />
            <span className="text-[9.5px] font-bold text-[#eef0ff] tracking-[0.5px] uppercase">
              Security Required
            </span>
          </div>

          <h2 className="relative z-[2] m-0 mb-1 text-[18px] font-extrabold text-white tracking-[-0.2px]">
            Set a New Password
          </h2>
          <p className="relative z-[2] m-0 text-[12px] text-white/[0.75] leading-[1.55] max-w-[320px]">
            This is a first-time login. Please create a new password to continue.
          </p>
        </div>

        {/* User chip */}
        <div className="mt-[18px] mx-6 px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5"
          style={{ background: K.chipBg, borderColor: K.hairline }}>
          <div className="w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center text-[13px] font-bold border"
            style={{
              background: `${PALETTE.blue}1c`,
              borderColor: `${PALETTE.blue}33`,
              color: PALETTE.blue,
            }}>
            {(tempResult.user?.DisplayName || userCode).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="m-0 mb-px text-xs font-semibold truncate" style={{ color: K.ink }}>
              {tempResult.user?.DisplayName || userCode}
            </p>
            <p className="m-0 text-[10px]" style={{ color: K.muted }}>
              ID: {tempResult.user?.User_ID}
            </p>
          </div>
          <span className="text-[9px] font-bold tracking-[0.4px] uppercase px-2 py-1 rounded-full border"
            style={{
              color: PALETTE.green,
              background: `${PALETTE.green}14`,
              borderColor: `${PALETTE.green}33`,
            }}>
            First Login
          </span>
        </div>

        {/* Body / form */}
        <div className="px-6 pt-4 pb-6 flex flex-col gap-3">
          {pwdError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-xs border"
              style={{
                background: `${PALETTE.red}14`,
                borderColor: `${PALETTE.red}33`,
                color: PALETTE.red,
              }}>
              <AlertCircle size={12} className="flex-shrink-0" />
              {pwdError}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <Field
                label="New Password" icon={Lock}
                type={showNewPwd ? "text" : "password"}
                value={newPwd} onChange={e => setNewPwd(e.target.value)}
                disabled={changing} placeholder="Min. 6 characters" autoComplete="new-password"
                right={
                  <button
                    type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                    className="bg-transparent border-0 cursor-pointer p-1"
                    style={{ color: K.faint }}
                  >
                    {showNewPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                }
              />
              <StrengthMeter password={newPwd} />
            </div>

            <div>
              <Field
                label="Confirm Password" icon={KeyRound}
                type={showConfirmPwd ? "text" : "password"}
                value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                disabled={changing} placeholder="Repeat password" autoComplete="new-password"
                right={
                  <button
                    type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="bg-transparent border-0 cursor-pointer p-1"
                    style={{ color: K.faint }}
                  >
                    {showConfirmPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                }
              />
              {confirmPwd.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {newPwd === confirmPwd ? (
                    <>
                      <CheckCircle size={11} style={{ color: PALETTE.green }} />
                      <span className="text-[11px] font-medium" style={{ color: PALETTE.green }}>Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X size={11} style={{ color: PALETTE.red }} />
                      <span className="text-[11px] font-medium" style={{ color: PALETTE.red }}>Passwords don't match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Requirements checklist */}
            <div className="px-3 py-2.5 rounded-[10px] border flex flex-col gap-2"
              style={{ background: K.chipBg, borderColor: K.hairline }}>
              {[
                { ok: newPwd.length >= 6,                           label: "At least 6 characters" },
                { ok: newPwd === confirmPwd && newPwd.length > 0,   label: "Passwords match" },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-200"
                    style={{ background: ok ? PALETTE.green : (isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0") }}>
                    {ok && <CheckCircle size={9} className="text-white" />}
                  </div>
                  <span className="text-[11px]" style={{ color: ok ? PALETTE.green : K.muted, fontWeight: ok ? 500 : 400 }}>
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
                className="flex-1 h-11 rounded-[12px] bg-transparent text-[12.5px] font-semibold transition-all"
                style={{
                  border: `1px solid ${K.hairline}`,
                  color: K.muted,
                  cursor: changing ? "not-allowed" : "pointer",
                  opacity: changing ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={changing}
                className="flex-1 h-11 rounded-[12px] border-0 text-white text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background: `linear-gradient(155deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`,
                  boxShadow: changing ? "none" : `0 4px 16px -6px ${PALETTE.blue}88`,
                  cursor: changing ? "not-allowed" : "pointer",
                  opacity: changing ? 0.7 : 1,
                }}
              >
                {changing
                  ? <><Loader2 size={13} style={{ animation: "spinSlow .8s linear infinite" }} />Saving…</>
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

/* ─── Main component ─────────────────────────────────────────────── */
export default function Login() {
  const { theme, isDark, updateTheme, K } = useTokens();
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
    saving: false, saved: false, error: false,
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    const rem = localStorage.getItem("rememberedUser");
    if (rem) { setUserCode(rem); setRememberMe(true); }
    const lastTheme = localStorage.getItem("lastActiveTheme") || localStorage.getItem("userTheme");
    if (lastTheme && lastTheme !== theme) updateTheme(lastTheme);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

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

    // Show the slim top bar completing, then navigate.
    setTransitioning(true);
    await new Promise(resolve => setTimeout(resolve, 900));
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

  return (
    <>
      {/* Slim top progress bar — shows during sign-in AND during the transition */}
      <TopProgressBar active={signingIn || transitioning} completing={transitioning} />

      <DesignPage className="flex items-center justify-center relative">

        {/* Aurora wash */}
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `
              radial-gradient(700px circle at 8% 0%, ${PALETTE.blue}${isDark ? "26" : "30"}, transparent 55%),
              radial-gradient(650px circle at 92% 10%, ${PALETTE.purple}${isDark ? "1a" : "20"}, transparent 55%),
              radial-gradient(900px circle at 50% 100%, ${PALETTE.blue}${isDark ? "14" : "1a"}, transparent 60%)
            `,
          }} />

        {/* Theme toggle */}
        <ThemeToggle onToggle={handleThemeToggle} status={themeSaveStatus} />

        {/* ══ SPLIT CARD ══ */}
        <GlassCard
          className="relative z-10 flex overflow-hidden transition-all duration-[550ms]"
          style={{
            width: "min(880px, calc(100vw - 32px))",
            minHeight: "520px",
            opacity:   mounted ? 1 : 0,
            transform: mounted ? "translateY(0) scale(1)" : "translateY(22px) scale(.98)",
          }}>

          {/* LEFT panel */}
          <div className="hidden sm:block flex-shrink-0 min-h-[520px]" style={{ width: "42%" }}>
            <BrandPanel />
          </div>

          {/* RIGHT: login form */}
          <div className="flex-1 flex flex-col relative overflow-hidden ds-scroll"
            style={{ background: K.panel, padding: "48px 44px" }}>

            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              style={{ background: `linear-gradient(90deg, transparent, ${PALETTE.blue}55, transparent)` }} />

            {/* Mobile logo row */}
            <div className="flex sm:hidden items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
                style={{
                  background: `${PALETTE.blue}14`,
                  borderColor: `${PALETTE.blue}33`,
                }}>
                <img src={Rebate} alt="Logo" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight" style={{ color: K.ink }}>
                  Rebate Management System
                </div>
                <div className="flex items-center gap-[5px] mt-1">
                  <span className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: PALETTE.green, animation: "pulse2 2s ease-in-out infinite" }} />
                  <span className="text-[10px]" style={{ color: K.muted }}>Secure portal · v1.0</span>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col justify-center">

              {/* Header */}
              <div className="mb-7">
                <h1 className="m-0 mb-1.5 font-bold tracking-[-0.4px] leading-tight relative z-[5]"
                  style={{
                    fontSize: "26px",
                    color: K.ink,
                  }}>
                  Welcome!
                </h1>
                <p className="m-0 text-[13px] font-normal relative z-[5]"
                  style={{ color: K.muted }}>
                  Sign in to your RMS account to continue
                </p>
              </div>

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl mb-[18px] border text-xs"
                  style={{
                    background: `${PALETTE.red}14`,
                    borderColor: `${PALETTE.red}33`,
                    color: PALETTE.red,
                    animation: "slideIn .25s ease",
                  }}>
                  <AlertCircle size={13} className="flex-shrink-0 mt-px" />
                  <p className="m-0 flex-1 leading-[1.5]">{error}</p>
                  <button onClick={() => setError("")}
                    className="bg-transparent border-none cursor-pointer p-0 opacity-70"
                    style={{ color: "inherit" }}>
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <Field
                  label="Username" icon={User}
                  value={userCode} onChange={e => setUserCode(e.target.value)}
                  disabled={signingIn} placeholder="Enter your user ID" autoComplete="username"
                />
                <Field
                  label="Password" icon={Lock}
                  type={showPwd ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  disabled={signingIn} placeholder="••••••••" autoComplete="current-password"
                  right={
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="bg-transparent border-none cursor-pointer p-1 rounded-md"
                      style={{ color: K.faint }}>
                      {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  }
                />

                {/* Remember me */}
                <label className="flex items-center gap-2 cursor-pointer select-none -mt-0.5">
                  <button type="button" onClick={() => setRememberMe(!rememberMe)}
                    className="flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-150 p-0 border-0"
                    style={{
                      width: "16px", height: "16px", borderRadius: "4px",
                      border: `1.5px solid ${rememberMe ? PALETTE.blue : K.hairline}`,
                      background: rememberMe ? PALETTE.blue : "transparent",
                    }}>
                    {rememberMe && <CheckCircle size={9} color="#fff" />}
                  </button>
                  <span className="text-xs" style={{ color: K.muted }}>Remember me</span>
                </label>

                {/* Sign In button */}
                <PrimaryButton type="submit" loading={signingIn} className="mt-1">
                  {signingIn ? "Signing in…" : (<>Sign In <ArrowRight size={14} /></>)}
                </PrimaryButton>
              </form>
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3.5 flex justify-center items-center">
              <span className="text-[10px] font-medium tracking-[0.3px] flex items-center gap-[5px]"
                style={{ color: K.faint }}>
                <Shield size={10} className="opacity-55" />
                RMS v0.0.1
              </span>
            </div>
          </div>
        </GlassCard>
      </DesignPage>

      {/* Password-change modal */}
      {showModal && tempResult && (
        <PasswordChangeModal
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