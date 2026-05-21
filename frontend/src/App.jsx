import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider, useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";

import Login from "./pages/Login";
import DashBoard from "./pages/DashBoard";

import PrivateRoutes from "./context/PrivateRoutes";
import { updateToken } from "./utils/auth";
import ForgotPasswordPage from "./pages/ForgotPassword";
import MDRRMORoutes from "./context/MDRRMOroutes";
import TODARoutes from "./context/TODAroutes";
import Unauthorized from "./pages/Unauthorized";
import MdrrmoDashboard from "./pages/MdrrmoDashboard";
import TodaDashboard from "./pages/TodaDashboard";


function AppContent() {

  const dispatch = useDispatch();
  const tokens = useSelector((state) => state.auth.tokens);

  useEffect(() => {

    if (!tokens) return;

    const interval = setInterval(() => {
      updateToken(dispatch);
    }, 600000);

    return () => clearInterval(interval);

  }, [tokens]);

  return (
    <Router>

      <Routes>

        <Route path="/login" element={<Login />} />
        <Route path="/forgot_password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<PrivateRoutes />}>
          <Route path="/" element={<DashBoard />} />

          {/* //routes for department-specific dashboards */}
          <Route element={<MDRRMORoutes />}>

            <Route path="/mdrrmo" element={<MdrrmoDashboard />} />

          </Route>

          <Route element={<TODARoutes />}>

            <Route path="/toda" element={<TodaDashboard />} />

          </Route>
        </Route>


      </Routes>

    </Router>
  );
}


export default function App() {
  return (
      <AppContent />
  );
}