import { KeyboardAvoidingView, Platform } from 'react-native'
import React, { useContext, useState } from 'react'
import UserRegisterForm from '@/components/UserRegisterForm'
import PassengerProfileForm from '@/components/PassengerProfileForm'
import {passengerRegister} from '@/api/passenger'
import {router } from "expo-router";
import AuthContext from '@/contexts/AuthContext'

export default function passenger() {
    const [page, setPage] = useState('user')
    const [formData, setFormData] = useState({})
    const {loginUser} = useContext(AuthContext)
    // why the last Register didn't go through (shown above the Register button)
    const [serverError, setServerError] = useState(null)

    const submit = async (data) => {
        setServerError(null)
        const res = await passengerRegister(data)
        if (!res.success) {
            setServerError(res.error)
            return
        }
        const login = await loginUser(data.username, data.password)
        if (login.success) router.push('/(protected)/otp')
        else setServerError(`Your account was created, but logging in failed: ${login.error} Please log in.`)
    }

    // No ScrollView here: RegisterLayout scrolls the form inside its own sheet
    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {
                page == 'user'
                    ? <UserRegisterForm role="Passenger" setFormData={setFormData} setPage={setPage}/>
                    : <PassengerProfileForm formData={formData} setFormData={setFormData} onSubmit={submit} serverError={serverError}/>
            }
        </KeyboardAvoidingView>
    )
}