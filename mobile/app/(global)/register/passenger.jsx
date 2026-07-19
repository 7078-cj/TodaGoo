import { View, Text, ScrollView } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
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
            const login = await loginUser(formData.email, formData.password)
            res.success && router.push('/(protected)/passenger/home')
        }
    }

    return (
        <ScrollView className='flex-1'>
            {
                page == 'user' ? <UserRegisterForm setFormData={setFormData} setPage={setPage}/> 
                : <PassengerProfileForm setFormData={setFormData} onSubmit={submit}/>
            }
            
            
        </ScrollView>
    )
}