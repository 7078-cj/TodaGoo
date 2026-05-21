import React from "react";
import { useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import MapComponent from "../components/MapComponent";
import TodaPage from "../components/Toda/TodaPage";

function TodaDashboard() {
    const dispatch = useDispatch();

    return (
        <div className="">
        <p>todaDashboard</p>
        <button onClick={() => dispatch(logout())}>Logout</button>

        <div className="h-screen">
            <TodaPage/>
        </div>
        

        </div>
    );
}

export default TodaDashboard;