import { Link } from "react-router-dom";
import "./onboarding.css";

export default function WelcomePage() {
  return (
    <main className="onboarding">
      <p className="home-eyebrow">Pulsewell · Wellness &amp; recovery</p>
      <h1>RESET</h1>
      <h2>A moment to pause. A way to begin again.</h2>
      <p>Explore guided breathing, acupressure, and grounding to support you in managing cravings and stress, one moment at a time.</p>
      <nav className="onboarding-actions" aria-label="Get started">
        <Link className="onboarding-primary" to="/start?intent=trial">Start My Free Trial</Link>
        <Link to="/preview">Try a Guided Preview</Link>
        <Link to="/signin">Already Have an Account? Sign In</Link>
      </nav>
      <section>
        <h2>What happens in a RESET?</h2>
        <p>Choose an exercise, rate how you feel, follow the guidance, then rate how you feel afterward. Your saved sessions help you look back on your experience.</p>
        <h3>Breathing RESET</h3>
        <p>Follow a gently expanding and contracting circle through breathing in, a brief pause, and breathing out. Breathe comfortably and stop whenever you wish.</p>
        <img className="onboarding-screenshot" src="/onboarding/breathing.png" alt="The existing RESET breathing exercise, with an inhale prompt and countdown." width="2974" height="1556" loading="lazy" />
        <h3>Acupressure RESET</h3>
        <p>Follow the guided wrist exercise at your own pace, with the option to finish and rate your experience whenever you are ready.</p>
        <h3>Grounding RESET</h3>
        <p>Move through a simple 5-4-3-2-1 sensory exercise, one step at a time. You can skip a step.</p>
      </section>
      <section>
        <h2>Explore first. Start when you’re ready.</h2>
        <p>The guided preview needs no email or account. Preview ratings stay only on this screen and are discarded when you leave or refresh.</p>
        <h2>Your seven-day free trial</h2>
        <p>Verify your email with a one-time code to begin an eligible seven-day trial. No payment is initiated by registering. Returning users keep their existing trial or subscription status; signing in does not restart an expired trial.</p>
        <Link className="onboarding-primary" to="/start?intent=trial">Start My Free Trial</Link>
      </section>
    </main>
  );
}
