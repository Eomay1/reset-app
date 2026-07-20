import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
function App() {
  //console.log("Supabase connected:", supabase);
  const [phase, setPhase] = useState("Inhale");
  const [timer, setTimer] = useState(4);
  const [step, setStep] = useState("home");
  const [intensity, setIntensity] = useState(null); 
  const [beforeScore, setBeforeScore] = useState(null);
  const [afterScore, setAfterScore] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [wins, setWins] = useState("");
  const [challenge, setChallenge] = useState("");
  const [tomorrowFocus, setTomorrowFocus] = useState("");

 const [mood, setMood] = useState("");
 const [stressLevel, setStressLevel] = useState(null);
 const [wakeTime, setWakeTime] = useState("7:00");
 const [block, setBlock] = useState("Gym / Work / Walk");
 const [connection, setConnection] = useState("Call / Meeting / Visit");
 const [customAction1, setCustomAction1] = useState("");
 const [customAction2, setCustomAction2] = useState("");
 const [selectedChannel, setSelectedChannel] = useState("");
 const [nightlyReviewCount, setNightlyReviewCount] = useState(
  JSON.parse(localStorage.getItem("nightlyReview"))?.length || 0
);
const [cloudSessions, setCloudSessions] = useState([]);
 // ✅ LOAD SAVED DATA FIRST
useEffect(() => {
  const savedWake = localStorage.getItem("wakeTime");
  const savedBlock = localStorage.getItem("block");
  const savedConnection = localStorage.getItem("connection");
  
 

  if (savedWake) setWakeTime(savedWake);
  if (savedBlock) setBlock(savedBlock);
  if (savedConnection) setConnection(savedConnection);
  const savedLogs = localStorage.getItem("sessionLog");

if (savedLogs) {
  setSessionLog(JSON.parse(savedLogs));
}
}, []);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev > 1) return prev - 1;

        let nextPhase =
          phase === "Inhale"
            ? "Hold"
            : phase === "Hold"
            ? "Exhale"
            : "Inhale";

        setPhase(nextPhase);

        if (nextPhase === "Hold") return 2;
        if (nextPhase === "Exhale") return 4;
        return 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);
const saveSession = () => {
  const newSession = {
    date: new Date().toLocaleString(),
    beforeScore,
    afterScore,
    reduction:
      beforeScore !== null && afterScore !== null
        ? beforeScore - afterScore
        : null,
    wakeTime,
    block,
    connection,
    selectedAction,
  };

  const updatedSessions = [...sessionLog, newSession];

  setSessionLog(updatedSessions);

  localStorage.setItem(
    "sessionLog",
    JSON.stringify(updatedSessions)
  );
  console.log(updatedSessions);
};
const getDeviceId = () => {
  let deviceId = localStorage.getItem("pulsewell_device_id");

  if (!deviceId) {
    deviceId =
      "device_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("pulsewell_device_id", deviceId);
  }

  return deviceId;
};
const saveCravingSession = async (selectedMood, selectedStressLevel) => {
  const { data, error } = await supabase
    .from("session_results")
    .insert([
      {
        craving_before: beforeScore,
        craving_after: afterScore,
       mood: selectedMood,
        stress_level: selectedStressLevel,
        source: "pulsewell_mvp",
        device_id: getDeviceId()
      }
    ]);

  if (error) {
    console.error("Supabase insert error:", error);
  } else {
    console.log("Saved craving session:", data);
  }
};
const averageReduction =
  sessionLog.length > 0
    ? (
        sessionLog.reduce(
          (sum, s) => sum + (s.reduction || 0),
          0
        ) / sessionLog.length
      ).toFixed(1)
    : 0;
    const loadCloudSessions = async () => {
      console.log("Loading cloud sessions...");
  const { data, error } = await supabase
    .from("session_results")
    .select("*")
    
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading cloud sessions:", error);
    return;
  }

  setCloudSessions(data || []);
    };
    useEffect(() => {
  loadCloudSessions();
}, []);
const cloudTotalSessions = cloudSessions.length;

const cloudAverageReduction =
  cloudSessions.length > 0
    ? (
        cloudSessions.reduce(
          (sum, session) =>
            sum +
            ((session.craving_before || 0) -
             (session.craving_after || 0)),
          0
        ) / cloudSessions.length
      ).toFixed(1)
    : 0;
const cloudSuccessfulSessions = cloudSessions.filter(
  (session) => session.craving_after < session.craving_before
).length;

const cloudSuccessRate =
  cloudSessions.length > 0
    ? Math.round(
        (cloudSuccessfulSessions / cloudSessions.length) * 100
      )
    : 0;
const cloudUniqueUsers = new Set(
  cloudSessions
    .map((session) => session.device_id)
    .filter(Boolean)
).size;

const cloudSessionsPerUser =
  cloudUniqueUsers > 0
    ? (cloudSessions.length / cloudUniqueUsers).toFixed(1)
    : 0;
   const cloudReturningUsers = Object.values(
  cloudSessions.reduce((acc, session) => {
    if (!session.device_id) return acc;

    acc[session.device_id] = (acc[session.device_id] || 0) + 1;
    return acc;
  }, {})
).filter((sessionCount) => sessionCount > 1).length;

const cloudReturningUserRate =
  cloudUniqueUsers > 0
    ? Math.round((cloudReturningUsers / cloudUniqueUsers) * 100)
    : 0;
    const cloudLowMoodCount = cloudSessions.filter(
  (session) => session.mood === "Low"
).length;

const cloudNeutralMoodCount = cloudSessions.filter(
  (session) => session.mood === "Neutral"
).length;

const cloudGoodMoodCount = cloudSessions.filter(
  (session) => session.mood === "Good"
).length;
const cloudLowMoodReduction =
  cloudSessions.filter((session) => session.mood === "Low").length > 0
    ? (
        cloudSessions
          .filter((session) => session.mood === "Low")
          .reduce(
            (sum, session) =>
              sum +
              ((session.craving_before || 0) -
                (session.craving_after || 0)),
            0
          ) /
        cloudSessions.filter((session) => session.mood === "Low").length
      ).toFixed(1)
    : 0;
    
    const cloudNeutralMoodReduction =
  cloudSessions.filter((session) => session.mood === "Neutral").length > 0
    ? (
        cloudSessions
          .filter((session) => session.mood === "Neutral")
          .reduce(
            (sum, session) =>
              sum +
              ((session.craving_before || 0) -
                (session.craving_after || 0)),
            0
          ) /
        cloudSessions.filter((session) => session.mood === "Neutral").length
      ).toFixed(1)
    : 0;
    const cloudGoodMoodReduction =
  cloudSessions.filter((session) => session.mood === "Good").length > 0
    ? (
        cloudSessions
          .filter((session) => session.mood === "Good")
          .reduce(
            (sum, session) =>
              sum +
              ((session.craving_before || 0) -
                (session.craving_after || 0)),
            0
          ) /
        cloudSessions.filter((session) => session.mood === "Good").length
      ).toFixed(1)
    : 0;
return (

 <div style={{
    textAlign: "center",
  paddingTop: "40px",
paddingBottom: "60px",
    minHeight: "100vh",
    backgroundColor: "#dfe8dd"
    
    }}>

  
  

    {/* HOME */}
    {step === "home" && (
      <main className="home-screen">
        <div className="home-container">
          <header className="home-header">
            <p className="home-eyebrow">Wellness &amp; recovery</p>
            <h1 className="home-brand">RESET</h1>
            <p className="home-intro">
              Build structure, reset cravings, and reflect on your progress.
            </p>
          </header>

          <section
            className="home-stats-grid"
            aria-label="Progress summary"
          >
            <div className="home-stat-card">
              <span className="home-stat-label">Total Sessions</span>
              <strong className="home-stat-value">
                {sessionLog.length}
              </strong>
            </div>

            <div className="home-stat-card">
              <span className="home-stat-label">
                Nightly Reviews Completed
              </span>
              <strong className="home-stat-value">
                {nightlyReviewCount}
              </strong>
            </div>

            <div className="home-stat-card">
              <span className="home-stat-label">
                Average Craving Reduction
              </span>
              <strong className="home-stat-value">
                {averageReduction}
              </strong>
            </div>
          </section>

          <section className="home-actions-section">
            <div className="home-section-heading">
              <h2>What would you like to do?</h2>
              <p>Choose an action to continue your recovery plan.</p>
            </div>

            <div className="home-actions-grid">
              <div className="home-action-slot">
                <button
                  onClick={() => setStep("before")}
                  className="home-action-button"
                >
                  <span className="home-action-title">Craving Reset</span>
                  <span className="home-action-description">
                    Pause and work through an urge
                  </span>
                </button>
              </div>

              <div className="home-action-slot">
                <button
                  onClick={() => setStep("structure")}
                  className="home-action-button"
                >
                  <span className="home-action-title">
                    Structure Planner
                  </span>
                  <span className="home-action-description">
                    Plan the anchors for your day
                  </span>
                </button>
              </div>

              <div className="home-action-slot">
                <button
                  onClick={() => setStep("review")}
                  className="home-action-button"
                >
                  <span className="home-action-title">Nightly Review</span>
                  <span className="home-action-description">
                    Reflect on today and prepare for tomorrow
                  </span>
                </button>
              </div>

              {/*
                This action slot can later be wrapped in an administrator
                or clinician condition without changing the grid layout.
              */}
              <div className="home-action-slot home-action-slot--analytics">
                <button
                  onClick={() => {
                    loadCloudSessions();
                    setStep("analytics");
                  }}
                  className="home-action-button"
                >
                  <span className="home-action-title">Analytics</span>
                  <span className="home-action-description">
                    View engagement and outcome trends
                  </span>
                </button>
              </div>
            </div>

            <p className="home-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
          </section>

          <section className="home-reviews-section">
            <div className="home-section-heading">
              <h2>Recent Nightly Reviews</h2>
              <p>Your five most recent reflections.</p>
            </div>

            <div className="home-reviews-list">
              {
                (
                  Array.isArray(JSON.parse(localStorage.getItem("nightlyReview")))
                    ? JSON.parse(localStorage.getItem("nightlyReview"))
                    : []
                )
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((review, index) => (
                    <article
                      key={index}
                      className="home-review-card"
                    >
                      <p className="home-review-date">
                        {review.date}
                      </p>

                      <div className="home-review-content">
                        <div className="home-review-field">
                          <span>Wins</span>
                          <p>{review.wins}</p>
                        </div>

                        <div className="home-review-field">
                          <span>Challenge</span>
                          <p>{review.challenge}</p>
                        </div>

                        <div className="home-review-field">
                          <span>Tomorrow</span>
                          <p>{review.tomorrowFocus}</p>
                        </div>
                      </div>
                    </article>
                  ))
              }
            </div>
          </section>
        </div>
      </main>
    )}
    
    {/* BEFORE */}
{step === "before" && (
  <main className="craving-before-screen">
    <div className="craving-before-container">
      <header className="craving-before-header">
        <h2>How strong is the craving?</h2>
        <p>
          Choose the number that best reflects your craving right now.
        </p>
      </header>

      <div className="craving-before-scale">
      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => setBeforeScore(n)}
          className={`craving-before-button ${
            beforeScore === n ? "craving-before-button--selected" : ""
          }`}
          aria-pressed={beforeScore === n}
        >
          {n}
        </button>
      ))}
      </div>

      <div className="craving-before-labels" aria-hidden="true">
        <span>Not at all</span>
        <span>Extremely</span>
      </div>

      <button
        type="button"
        disabled={beforeScore === null}
        onClick={() => setStep("reset")}
        className="craving-before-continue"
      >
        Continue
      </button>
    </div>
  </main>
)}

    {/* RESET */}
    {step === "reset" && (
      <div>
        <div
  style={{
    width: "240px",
    height: "240px",
    borderRadius: "50%",
    backgroundColor:
      phase === "Inhale"
        ? "#a8d5ba"
        : phase === "Hold"
        ? "#f2d8a7"
        : "#c9d7f0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    margin: "40px auto",
   transform:
  phase === "Inhale"
    ? "scale(1.25)"
    : phase === "Hold"
    ? "scale(1.25)"
    : "scale(0.65)",
   transition: "all 4s linear",
boxShadow: "0 0 40px rgba(0,0,0,0.15)"
  }}
>
  <h2 style={{ margin: 0, fontSize: "32px" }}>
    {phase}
  </h2>

  <h1 style={{ margin: 0, fontSize: "64px" }}>
    {timer}
  </h1>
</div>

        <button onClick={() => setStep("intensity")}>
          Continue
        </button>
      </div>
    )}

    {/* INTENSITY */}
    {step === "intensity" && (
      <main className="craving-before-screen">
        <div className="craving-before-container">
          <header className="craving-before-header">
            <h2>How strong is the craving?</h2>
            <p>
              Choose the number that best reflects your craving right now.
            </p>
          </header>

          <div className="craving-before-scale">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setIntensity(n)}
                className={`craving-before-button ${
                  intensity === n ? "craving-before-button--selected" : ""
                }`}
                aria-pressed={intensity === n}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="craving-before-labels" aria-hidden="true">
            <span>Not at all</span>
            <span>Extremely</span>
          </div>

          <button
            type="button"
            disabled={intensity === null}
            onClick={() => setStep("message")}
            className="craving-before-continue"
          >
            Continue
          </button>
        </div>
      </main>
    )}

    {/* MESSAGE */}
    {step === "message" && (
      <main className="impulse-screen">
        <div className="impulse-container">
          <header className="impulse-header">
            <h2>Pause the impulse.</h2>
            <p>Choose what would help you most right now.</p>
          </header>

          <div className="impulse-actions">
            <button
              type="button"
              onClick={() => setStep("reset")}
              className="impulse-action-button"
            >
              <span className="impulse-action-title">Breathe Again</span>
              <span className="impulse-action-description">
                Repeat the guided breathing cycle.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep("channel")}
              className="impulse-action-button"
            >
              <span className="impulse-action-title">Channel Energy</span>
              <span className="impulse-action-description">
                Redirect the urge into a brief physical action.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep("analysis")}
              className="impulse-action-button impulse-action-button--primary"
            >
              <span className="impulse-action-title">Continue</span>
              <span className="impulse-action-description">
                Move on to your post-RESET check-in.
              </span>
            </button>
          </div>
        </div>
      </main>
    )}
{/* CHANNEL */}
{step === "channel" && (
  <div>
    <h1 style={{ fontSize: "56px", marginBottom: "20px" }}>
      Channel the energy
    </h1>

    <p style={{ fontSize: "28px", marginBottom: "40px" }}>
      Don’t sit with it. Move it.
    </p>

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        alignItems: "center"
      }}
    >
      {[
        "10-min fast walk",
        "20 Push up or squats",
        "Cold Water Reset",
        "Clean one small area",
        "Contact support"
      ].map((item) => (
        <button
  key={item}
 onClick={() => {
  setSelectedChannel(item);
  setSelectedAction(item);
  setStep("analysis");
}}
  style={{
            width: "700px",
            maxWidth: "90%",
            padding: "25px",
            fontSize: "26px",
            borderRadius: "25px",
            border: "none",
            backgroundColor: "#d8cfd0",
            cursor: "pointer"
          }}
        >
          {item}
        </button>
      ))}

      <input
        type="text"
        placeholder="Custom action 1"
        value={customAction1}
        onChange={(e) => setCustomAction1(e.target.value)}
        style={{
          width: "700px",
          maxWidth: "90%",
          padding: "20px",
          fontSize: "24px",
          borderRadius: "20px"
        }}
      />
      <button
onClick={() => {
  setSelectedChannel(customAction1);
  setSelectedAction(customAction1);
  setStep("analysis");
}}
  style={{
    marginBottom: "10px",
    padding: "10px 20px"
  }}
>
  Use Custom Action 1
</button>

      <input
        type="text"
        placeholder="Custom action 2"
        value={customAction2}
        onChange={(e) => setCustomAction2(e.target.value)}
        style={{
          width: "700px",
          maxWidth: "90%",
          padding: "20px",
          fontSize: "24px",
          borderRadius: "20px"
        }}
      />
      <button
  onClick={() => {
  setSelectedChannel(customAction2);
  setSelectedAction(customAction2);
  setStep("analysis");
}}
  style={{
    marginBottom: "20px",
    padding: "10px 20px"
  }}
>
  Use Custom Action 2
</button>

      <button
        onClick={() => setStep("analysis")}
        style={{
          marginTop: "20px",
          padding: "18px 40px",
          fontSize: "22px",
          borderRadius: "20px"
        }}
      >
        Continue
      </button>
    </div>
  </div>
)}
    {/* ANALYSIS */}
    {step === "analysis" && (
      <main className="craving-after-screen">
        <div className="craving-after-container">
          <header className="craving-after-header">
            <h2>Before and After</h2>
            <p>How strong is the craving now?</p>
          </header>

          <div className="craving-after-scale">
            {[1,2,3,4,5,6,7,8,9,10].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => setAfterScore(num)}
                className={`craving-after-button ${
                  afterScore === num ? "craving-after-button--selected" : ""
                }`}
                aria-pressed={afterScore === num}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="craving-after-labels" aria-hidden="true">
            <span>Not at all</span>
            <span>Extremely</span>
          </div>

          {beforeScore != null && afterScore != null && (
            <div
              className={`craving-after-result ${
                afterScore < beforeScore
                  ? "craving-after-result--improved"
                  : afterScore > beforeScore
                  ? "craving-after-result--increased"
                  : "craving-after-result--unchanged"
              }`}
            >
              <p>
                {afterScore < beforeScore
                  ? `Craving reduced from ${beforeScore}/10 to ${afterScore}/10`
                  : afterScore > beforeScore
                  ? `Craving increased from ${beforeScore}/10 to ${afterScore}/10`
                  : `Craving remained at ${beforeScore}/10`}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
  console.log("Finish button clicked");
  setStep("done");

}}
            className="craving-after-finish"
          >
            Finish
          </button>
        </div>
      </main>
    )}

    {/* STRUCTURE */}
    {step === "structure" && (
      <main className="structure-screen">
        <div className="structure-container">
          <header className="structure-header">
            <h2>Build today’s structure</h2>
            <p className="structure-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
            <p className="structure-subtitle">
              Choose your anchors for the day—set your plan, stay on track.
            </p>
          </header>

          <section className="structure-section">
            <div className="structure-section-heading">
              <h3>Wake Time</h3>
              <p>When will your day begin?</p>
            </div>

            <div className="structure-preset-grid">
              {["6:00", "7:00", "8:00"].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setWakeTime(t)}
                  className={`structure-preset-button ${
                    wakeTime === t ? "structure-preset-button--selected" : ""
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Custom wake time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="structure-input"
            />
          </section>

          <section className="structure-section">
            <div className="structure-section-heading">
              <h3>Main Block</h3>
              <p>What is your main focus for the day?</p>
            </div>

            <div className="structure-preset-grid">
              {["gym", "writing", "appointment"].map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBlock(b)}
                  className={`structure-preset-button ${
                    block === b ? "structure-preset-button--selected" : ""
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Custom main block"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="structure-input"
            />
          </section>

          <section className="structure-section">
            <div className="structure-section-heading">
              <h3>Connection</h3>
              <p>How will you connect with someone today?</p>
            </div>

            <div className="structure-preset-grid structure-preset-grid--connection">
              {["Sponsor", "Meeting", "Family", "Friend"].map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setConnection(option)}
                  className={`structure-preset-button ${
                    connection === option
                      ? "structure-preset-button--selected"
                      : ""
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Who are you connecting with?"
              value={connection}
              onChange={(e) => setConnection(e.target.value)}
              className="structure-input"
            />
          </section>

          <button
            onClick={() => {
              saveSession();
              setStep("mood");
            }}
            className="structure-submit-button"
          >
            Lock It In
          </button>
        </div>
      </main>
    )}
{/* REVIEW */}
{step === "review" && (
 <div className="card"
    style={{
      backgroundColor: "white",
      padding: "40px",
      borderRadius: "24px",
      width: "700px",
      maxWidth: "90%",
      margin: "40px auto",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
    }}
  >
    <h2>Nightly Review</h2>

    <p
      style={{
        color: "#666",
        marginBottom: "30px"
      }}
    >
      Reflect on today before closing the day.
    </p>

    <div style={{ marginBottom: "25px" }}>
      <p>What went well today?</p>

      <textarea
        value={wins}
        onChange={(e) => setWins(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "12px"
        }}
      />
    </div>

    <div style={{ marginBottom: "25px" }}>
      <p>What challenge did you overcome?</p>

      <textarea
        value={challenge}
        onChange={(e) => setChallenge(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "12px"
        }}
      />
    </div>

    <div style={{ marginBottom: "25px" }}>
      <p>What is tomorrow’s focus?</p>

      <textarea
        value={tomorrowFocus}
        onChange={(e) => setTomorrowFocus(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "12px"
        }}
      />
    </div>

    <button
      onClick={() => {
       const existingReviewsRaw =
  JSON.parse(localStorage.getItem("nightlyReview"));

const existingReviews = Array.isArray(existingReviewsRaw)
  ? existingReviewsRaw
  : existingReviewsRaw
    ? [existingReviewsRaw]
    : [];
const newReview = {
  date: new Date().toLocaleString(),
  wins,
  challenge,
  tomorrowFocus
};

const updatedReviews = [...existingReviews, newReview];
console.log("Saving nightly review");
localStorage.setItem(
  "nightlyReview",
  JSON.stringify(updatedReviews)
);
setNightlyReviewCount(updatedReviews.length);
setStep("home");
      }}
      style={{
        padding: "14px 24px",
        borderRadius: "14px",
        border: "none",
        backgroundColor: "#4f7c5b",
        color: "white",
        cursor: "pointer"
      }}
    >
      Save Reflection
    </button>
  </div>
)}
{/* MOOD */}
{step === "mood" && (
  <main className="mood-screen fade-in">
    <div className="mood-container">
      <header className="mood-header">
        <h2>How is your mood right now?</h2>
        <p>
          Choose the option that best reflects how you feel before beginning
          your RESET.
        </p>
      </header>

      <div className="mood-options-grid">
        {["Low", "Neutral", "Good"].map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMood(m)}
            className={`mood-option-button ${
              mood === m ? "mood-option-button--selected" : ""
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <section className="mood-checkin-section">
        <div className="mood-stress-heading">
          <h3>How stressed or anxious do you feel right now?</h3>
        </div>

        <div className="mood-stress-scale">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
            <button
              type="button"
              key={level}
              onClick={() => setStressLevel(level)}
              className={`mood-stress-button ${
                stressLevel === level ? "mood-stress-button--selected" : ""
              }`}
              aria-pressed={stressLevel === level}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="mood-stress-labels" aria-hidden="true">
          <span>Not at all</span>
          <span>Extremely</span>
        </div>
      </section>

      <button
        type="button"
        disabled={mood === "" || stressLevel === null}
        onClick={async () => {
  setMood(mood);
  await saveCravingSession(mood, stressLevel);
  setStep("home");
}}
        className="mood-save-button"
      >
        Save Check-In
      </button>
    </div>
  </main>
)}
{step === "analytics" && (
  <div className="card fade-in analytics-dashboard">
    <header className="analytics-header">
      <p className="analytics-eyebrow">Analytics overview</p>
      <h2>Program Dashboard</h2>
    </header>

    <section className="analytics-section">
      <div className="analytics-section-header">
        <h2>Engagement</h2>
        <p>Participation and user activity</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-metric-card">
          <h3>Total Sessions</h3>
          <p className="analytics-metric-value">{cloudTotalSessions}</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Sessions per User</h3>
          <p className="analytics-metric-value">{cloudSessionsPerUser}</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Unique Users</h3>
          <p className="analytics-metric-value">{cloudUniqueUsers}</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Returning Rate</h3>
          <p className="analytics-metric-value">
            {cloudReturningUserRate}%
          </p>
        </div>
      </div>
    </section>

    <section className="analytics-section">
      <div className="analytics-section-header">
        <h2>Clinical Outcomes</h2>
        <p>Program effectiveness and retention</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-metric-card">
          <h3>Success Rate</h3>
          <p className="analytics-metric-value">{cloudSuccessRate}%</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Cloud Average Reduction</h3>
          <p className="analytics-metric-value">
            {cloudAverageReduction}
          </p>
        </div>

        <div className="analytics-metric-card">
          <h3>Returning Users</h3>
          <p className="analytics-metric-value">{cloudReturningUsers}</p>
        </div>
      </div>
    </section>

    <section className="analytics-section">
      <div className="analytics-section-header">
        <h2>Mood Analytics</h2>
        <p>Session volume and average reduction by mood</p>
      </div>

      <div className="analytics-grid analytics-mood-grid">
        <div className="analytics-metric-card analytics-mood-card">
          <h3>Low Mood</h3>

          <div className="analytics-mood-metrics">
            <div>
              <span>Sessions</span>
              <strong>{cloudLowMoodCount}</strong>
            </div>

            <div>
              <span>Avg Reduction</span>
              <strong>{cloudLowMoodReduction}</strong>
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-mood-card">
          <h3>Neutral Mood</h3>

          <div className="analytics-mood-metrics">
            <div>
              <span>Sessions</span>
              <strong>{cloudNeutralMoodCount}</strong>
            </div>

            <div>
              <span>Avg Reduction</span>
              <strong>{cloudNeutralMoodReduction}</strong>
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-mood-card">
          <h3>Good Mood</h3>

          <div className="analytics-mood-metrics">
            <div>
              <span>Sessions</span>
              <strong>{cloudGoodMoodCount}</strong>
            </div>

            <div>
              <span>Avg Reduction</span>
              <strong>{cloudGoodMoodReduction}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div className="analytics-footer">
      <button
        onClick={() => setStep("home")}
        className="main-button"
      >
        Return Home
      </button>
    </div>
  </div>
  )}
    {/* DONE */}
    {step === "done" && (
      <main className="reset-complete-screen fade-in">
        <div className="reset-complete-container">
          <header className="reset-complete-header">
            <h2>RESET Complete</h2>
            <p>Your check-in and plan have been saved.</p>
          </header>

          <div className="reset-complete-summary">
            <section className="reset-complete-section">
              <h3>Today’s Structure</h3>

              <div className="reset-complete-row">
                <span className="reset-complete-label">Wake Time</span>
                <strong className="reset-complete-value">{wakeTime}</strong>
              </div>

              <div className="reset-complete-row">
                <span className="reset-complete-label">Main Block</span>
                <strong className="reset-complete-value">{block}</strong>
              </div>

              <div className="reset-complete-row">
                <span className="reset-complete-label">Connection</span>
                <strong className="reset-complete-value">{connection}</strong>
              </div>
            </section>

            <section className="reset-complete-section">
              <h3>Craving Result</h3>
              <div
                className={`reset-complete-result ${
                  afterScore < beforeScore
                    ? "reset-complete-result--improved"
                    : afterScore > beforeScore
                    ? "reset-complete-result--increased"
                    : "reset-complete-result--unchanged"
                }`}
              >
                <p>
                  {afterScore < beforeScore
                    ? `Craving reduced from ${beforeScore}/10 to ${afterScore}/10`
                    : afterScore > beforeScore
                    ? `Craving increased from ${beforeScore}/10 to ${afterScore}/10`
                    : `Craving remained at ${beforeScore}/10`}
                </p>
              </div>
            </section>

            <section className="reset-complete-section">
              <h3>Channel Action</h3>
              <p className="reset-complete-channel-value">
                {selectedAction || "No channel action selected."}
              </p>
            </section>
          </div>

          <button
            type="button"
            onClick={() => setStep("home")}
            className="reset-complete-home-button"
          >
            Return Home
          </button>
        </div>
      </main>
    )}

</div>
);
}
export default App;
