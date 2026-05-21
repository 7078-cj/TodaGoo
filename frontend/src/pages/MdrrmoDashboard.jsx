import React from 'react'
import { useDispatch } from "react-redux";
import { logout } from '../features/auth/authSlice';

function MdrrmoDashboard() {
    const dispatch = useDispatch();
    return (
        <div className='flex flex-col gap-4'>
            <p>mdrrmoDashboard</p>
            <button onClick={() => dispatch(logout())}>Logout</button>
        </div>
    )
}

export default MdrrmoDashboard