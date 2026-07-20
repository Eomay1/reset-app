import { useEffect, useState } from "react";
import "./App.css";
function App() {
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

 const [wakeTime, setWakeTime] = useState("7:00");
 const [block, setBlock] = useState("Gym / Work / Walk");
 const [connection, setConnection] = useState("Call / Meeting / Visit");
 const [customAction1, setCustomAction1] = useState("");
 const [customAction2, setCustomAction2] = useState("");
 const [selectedChannel, setSelectedChannel] = useState("");
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
return (
  <div style={{
    textAlign: "center",
    paddingTop: "60px",
    minHeight: "100vh",
    backgroundColor: "#dfe8dd"
    
    }}>

  
  

    {/* HOME */}
    {step === "home" && (
     <div className="card">
      <h1>RESET</h1>

<h3>Total Sessions: {sessionLog.length}</h3>
<h3>
  Nightly Reviews Completed:{" "}
  {localStorage.getItem("nightlyReview") ? 1 : 0}
</h3>

<h3>
  Average Craving Reduction: {averageReduction}
</h3>

       <button onClick={() => setStep("before")}>
  Craving Reset
</button>

        <button onClick={() => setStep("structure")}>
          Structure Planner
        </button>
       <div
  style={{
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    marginLeft: "10px"
  }}
>
  <button onClick={() => setStep("review")}>
    Nightly Review
  </button>

  <p
    style={{
      marginTop: "6px",
      fontSize: "14px",
      color: "#555"
    }}
  >
    {new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    })}
  </p>
</div>
 
      </div>
    )}
    {/* BEFORE */}
{step === "before" && (
  <div
    style={{
      backgroundColor: "white",
      padding: "40px",
      borderRadius: "24px",
      width: "420px",
      margin: "0 auto",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
    }}
  >
    <h2>How strong is the urge right now?</h2>

    <div style={{ marginTop: "20px" }}>
      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
        <button
          key={n}
          onClick={() => setBeforeScore(n)}
          style={{
            margin: "5px",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            backgroundColor:
              beforeScore === n ? "#4f7c5b" : "#e8e8e8",
            color:
              beforeScore === n ? "white" : "black"
          }}
        >
          {n}
        </button>
      ))}
    </div>

    <br />

    <button
      onClick={() => setStep("reset")}
      style={{
        padding: "12px 20px",
        borderRadius: "12px",
        border: "none",
        backgroundColor: "#4f7c5b",
        color: "white",
        cursor: "pointer"
      }}
    >
      Begin Reset
    </button>
  </div>
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
      <div>
        <h2>How strong is the craving?</h2>

        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
          <button
            key={n}
            onClick={() => {
              setIntensity(n);
              setStep("message");
            }}
          >
            {n}
          </button>
        ))}
      </div>
    )}

    {/* MESSAGE */}
    {step === "message" && (
      <div>
        <h2>Pause the impulse.</h2>

        <div
  style={{
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    marginTop: "20px"
  }}
>
  <button onClick={() => setStep("reset")}>
    Breathe Again
  </button>

  <button onClick={() => setStep("channel")}>
    Channel Energy
  </button>

  <button onClick={() => setStep("analysis")}>
    Continue
  </button>
</div>
      </div>
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
  onClick={() => setSelectedChannel(customAction1)}
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
  onClick={() => setSelectedChannel(customAction2)}
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
      <div>
       <h2>Before and After</h2>

<p>How strong is the craving now?</p>

<div style={{ marginBottom: "20px" }}>
  {[1,2,3,4,5,6,7,8,9,10].map((num) => (
    <button
      key={num}
      onClick={() => setAfterScore(num)}
      style={{
        margin: "4px",
        backgroundColor: afterScore === num ? "#b7d3b0" : "white"
      }}
    >
      {num}
    </button>
  ))}
</div>

{beforeScore && afterScore && (
  <p>
    Craving reduced from {beforeScore}/10 to {afterScore}/10
  </p>
)}

<button onClick={() => setStep("done")}>
  Finish
</button>
      </div>
    )}

    {/* STRUCTURE */}
    {step === "structure" && (
      <div className="card">
        <h2>Build today's structure</h2>
        <p
  style={{
    color: "#555",
    marginBottom: "30px",
    fontSize: "18px"
  }}
>
  {new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  })}
</p>
        <p>Wake time</p>

{["6:00", "7:00", "8:00"].map((t) => (
  <button
    key={t}
    onClick={() => setWakeTime(t)}
    style={{ margin: "5px" }}
  >
    {t}
  </button>
))}
<br /><br />

<input
  type="text"
  placeholder="Custom wake time"
  value={wakeTime}
  onChange={(e) => setWakeTime(e.target.value)}
  style={{
    padding: "10px",
    width: "220px",
    borderRadius: "10px",
    border: "1px solid #ccc"
  }}
/>

<br /><br />

<p>Main block</p>

{["gym", "writing", "appointment"].map((b) => (
  <button
    key={b}
    onClick={() => setBlock(b)}
    style={{ margin: "5px" }}
  >
    {b}
  </button>
))}
<br /><br />

<input
  type="text"
  placeholder="Custom main block"
  value={block}
  onChange={(e) => setBlock(e.target.value)}
  style={{
    padding: "10px",
    width: "220px",
    borderRadius: "10px",
    border: "1px solid #ccc"
  }}
/>

<br /><br />

<p>Connection</p>

<input
  type="text"
  placeholder="Who are you connecting with?"
  value={connection}
  onChange={(e) => setConnection(e.target.value)}
  style={{
    padding: "10px",
    width: "250px"
  }}
/>

<br /><br />

      <button
  onClick={() => {
    saveSession();
    setStep("done");
  }}
>
  Lock It In
</button>  
      </div>
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
        localStorage.setItem(
          "nightlyReview",
          JSON.stringify({
            date: new Date().toLocaleString(),
            wins,
            challenge,
            tomorrowFocus
          })
        );

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
    {/* DONE */}
    {step === "done" && (
     <div className="card fade-in">
        <h2>Reset Complete</h2>

        <p>{wakeTime} • {block} • {connection}</p>
        <p>
  Craving reduced from {beforeScore}/10 to {afterScore}/10
</p>

<p>
  Channel action: {selectedAction}
</p>



        <button onClick={() => setStep("home")}>
          Return Home
        </button>
      </div>
    )}

</div>
);
}
export default App;