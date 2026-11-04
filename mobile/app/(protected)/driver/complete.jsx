import React, { useContext } from 'react'
import DriverContext from '../../../contexts/DriverContext'
import RideCompleteFlow from '../../../components/RideCompleteFlow'

// Receipt, then "Rate Passenger"
export default function BookingComplete() {
    const { acceptedBooking, setAcceptedBooking } = useContext(DriverContext)

    return <RideCompleteFlow booking={acceptedBooking} role="driver" onFinish={() => setAcceptedBooking(null)} />
}
