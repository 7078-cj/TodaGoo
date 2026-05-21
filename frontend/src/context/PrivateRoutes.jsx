import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const PrivateRoutes = () => {
    const access = useSelector((state) => state.auth.access);

    return access ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoutes;