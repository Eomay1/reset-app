import "./AcupressureExercise.css";

function AcupressureSelection({ exercises, onSelectExercise, onBack }) {
  return (
    <main className="acupressure-selection-screen">
      <section className="acupressure-selection-card">
        <header className="acupressure-selection-header">
          <p className="acupressure-eyebrow">Self-regulation tools</p>
          <h1>Guided Acupressure</h1>
          <p>Choose a self-regulation exercise.</p>
        </header>

        <aside className="acupressure-selection-note">
          Use comfortable pressure only. These exercises are intended for
          self-regulation support and are not a substitute for medical or
          emergency care.
        </aside>

        <div className="acupressure-exercise-grid">
          {exercises.map((exercise) => (
            <article className="acupressure-exercise-option" key={exercise.id}>
              <div>
                <h2>{exercise.displayName}</h2>
                <p className="acupressure-exercise-technical-name">
                  {exercise.pointName}
                </p>
                <p className="acupressure-exercise-description">
                  {exercise.description}
                </p>
              </div>
              <button
                type="button"
                className="acupressure-button acupressure-button--primary"
                onClick={() => onSelectExercise(exercise.id)}
              >
                {exercise.buttonLabel}
              </button>
            </article>
          ))}
        </div>

        <button
          type="button"
          className="acupressure-button acupressure-button--secondary acupressure-selection-back"
          onClick={onBack}
        >
          Back
        </button>
      </section>
    </main>
  );
}

export default AcupressureSelection;
