import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RatingScreen from "../components/RatingScreen";
import BreathingCircle from "../components/BreathingCircle";
import "./onboarding.css";

const PREVIEW_SECONDS = 60;

export default function PreviewPage() {
  const previewRef = useRef(null);
  const [step, setStep] = useState("intro");
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (step === "intro") return;
    const heading = previewRef.current?.querySelector("h1, h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }, [step]);
  useEffect(() => {
    if (step !== "breathe" || paused) return undefined;
    const timer = setInterval(() => setElapsed(value => Math.min(PREVIEW_SECONDS, value + 1)), 1000);
    return () => clearInterval(timer);
  }, [step, paused]);
  useEffect(() => {
    if (elapsed === PREVIEW_SECONDS) setStep("after");
  }, [elapsed]);
  const cycle = elapsed % 10;
  const remaining = PREVIEW_SECONDS - elapsed;
  const phase = cycle < 4 ? "Inhale" : cycle < 6 ? "Hold" : "Exhale";
  return (
    <div className="onboarding preview" ref={previewRef}>
      <p className="home-eyebrow">RESET · Guided preview</p>
      <nav className="onboarding-actions" aria-label="Preview navigation">
        <Link to="/">Exit Preview &amp; Return to Landing Page</Link>
        <Link className="onboarding-primary" to="/start?intent=trial">Start My 7-Day Free Trial</Link>
      </nav>
      {step === "intro" && <section>
        <h1>Take a short breathing break</h1>
        <p>Try 60 seconds of guided breathing, with optional stress ratings before and afterward. This preview includes only breathing. Nothing is saved and no trial starts here. Breathe comfortably; you can finish or leave at any time.</p>
        <button className="onboarding-primary" onClick={() => setStep("before")}>Start Preview</button>
      </section>}
      {(step === "before" || step === "after") && <>
        <RatingScreen
          title={step === "before" ? "How stressed do you feel now?" : "How stressed do you feel afterward?"}
          description="Optional: choose a number from 0 (not at all) to 10 (extremely), or skip this rating."
          value={step === "before" ? before : after}
          onChange={step === "before" ? setBefore : setAfter}
          onContinue={() => setStep(step === "before" ? "breathe" : "results")}
        />
        <button onClick={() => setStep(step === "before" ? "breathe" : "results")}>Skip this rating</button>
      </>}
      {step === "breathe" && <section>
        <h1>Breathe at a comfortable pace</h1>
        <div className="preview-breath">
          <BreathingCircle phase={phase} timer={cycle < 4 ? 4 - cycle : cycle < 6 ? 6 - cycle : 10 - cycle} />
        </div>
        <p>{paused ? "Paused · " : ""}<span>{remaining} {remaining === 1 ? "second" : "seconds"} remaining</span></p>
        <div className="onboarding-actions">
          <button onClick={() => setPaused(value => !value)}>{paused ? "Resume" : "Pause"}</button>
          <button onClick={() => setStep("after")}>Finish &amp; Rate</button>
        </div>
      </section>}
      {step === "results" && <section>
        <h1>Your preview check-in</h1>
        <p>Stress before: {before === null ? "Skipped" : `${before}/10`} · Stress afterward: {after === null ? "Skipped" : `${after}/10`}</p>
        <p>There’s no right result. This is a brief check-in with how you feel.</p>
        <h2>Explore more with RESET</h2>
        <p>Your trial opens the full application. These features are not part of the anonymous preview.</p>
        <div className="preview-features">
          <article>
            <h3>Guided acupressure</h3>
            <p>Follow visual guidance for acupressure exercises at your own pace.</p>
          </article>
          <article>
            <h3>Craving and stress support</h3>
            <p>Explore craving check-ins, guided breathing, and sensory grounding tools.</p>
          </article>
          <article>
            <h3>Your saved progress</h3>
            <p>Save completed sessions to your account and look back on your history.</p>
          </article>
        </div>
        <h2>Ready to make RESET part of your routine?</h2>
        <p>Start your free seven-day trial.</p>
        <Link className="onboarding-primary" to="/start?intent=trial">Start My 7-Day Free Trial</Link>
      </section>}
    </div>
  );
}
