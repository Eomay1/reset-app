import { useCallback, useEffect, useRef, useState } from "react";
import "./AcupressureExercise.css";

function AcupressureExercise({
  exerciseId,
  displayName,
  pointName,
  image,
  marker = { x: 50, y: 50 },
  markers,
  imageAlt,
  duration = 60,
  instructions,
  locationInstruction,
  safetyInstruction = "Use firm but comfortable pressure. Stop if you experience pain, numbness, dizziness, or unusual discomfort.",
  activeInstruction = "Apply firm but comfortable pressure with your thumb.",
  activeSupportingText,
  bilateral = false,
  requiresSideSwitch = false,
  showSideLabel = true,
  sideLabels = ["First wrist", "Opposite wrist"],
  completionText,
  onComplete,
  onExit
}) {
  const [view, setView] = useState("intro");
  const [sideIndex, setSideIndex] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [pulseCycle, setPulseCycle] = useState(0);
  const intervalRef = useRef(null);
  const activeSince = useRef(null);
  const activeMilliseconds = useRef(0);
  const intervalMilliseconds = useRef(0);
  const finished = useRef(false);

  // Measure running time, not time on the page or the nominal protocol length.
  // Cap each interval so delayed browser ticks cannot count transition time.
  const measureActiveTime = useCallback(() => {
    if (activeSince.current !== null) {
      const now = performance.now();
      const elapsed = Math.min(Math.max(0, now - activeSince.current), Math.max(0, duration * 1000 - intervalMilliseconds.current));
      activeMilliseconds.current += elapsed;
      intervalMilliseconds.current += elapsed;
      activeSince.current = intervalMilliseconds.current >= duration * 1000 ? null : now;
    }
    setRemaining(Math.max(0, Math.ceil(duration - intervalMilliseconds.current / 1000)));
  }, [duration]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRunning || view !== "active") {
      clearTimer();
      return undefined;
    }

    clearTimer();
    intervalRef.current = setInterval(() => {
      measureActiveTime();
    }, 1000);

    return clearTimer;
  }, [clearTimer, isRunning, view, sideIndex, pulseCycle, measureActiveTime]);

  useEffect(() => {
    if (view !== "active" || remaining !== 0) return;

    setIsRunning(false);
    clearTimer();

    const hasAnotherSide =
      bilateral && requiresSideSwitch && sideIndex < sideLabels.length - 1;
    setView(hasAnotherSide ? "switch" : "complete");
  }, [bilateral, clearTimer, remaining, requiresSideSwitch, sideIndex, sideLabels.length, view]);

  useEffect(() => clearTimer, [clearTimer]);

  const beginInterval = (nextSideIndex = sideIndex) => {
    measureActiveTime();
    clearTimer();
    setIsRunning(false);
    intervalMilliseconds.current = 0;
    activeSince.current = performance.now();
    setSideIndex(nextSideIndex);
    setRemaining(duration);
    setView("active");
    setPulseCycle((cycle) => cycle + 1);
    setIsRunning(true);
  };

  const togglePause = () => {
    if (isRunning) {
      measureActiveTime();
      activeSince.current = null;
      clearTimer();
    } else {
      activeSince.current = performance.now();
    }
    setIsRunning(!isRunning);
  };

  const finishAndRate = () => {
    if (finished.current) return;
    measureActiveTime();
    finished.current = true;
    activeSince.current = null;
    clearTimer();
    setIsRunning(false);
    const finalSide = !(bilateral && requiresSideSwitch) || sideIndex === sideLabels.length - 1;
    onComplete?.({
      activeDurationSeconds: Math.round(activeMilliseconds.current) / 1000,
      guidedSequenceCompleted: finalSide && intervalMilliseconds.current >= duration * 1000
    });
  };

  const exitExercise = () => {
    if (finished.current) return;
    finished.current = true;
    activeSince.current = null;
    clearTimer();
    setIsRunning(false);
    onExit?.();
  };

  const progress = ((duration - remaining) / duration) * 100;
  const activeMarkers = markers || [marker];

  return (
    <main className="acupressure-screen" data-exercise-id={exerciseId}>
      <section className="acupressure-card">
        {view === "intro" && (
          <>
            <header className="acupressure-header">
              <p className="acupressure-eyebrow">Guided acupressure</p>
              <h1>{displayName}</h1>
              <p className="acupressure-point-name">{pointName}</p>
              {bilateral && requiresSideSwitch && <p>The opposite wrist is optional. You can finish and rate at any time.</p>}
            </header>
            <div className="acupressure-intro-layout">
              <ExerciseImage image={image} displayName={displayName} imageAlt={imageAlt} />
              <div className="acupressure-copy">
                <p>{instructions}</p>
                <p>{locationInstruction}</p>
                <aside className="acupressure-safety-note">
                  <strong>Before you begin</strong>
                  <p>{safetyInstruction}</p>
                  <p>This exercise is for self-regulation support and is not a substitute for medical or emergency care.</p>
                </aside>
              </div>
            </div>
            <div className="acupressure-primary-actions">
              <button type="button" className="acupressure-button acupressure-button--primary" onClick={() => beginInterval(0)}>Start</button>
              <button type="button" className="acupressure-button acupressure-button--secondary" onClick={exitExercise}>Back</button>
            </div>
          </>
        )}

        {view === "active" && (
          <>
            <header className="acupressure-header">
              <p className="acupressure-eyebrow">{displayName}</p>
              <h1>{showSideLabel ? (sideLabels[sideIndex] || `Side ${sideIndex + 1}`) : displayName}</h1>
              <p>{activeInstruction}</p>
              {activeSupportingText && <p>{activeSupportingText}</p>}
            </header>
            <div className="acupressure-active-layout">
              <ExerciseImage image={image} displayName={displayName} imageAlt={imageAlt} markers={activeMarkers} pulse={isRunning} pulseCycle={pulseCycle} />
              <div className="acupressure-session-panel">
                <div className="acupressure-time" aria-live="polite">
                  <strong>{remaining}</strong>
                  <span>seconds remaining</span>
                </div>
                <div className="acupressure-progress" role="progressbar" aria-label={`${sideLabels[sideIndex]} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="acupressure-controls">
                  <button type="button" className="acupressure-button acupressure-button--primary" onClick={togglePause}>
                    {isRunning ? "Pause" : "Resume"}
                  </button>
                  <button type="button" className="acupressure-button acupressure-button--secondary" onClick={() => beginInterval(sideIndex)}>Restart</button>
                  <button type="button" className="acupressure-button acupressure-button--primary acupressure-finish" onClick={finishAndRate}>Finish &amp; Rate</button>
                  <button type="button" className="acupressure-button acupressure-button--exit" onClick={exitExercise}>Exit Without Saving</button>
                </div>
              </div>
            </div>
          </>
        )}

        {view === "switch" && (
          <div className="acupressure-transition" role="status">
            <h1>First wrist finished.</h1>
            <p>You can finish and rate now, or try the same point on your opposite wrist.</p>
            <button type="button" className="acupressure-button acupressure-button--secondary" onClick={() => beginInterval(sideIndex + 1)}>Continue with Opposite Wrist</button>
            <button type="button" className="acupressure-button acupressure-button--primary" onClick={finishAndRate}>Finish &amp; Rate</button>
            <button type="button" className="acupressure-button acupressure-button--exit" onClick={exitExercise}>Exit Without Saving</button>
          </div>
        )}

        {view === "complete" && (
          <div className="acupressure-transition" role="status">
            <h1>Nice work.</h1>
            <p>{completionText || `You completed ${displayName}${bilateral ? " on both wrists" : ""}.`}</p>
            <button type="button" className="acupressure-button acupressure-button--primary" onClick={finishAndRate}>Finish &amp; Rate</button>
            <button type="button" className="acupressure-button acupressure-button--exit" onClick={exitExercise}>Exit Without Saving</button>
          </div>
        )}
      </section>
    </main>
  );
}

function ExerciseImage({ image, displayName, imageAlt, markers = [], pulse = false, pulseCycle = 0 }) {
  return (
    <div className="acupressure-image-frame">
      <img src={image} alt={imageAlt || `${displayName} pressure-point location`} />
      {pulse && markers.map((currentMarker, index) => (
        <span
          key={`${pulseCycle}-${index}`}
          className="acupressure-pulse-active"
          aria-hidden="true"
          style={{ left: `${currentMarker.x}%`, top: `${currentMarker.y}%` }}
        />
      ))}
    </div>
  );
}

export default AcupressureExercise;
