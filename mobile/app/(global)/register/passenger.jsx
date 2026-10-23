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

    const submit = async (data) => {
        const res = await passengerRegister(data)
        if(res.success){
            const login = await loginUser(formData.username, formData.password)
            login.success && router.push('/(protected)/passenger/home')
        }
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
                    : <PassengerProfileForm formData={formData} setFormData={setFormData} onSubmit={submit}/>
            }
        </KeyboardAvoidingView>
    )
}