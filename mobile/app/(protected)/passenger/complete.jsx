import React, { useContext } from 'react'
import PassengerContext from '../../../contexts/PassengerContext'
import RideCompleteFlow from '../../../components/RideCompleteFlow'

// Receipt, then "Rate Driver"
export default function BookingComplete() {
    const { pendingBooking, setPendingBooking } = useContext(PassengerContext)

    return <RideCompleteFlow booking={pendingBooking} role="passenger" onFinish={() => setPendingBooking(null)} />
}
