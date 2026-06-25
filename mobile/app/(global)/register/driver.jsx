import { View, Text, ScrollView } from 'react-native'
import React, { useContext, useEffect, useState } from 'react'
import UserRegisterForm from '../../../components/UserRegisterForm'
import DriverProfileForm from '../../../components/DriverProfileForm'
import {driverRegister} from '../../../api/driver'
import AuthContext from '@/contexts/AuthContext'

export default function driver() {
    const {loginUser} = useContext(AuthContext)
    const [page, setPage] = useState('user')
    const [formData, setFormData] = useState({})

    const submit = async (data) => {
        const res = await driverRegister(data)
        if(res.success){
            const login = await loginUser(formData.email, formData.password)
            console.log(login)
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