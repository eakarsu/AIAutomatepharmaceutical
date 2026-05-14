import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import DocumentDetail from './pages/DocumentDetail';
import Navbar from './components/Navbar';
// AI feature pages (NEW custom features)
import BatchAnalysis from './pages/BatchAnalysis';
import ComplianceTrends from './pages/ComplianceTrends';
import PromptTemplates from './pages/PromptTemplates';
import AuditTrail from './pages/AuditTrail';
import RegulatoryCalendar from './pages/RegulatoryCalendar';
import CrossDocAnalysis from './pages/CrossDocAnalysis';
import ApiExport from './pages/ApiExport';
import CostAnalytics from './pages/CostAnalytics';
import AIToolsExtra from './pages/AIToolsExtra';
import ExtensionsPage from './pages/ExtensionsPage'; // Apply pass 5
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('pharma_user');
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('pharma_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pharma_token');
    localStorage.removeItem('pharma_user');
  };

  if (loading) return null;

  const guard = (El) => (user ? El : <Navigate to="/login" />);

  return (
    <Router>
      {user && <Navbar user={user} onLogout={handleLogout} />}
      <Routes>
        <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
        <Route path="/" element={guard(<Dashboard />)} />
        <Route path="/feature/:category" element={guard(<FeaturePage />)} />
        <Route path="/document/:id" element={guard(<DocumentDetail />)} />
        {/* AI feature pages */}
        <Route path="/ai-tools/batch" element={guard(<BatchAnalysis />)} />
        <Route path="/ai-tools/trends" element={guard(<ComplianceTrends />)} />
        <Route path="/ai-tools/prompts" element={guard(<PromptTemplates />)} />
        <Route path="/ai-tools/audit" element={guard(<AuditTrail />)} />
        <Route path="/ai-tools/calendar" element={guard(<RegulatoryCalendar />)} />
        <Route path="/ai-tools/cross-doc" element={guard(<CrossDocAnalysis />)} />
        <Route path="/ai-tools/export" element={guard(<ApiExport />)} />
        <Route path="/ai-tools/cost" element={guard(<CostAnalytics />)} />
        <Route path="/ai-tools/extra" element={guard(<AIToolsExtra />)} />
        <Route path="/ai-tools/extensions" element={guard(<ExtensionsPage />)} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
