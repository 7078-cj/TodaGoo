import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const MDRRMORoutes = () => {
    const user = useSelector((state) => state.auth.user);
    const isMDRRMO = user && user.department === "MDRRMO";

    return isMDRRMO ? <Outlet /> : <Navigate to="/unauthorized" replace />;
};

export default MDRRMORoutes;