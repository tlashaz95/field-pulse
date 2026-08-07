import { Navigate, Route, Routes } from 'react-router-dom';
import OrgDashboard from './pages/OrgDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OrgDashboard />} />
      <Route path="/org/:orgId" element={<OrgDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
