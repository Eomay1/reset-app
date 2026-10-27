import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import WelcomePage from "../pages/WelcomePage";
import PreviewPage from "../pages/PreviewPage";

// Deliberately excludes AuthProvider and all live authentication integrations.
export default function ReviewRouter({ ResetApp }) {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/start" element={<main className="onboarding">
        <h1>Registration is disabled in local review</h1>
        <p>No email is sent and no account or trial is created. Automated tests exercise the registration flow with mocked authentication.</p>
        <Link to="/app">Continue to the isolated RESET app</Link>
        <Link to="/welcome">Return to the introduction</Link>
      </main>} />
      <Route path="/signin" element={<main className="onboarding"><h1>Local review only</h1><Link to="/app">Open the isolated RESET app</Link></main>} />
      <Route path="*" element={<><nav className="onboarding"><Link to="/welcome">Explore the public onboarding</Link></nav><ResetApp /></>} />
      <Route path="/" element={<WelcomePage />} />
    </Routes>
  </BrowserRouter>;
}
