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

    const submit = async (data) => {
        const res = await driverRegister(data)
        if(res.success){
            const login = await loginUser(formData.username, formData.password)
            res.success && router.push('/(protected)/otp')
        }
        
    }

    return (
        <KeyboardAvoidingView
                    className="flex-1 bg-background"
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    
            {
                page == 'user'
                    ? <UserRegisterForm role="Driver" setFormData={setFormData} setPage={setPage}/>
                    : <DriverProfileForm setFormData={setFormData} onSubmit={submit}/>
            }
        </KeyboardAvoidingView>
    )
}