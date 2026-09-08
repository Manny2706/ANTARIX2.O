import React from 'react';
import './Landing.css';

export default function Landing({ onGetStarted }) {
  return (
    <div className="landing-container">
      <div className="landing-logo-container">
        <div className="landing-logo-icon">
          <svg
            className="logo-svg"
            width="47"
            height="46"
            viewBox="0 0 47 46"
            fill="none"
            stroke="black"
            strokeWidth="1.5"
          >
            <circle cx="23.5" cy="23" r="21"></circle>
            <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
            <circle className="logo-dot" cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
          </svg>
        </div>
        <div className="landing-logo-text-mask">
          <div className="landing-logo-text">
            SATQUERY <span className="ai-text">AI</span>
          </div>
        </div>
      </div>

      <div className="landing-heading">
        <div className="heading-black heading-line">Ask Earth.</div>
        <div className="heading-blue heading-line">Get Evidence.</div>
      </div>

      <button className="get-started-btn" onClick={onGetStarted}>
        GET STARTED
      </button>
    </div>
  );
}