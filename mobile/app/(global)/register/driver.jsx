import { View, Text, ScrollView } from 'react-native'
import React, { useEffect, useState } from 'react'
import UserRegisterForm from '../../../components/UserRegisterForm'
import DriverProfileForm from '../../../components/DriverProfileForm'

export default function driver() {
    const [page, setPage] = useState('user')
    const [formData, setFormData] = useState({})

    useEffect(()=>{
        console.log(formData)
    },[formData])

    return (
        <ScrollView className='flex-1'>
            {
                page == 'user' ? <UserRegisterForm setFormData={setFormData} setPage={setPage}/> 
                : <DriverProfileForm/>
            }
            
            
        </ScrollView>
    )
}