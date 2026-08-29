import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import StoryHome from './pages/StoryHome';
import Page1Problem from './pages/Page1Problem';
import Page2FCFS from './pages/Page2FCFS';
import Page3Chunked from './pages/Page3Chunked';
import Page4Memory from './pages/Page4Memory';
import Page5Eviction from './pages/Page5Eviction';
import Page6VIP from './pages/Page6VIP';
import DocumentationPage from './pages/DocumentationPage';
import App from './App';

const Router: React.FC = () => (
  <Routes>
    {/* Story Landing Page */}
    <Route path="/" element={<StoryHome />} />

    {/* 6 Dedicated Architectural Modules (Clean Semantic URLs) */}
    <Route path="/problem" element={<Page1Problem />} />
    <Route path="/fcfs" element={<Page2FCFS />} />
    <Route path="/chunked-prefill" element={<Page3Chunked />} />
    <Route path="/kv-capacity" element={<Page4Memory />} />
    <Route path="/preemption" element={<Page5Eviction />} />
    <Route path="/priority-preemption" element={<Page6VIP />} />

    {/* Backwards-compatible legacy /page redirects */}
    <Route path="/page1" element={<Navigate to="/problem" replace />} />
    <Route path="/page2" element={<Navigate to="/fcfs" replace />} />
    <Route path="/page3" element={<Navigate to="/chunked-prefill" replace />} />
    <Route path="/page4" element={<Navigate to="/kv-capacity" replace />} />
    <Route path="/page5" element={<Navigate to="/preemption" replace />} />
    <Route path="/page6" element={<Navigate to="/priority-preemption" replace />} />

    {/* Comprehensive Developer Documentation & Technical Reference */}
    <Route path="/docs" element={<DocumentationPage />} />
    <Route path="/documentation" element={<Navigate to="/docs" replace />} />

    {/* Live Factory Simulation Floor (Strictly the final destination) */}
    <Route path="/factory" element={<App />} />
    <Route path="/live" element={<Navigate to="/factory" replace />} />

    {/* Catch-all redirects to Story Home */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default Router;
