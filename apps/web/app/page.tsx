"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Crown, Check, Minus } from "lucide-react";
import s from "./landing.module.css";
import FeatureShowcase from "@/components/landing/FeatureShowcase";

const HeroScene = dynamic(() => import("@/components/landing/HeroScene"), {
  ssr: false,
});

/* Adds `s.in` to every [data-reveal] child once it enters the viewport. */
function useReveal(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add(s.in);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [ref]);
}

const DEMO_LINES = [
  "I found my rhythm in the terminal glow",
  "Every word arrives right when I need it",
  "Green on black, the chorus starts to show",
  "Sing it back before the beat concedes it",
];

function LyricDemo() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setActive((a) => (a + 1) % DEMO_LINES.length),
      1800
    );
    return () => clearInterval(timer);
  }, []);

  const pct = ((active + 1) / DEMO_LINES.length) * 100;

  return (
    <div className={`${s.demoCard} ${s.reveal}`} data-reveal>
      <div className={s.demoTitlebar}>
        <span className={s.dot} />
        <span className={s.dot} />
        <span className={`${s.dot} ${s.dotGreen}`} />
        <span style={{ marginLeft: "0.5rem" }}>
          kant_sing — now playing
        </span>
      </div>
      <div className={s.demoBody}>
        {DEMO_LINES.map((line, i) => (
          <p
            key={line}
            className={`${s.demoLine} ${i === active ? s.demoLineActive : ""}`}
          >
            {line}
          </p>
        ))}
      </div>
      <div className={s.demoProgress}>
        <div className={s.demoProgressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STEPS = [
  {
    name: "Connect Spotify",
    text: "One click, standard Spotify OAuth. We never see your password — Spotify hands us a scoped token and nothing more.",
  },
  {
    name: "Play anything",
    text: "Start a track in any Spotify app. Kant_Sing picks it up within a couple of seconds and pulls the matching lyrics.",
  },
  {
    name: "Sing along",
    text: "The active line glows and scrolls as the song plays. Seek around the track and the lyrics stay locked on.",
  },
];

const FAQS = [
  {
    q: "Is Kant_Sing free?",
    a: "Yes. Kant_Sing itself costs nothing. You sign in with whatever Spotify account you already have — Free or Premium.",
  },
  {
    q: "Do you store my Spotify password?",
    a: "No. Login happens on spotify.com through OAuth. We receive a scoped access token, which we use only to read your playback state and send the player commands you trigger.",
  },
  {
    q: "Why do playback controls need Spotify Premium?",
    a: "Spotify's API only accepts remote playback commands (play, pause, skip, seek) from Premium accounts — that's Spotify's rule, not ours. On a Free account you still get live synced lyrics for whatever is playing.",
  },
  {
    q: "Where do the lyrics come from?",
    a: "From lrclib, an open, community-maintained lyrics database. When a track has no time-synced entry we fall back to plain text, and say so rather than pretending.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={s.faqList}>
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          // The reveal class lives on this wrapper, whose className React
          // never rewrites — putting it on the item below would wipe the
          // observer-added "in" class every time faqOpen toggles.
          <div
            key={f.q}
            className={s.reveal}
            data-reveal
            style={{ "--d": `${i * 0.06}s` } as React.CSSProperties}
          >
            <div className={`${s.faqItem} ${isOpen ? s.faqOpen : ""}`}>
              <button
                type="button"
                className={s.faqQ}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                {f.q}
              </button>
              <div className={s.faqAnswer}>
                <div className={s.faqAnswerInner}>
                  <p className={s.faqBody}>{f.a}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [authed, setAuthed] = useState(false);

  useReveal(pageRef);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Returning users with a live session get "open app" CTAs instead of login.
  useEffect(() => {
    fetch("/api/me")
      .then((res) => setAuthed(res.ok))
      .catch(() => {});
  }, []);

  const appHref = authed ? "/player" : "/api/auth/login";
  const heroCta = authed ? "Open the player" : "Continue with Spotify";

  return (
    <div ref={pageRef} className={s.page}>
      <nav className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}>
        <a href="#" className={s.wordmark}>
          Kant_Sing<span className={s.cursor} />
        </a>
        <div className={s.navLinks}>
          <a href="#features" className={s.navLink}>
            features
          </a>
          <a href="#how" className={s.navLink}>
            how it works
          </a>
          <a href="#pricing" className={s.navLink}>
            pricing
          </a>
          <a href="#faq" className={s.navLink}>
            faq
          </a>
          <a href={authed ? "/player" : "/login"} className={s.navCta}>
            {authed ? "open app" : "log in"}
          </a>
        </div>
      </nav>

      <header className={s.hero}>
        <HeroScene />
        <div className={s.heroInner}>
          <p className={`${s.heroKicker} ${s.reveal}`} data-reveal>
            {"// karaoke for your terminal soul"}
          </p>
          <h1
            className={`${s.heroTitle} ${s.reveal}`}
            data-reveal
            style={{ "--d": "0.08s" } as React.CSSProperties}
          >
            Every word.
            <br />
            <span className={s.heroTitleAccent}>Right on time.</span>
          </h1>
          <p
            className={`${s.heroSub} ${s.reveal}`}
            data-reveal
            style={{ "--d": "0.16s" } as React.CSSProperties}
          >
            Kant_Sing turns whatever your Spotify is playing into live,
            time-synced lyrics — with full playback control, on any device,
            in a clean terminal-green glow.
          </p>
          <div
            className={`${s.heroActions} ${s.reveal}`}
            data-reveal
            style={{ "--d": "0.24s" } as React.CSSProperties}
          >
            <a href={appHref} className={s.btnPrimary}>
              {heroCta}
            </a>
            <a href="#demo" className={s.btnGhost}>
              See it in action
            </a>
          </div>
          <p
            className={`${s.heroFootnote} ${s.reveal}`}
            data-reveal
            style={{ "--d": "0.32s" } as React.CSSProperties}
          >
            Works with Spotify Free and Premium. No password shared, ever.
          </p>
        </div>
        <span className={s.scrollHint}>SCROLL</span>
      </header>

      <section id="demo" className={s.section}>
        <p className={`${s.sectionKicker} ${s.reveal}`} data-reveal>
          $ kant_sing --demo
        </p>
        <h2 className={`${s.sectionTitle} ${s.reveal}`} data-reveal>
          Lyrics that keep up with the song
        </h2>
        <LyricDemo />
      </section>

      <FeatureShowcase />

      <section id="how" className={s.section}>
        <p className={`${s.sectionKicker} ${s.reveal}`} data-reveal>
          $ kant_sing --how
        </p>
        <h2 className={`${s.sectionTitle} ${s.reveal}`} data-reveal>
          Three steps, no setup
        </h2>
        <div className={s.steps}>
          {STEPS.map((step, i) => (
            <div
              key={step.name}
              className={`${s.step} ${s.reveal}`}
              data-reveal
              style={{ "--d": `${i * 0.1}s` } as React.CSSProperties}
            >
              <p className={s.stepNum}>STEP 0{i + 1}</p>
              <h3 className={s.stepName}>{step.name}</h3>
              <p className={s.stepText}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className={s.section}>
        <p className={`${s.sectionKicker} ${s.reveal}`} data-reveal>
          $ kant_sing --pricing
        </p>
        <h2 className={`${s.sectionTitle} ${s.reveal}`} data-reveal>
          Free app. Your Spotify tier sets the ceiling.
        </h2>
        <div className={s.tiers}>
          <div className={`${s.tier} ${s.reveal}`} data-reveal>
            <span className={s.tierBadgeFree}>Free</span>
            <p className={s.tierPrice}>
              $0 <span className={s.tierPriceNote}>with Spotify Free</span>
            </p>
            <ul className={s.tierList}>
              <li>
                <Check size={14} className={s.tick} />
                Live time-synced lyrics for every track
              </li>
              <li>
                <Check size={14} className={s.tick} />
                Now-playing from any of your devices
              </li>
              <li>
                <Check size={14} className={s.tick} />
                Album art, progress, and device info
              </li>
              <li>
                <Minus size={14} className={s.tickMuted} />
                In-app playback control (a Spotify API limit)
              </li>
            </ul>
            <a href={appHref} className={s.btnGhost}>
              Start free
            </a>
          </div>
          <div
            className={`${s.tier} ${s.tierPremium} ${s.reveal}`}
            data-reveal
            style={{ "--d": "0.1s" } as React.CSSProperties}
          >
            <span className={s.tierBadgePremium}>
              <Crown size={11} /> Premium
            </span>
            <p className={s.tierPrice}>
              $0 <span className={s.tierPriceNote}>with Spotify Premium</span>
            </p>
            <ul className={s.tierList}>
              <li>
                <Check size={14} className={s.tick} />
                Everything in Free
              </li>
              <li>
                <Check size={14} className={s.tick} />
                Play, pause, skip, and seek from the lyrics screen
              </li>
              <li>
                <Check size={14} className={s.tick} />
                Shuffle, repeat, and volume control
              </li>
              <li>
                <Check size={14} className={s.tick} />
                Gold tier badge on your profile
              </li>
            </ul>
            <a href={appHref} className={s.btnPrimary}>
              Connect Premium
            </a>
          </div>
        </div>
      </section>

      <section id="faq" className={s.section}>
        <p className={`${s.sectionKicker} ${s.reveal}`} data-reveal>
          $ kant_sing --faq
        </p>
        <h2 className={`${s.sectionTitle} ${s.reveal}`} data-reveal>
          Questions, answered straight
        </h2>
        <Faq />
      </section>

      <section className={s.ctaBand}>
        <div className={s.ctaGlow} />
        <h2 className={`${s.ctaTitle} ${s.reveal}`} data-reveal>
          Press play. We&apos;ll handle the words.
        </h2>
        <div className={s.reveal} data-reveal style={{ position: "relative" }}>
          <a href={appHref} className={s.btnPrimary}>
            {heroCta}
          </a>
        </div>
      </section>

      <footer className={s.footer}>
        <span className={s.footerNote}>
          Kant_Sing — not affiliated with Spotify AB. Lyrics via lrclib.
        </span>
        <div className={s.footerLinks}>
          <a href="#features">features</a>
          <a href="#pricing">pricing</a>
          <a href="/login">log in</a>
        </div>
      </footer>
    </div>
  );
}
