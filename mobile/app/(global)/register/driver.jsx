import { View, Text, ScrollView } from 'react-native'
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
            res.success && router.push('/(protected)/driver/home')
        }
        
    }

    return (
        <ScrollView className='flex-1'>
            {
                page == 'user' ? <UserRegisterForm setFormData={setFormData} setPage={setPage}/> 
                : <DriverProfileForm setFormData={setFormData} onSubmit={submit}/>
            }
            
            
        </ScrollView>
    )
}