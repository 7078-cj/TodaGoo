import { View, Text, ScrollView } from 'react-native'
import React, { useEffect, useState } from 'react'
import UserRegisterForm from '@/components/UserRegisterForm'
import PassengerProfileForm from '@/components/PassengerProfileForm'
import {passengerRegister} from '@/api/passenger'

export default function passenger() {
    const [page, setPage] = useState('user')
    const [formData, setFormData] = useState({})

    useEffect(()=>{
        console.log(formData)
    },[formData])

    const submit = async (data) => {
        const res = await passengerRegister(data)
        console.log(res)
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