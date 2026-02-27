import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./loginPage.css";

const carouselItems: string[] = [
  "Track Players",
  "View Team Stats",
  "Build Teams",
  "Compare Players",
  "Compare Teams",
  "Add Friends",
  "See How You Compare",
];

// Duplicate so the track is 2× one set wide — position resets by
// exactly one set width, making the loop visually seamless.
const duplicatedItems = [...carouselItems, ...carouselItems];

const AUTO_SCROLL_SPEED = 0.6; // px per frame (~36 px/s at 60 fps)
const RESUME_DELAY_MS   = 1200; // ms after last wheel event before auto-scroll resumes

export default function LoginPage() {
  const navigate = useNavigate();

  const trackRef        = useRef<HTMLDivElement>(null);
  const sectionRef      = useRef<HTMLElement>(null);
  const positionRef     = useRef(0);          // current translateX in px (≤ 0)
  const pausedRef       = useRef(false);
  const resumeTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const track   = trackRef.current;
    const section = sectionRef.current;
    if (!track || !section) return;

    // Half the track width = width of one full set of cards.
    // Normalising position into [-halfWidth, 0) keeps the loop seamless.
    const halfWidth = () => track.scrollWidth / 2;

    const normalise = () => {
      const h = halfWidth();
      if (positionRef.current <= -h) positionRef.current += h;
      if (positionRef.current  >  0) positionRef.current -= h;
    };

    // ── Auto-scroll ticker ───────────────────────────────────────────
    let rafId: number;

    const tick = () => {
      if (!pausedRef.current) {
        positionRef.current -= AUTO_SCROLL_SPEED;
        normalise();
      }
      track.style.transform = `translateX(${positionRef.current}px)`;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    // ── Wheel handler ────────────────────────────────────────────────
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // stop page scroll while cursor is over carousel

      // Pause auto-scroll; restart the resume timer on every wheel event
      pausedRef.current = true;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
      }, RESUME_DELAY_MS);

      // Prefer horizontal delta (trackpad swipe); fall back to vertical
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      positionRef.current -= delta;
      normalise();
    };

    // Must use addEventListener (not onWheel) to pass { passive: false }
    section.addEventListener("wheel", handleWheel, { passive: false });

    // Resume auto-scroll the moment the cursor leaves the carousel
    const handleMouseLeave = () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      pausedRef.current = false;
    };
    section.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(rafId);
      section.removeEventListener("wheel", handleWheel);
      section.removeEventListener("mouseleave", handleMouseLeave);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  return (
    <div className="login-page">
      <div className="login-glow" />

      <header className="login-header">
        <p className="login-welcome">Welcome To</p>
        <h1 className="login-title">Ballerz</h1>

        <div className="login-actions">
          <div className="login-action-group">
            <span className="login-action-label">New users</span>
            <button className="login-btn" type="button">
              Get Started
            </button>
          </div>
          <div className="login-action-group">
            <span className="login-action-label">Existing Users</span>
            <button
              className="login-btn"
              type="button"
              onClick={() => navigate("/")}
            >
              Login
            </button>
          </div>
        </div>
      </header>

      <section
        ref={sectionRef}
        className="carousel-section"
        aria-label="Feature highlights"
      >
        <div ref={trackRef} className="carousel-track">
          {duplicatedItems.map((title, i) => (
            <div key={i} className="carousel-card">
              <span className="carousel-card-title">{title}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
