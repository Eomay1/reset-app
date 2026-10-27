export default function BreathingCircle({ phase, timer }) {
 return (
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
 );
}
