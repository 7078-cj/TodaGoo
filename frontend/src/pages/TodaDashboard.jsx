import React from 'react'
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';

function TodaDashboard() {
    const dispatch = useDispatch();
    return (
        <div className='flex flex-col gap-4'>
            <p>todaDashboard</p>
            <button onClick={() => dispatch(logout())}>Logout</button>
        </div>
    )
}

export default TodaDashboard