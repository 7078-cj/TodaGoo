import React from 'react'
import { logout } from '../features/auth/authSlice'
import { useDispatch } from 'react-redux'

export default function Footer() {
    const dispatch = useDispatch()

    return (
        <div>
            <button onClick={() => dispatch(logout())}>Logout</button>
        </div>
    )
}
