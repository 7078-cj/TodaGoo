import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const TODARoutes = () => {
    const user = useSelector((state) => state.auth.user);
    const isTODA = user && user.department === "TODA";

    return isTODA ? <Outlet /> : <Navigate to="/unauthorized" replace />;
};

export default TODARoutes;