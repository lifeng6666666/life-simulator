import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Setup from "@/pages/Setup";
import Simulate from "@/pages/Simulate";
import Journey from "@/pages/Journey";
import History from "@/pages/History";
import Gallery from "@/pages/Gallery";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Setup />} />
        <Route path="/simulate" element={<Simulate />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/history" element={<History />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
