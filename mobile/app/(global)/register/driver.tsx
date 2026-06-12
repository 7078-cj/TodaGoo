import { View, Text } from 'react-native'
import React, { useState } from 'react'

export default function driver() {
    const [username, setUsername] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    return (
        <View>
        <Text>driver</Text>
        </View>
    )
}