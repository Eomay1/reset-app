export default function RatingScreen({ title, description, value, onChange, onContinue, feedback, feedbackTone = "unchanged", min = 0 }) {
  return (
    <main className="craving-after-screen">
      <div className="craving-after-container">
        <header className="craving-after-header"><h2>{title}</h2><p>{description}</p></header>
        <div className="mood-stress-scale">
          {Array.from({ length: 11 - min }, (_, index) => index + min).map((number) => (
            <button type="button" key={number} onClick={() => onChange(number)} className={`mood-stress-button ${value === number ? "mood-stress-button--selected" : ""}`} aria-pressed={value === number}>{number}</button>
          ))}
        </div>
        <div className="mood-stress-labels" aria-hidden="true"><span>Not at all</span><span>Extremely</span></div>
        {feedback && (
          <div className={`craving-after-result craving-after-result--${feedbackTone}`} role="status">
            <p>{feedback}</p>
          </div>
        )}
        <button type="button" disabled={value === null} onClick={onContinue} className="mood-save-button">Continue</button>
      </div>
    </main>
  );
}
