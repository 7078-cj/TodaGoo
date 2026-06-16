import { View, Text, ScrollView } from 'react-native'
import React, { useState } from 'react'
import UserRegisterForm from '../../../components/UserRegisterForm'
import DriverProfileForm from '../../../components/DriverProfileForm'

export default function driver() {

    return (
        <ScrollView className='flex-1'>
            <UserRegisterForm/>
            <DriverProfileForm/>
        </ScrollView>
    )
}