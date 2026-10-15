import { useEffect, useRef, useState } from "react";
import "./AcupressureExercise.css";

const STEPS = [
  { count: 5, sense: "see", hint: "Look around and notice colors, shapes, or small details." },
  { count: 4, sense: "feel", hint: "Notice textures or contact, like your feet on the floor or clothing on your skin." },
  { count: 3, sense: "hear", hint: "Notice sounds nearby or in the distance." },
  { count: 2, sense: "smell", hint: "Notice scents around you. If none are available, you can skip this step." },
  { count: 1, sense: "taste", hint: "Notice a taste already in your mouth. You can skip this step if you prefer." }
];

export default function GroundingExercise({ onComplete, onExit }) {
  const [step, setStep] = useState(0);
  const [noticed, setNoticed] = useState([]);
  const heading = useRef(null);
  const finishing = useRef(false);
  const current = STEPS[step];
  useEffect(() => { heading.current?.focus(); }, [step]);

  const advance = () => {
    if (finishing.current) return;
    if (step === STEPS.length - 1) {
      finishing.current = true;
      onComplete();
    } else {
      setNoticed([]);
      setStep(step + 1);
    }
  };

  return (
    <main className="acupressure-screen">
      <section className="acupressure-card grounding-card">
        <header className="acupressure-header">
          <p className="acupressure-eyebrow">Grounding RESET · Step {step + 1} of 5</p>
          <h1 ref={heading} tabIndex={-1}>{current.count} {current.count === 1 ? "thing" : "things"} you can {current.sense}</h1>
          <p>{current.hint}</p>
          <p>Tap one square for each thing you notice. Take your time.</p>
        </header>
        <div className="acupressure-progress" role="progressbar" aria-label="Grounding steps" aria-valuemin={0} aria-valuemax={5} aria-valuenow={step}>
          <span style={{ width: `${step * 20}%` }} />
        </div>
        <div className="grounding-items">
          {Array.from({ length: current.count }, (_, index) => (
            <button key={`${step}-${index}`} type="button" aria-label={`Noticed item ${index + 1}`} aria-pressed={noticed.includes(index)}
              className={`mood-stress-button ${noticed.includes(index) ? "mood-stress-button--selected" : ""}`}
              onClick={() => setNoticed((items) => items.includes(index) ? items.filter((item) => item !== index) : [...items, index])}>
              {index + 1}
            </button>
          ))}
        </div>
        <p role="status">{noticed.length} of {current.count} noticed</p>
        <div className="acupressure-controls">
          <button type="button" className="acupressure-button acupressure-button--primary" disabled={noticed.length !== current.count} onClick={advance}>Continue</button>
          <button type="button" className="acupressure-button acupressure-button--secondary" onClick={advance}>Skip step</button>
          <button type="button" className="acupressure-button acupressure-button--exit" onClick={onExit}>Exit Exercise</button>
        </div>
      </section>
    </main>
  );
}
