import { isLocalReview } from "./review/reviewStorage";
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AppRouter from './AppRouter';
import { AuthProvider } from './auth/AuthProvider';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isLocalReview ? <>
      <aside className="review-banner">Local review — isolated browser data. No Supabase, Stripe, or authentication requests.</aside>
      <App />
    </> : <AuthProvider>
      <AppRouter ResetApp={App} />
    </AuthProvider>}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
