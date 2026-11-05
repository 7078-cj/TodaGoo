import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import UserRegisterForm from '../../../components/UserRegisterForm'
import DriverProfileForm from '../../../components/DriverProfileForm'
import {driverRegister} from '../../../api/driver'
import AuthContext from '@/contexts/AuthContext'
import {router } from "expo-router";

export default function driver() {
    const {loginUser} = useContext(AuthContext)
    const [page, setPage] = useState('user')
    const [formData, setFormData] = useState({})
    // why the last Register didn't go through (shown above the Register button)
    const [serverError, setServerError] = useState(null)

    const submit = async (data) => {
        setServerError(null)
        const res = await driverRegister(data)
        if (!res.success) {
            setServerError(res.error)
            return
        }
        // the OTP screen needs the login token, so only go there once logged in
        const login = await loginUser(data.username, data.password)
        if (login.success) router.push('/(protected)/otp')
        else setServerError(`Your account was created, but logging in failed: ${login.error} Please log in.`)
    }

    return (
        <KeyboardAvoidingView
                    className="flex-1 bg-background"
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    
            {
                page == 'user'
                    ? <UserRegisterForm role="Driver" setFormData={setFormData} setPage={setPage}/>
                    : <DriverProfileForm formData={formData} setFormData={setFormData} onSubmit={submit} serverError={serverError}/>
            }
        </KeyboardAvoidingView>
    )
}