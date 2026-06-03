import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
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
import Header from "./components/Header";
import SideBarComponent from "./components/SideBarComponent";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { LayoutDashboard, MapPin } from "lucide-react";
import TodaBoundaries from "./pages/TodaBoundaries";
import Footer from "./components/Footer";
import RegisteredToda from "./pages/RegisteredToda";

const MDRRMO_MENU = [
    { label: "Dashboard", href: "/mdrrmo", icon: LayoutDashboard },
];

const TODA_MENU = [
    { label: "Dashboard", href: "/toda", icon: LayoutDashboard },
    { label: "Boundaries", href: "/toda/boundaries", icon: MapPin },
    { label: "RegisteredToda", href: "/toda/registered", icon: MapPin },
];

function AppContent() {
    const dispatch = useDispatch();
    const access = useSelector((state) => state.auth.access);
    const location = useLocation();

    useEffect(() => {
        if (!access) return;
        const interval = setInterval(() => {
            updateToken(dispatch);
        }, 600000);
        return () => clearInterval(interval);
    }, [access]);

    const hideLayoutRoutes = ["/login", "/register", "/forgot_password"];
    const showLayout = !hideLayoutRoutes.includes(location.pathname);

    const getMenuItems = () => {
        if (location.pathname.startsWith("/mdrrmo")) return MDRRMO_MENU;
        if (location.pathname.startsWith("/toda")) return TODA_MENU;
        return [];
    };

    if (!showLayout) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot_password" element={<ForgotPasswordPage />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
            </Routes>
        );
    }

    return (
        <>
            <div className="flex flex-col h-screen">
                
                {/* HEADER */}
                <Header />

                {/* BODY */}
                <div className="flex flex-1 overflow-hidden">

                    <SidebarProvider>
                        <SideBarComponent
                            menuItems={getMenuItems().map((item) => ({
                                ...item,
                                active: location.pathname === item.href,
                            }))}
                            footer={<Footer />}
                        />

                        <SidebarInset>
                            <main className="p-4 h-full overflow-y-auto">
                                <Routes>
                                    <Route path="/unauthorized" element={<Unauthorized />} />

                                    <Route element={<PrivateRoutes />}>
                                        <Route path="/" element={<DashBoard />} />

                                        <Route element={<MDRRMORoutes />}>
                                            <Route path="/mdrrmo" element={<MdrrmoDashboard />} />
                                        </Route>

                                        <Route element={<TODARoutes />}>
                                            <Route path="/toda" element={<TodaDashboard />} />
                                            <Route path="/toda/boundaries" element={<TodaBoundaries />} />
                                            <Route path="/toda/registered" element={<RegisteredToda />} />
                                        </Route>
                                    </Route>
                                </Routes>
                            </main>
                        </SidebarInset>

                    </SidebarProvider>
                </div>
            </div>
        </>
    );
}

export default function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}