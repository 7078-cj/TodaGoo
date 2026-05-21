import React from "react";
import { useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import MapComponent from "../components/MapComponent";
import AddToda from "../components/Toda/AddToda";

function TodaDashboard() {
    const dispatch = useDispatch();

    return (
        <div className="">
        <p>todaDashboard</p>
        <button onClick={() => dispatch(logout())}>Logout</button>

        <div className="h-screen">
            <AddToda/>
        </div>
        

        </div>
    );
}

export default TodaDashboard;