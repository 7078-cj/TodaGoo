import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

function DashBoard() {
  const nav = useNavigate()
  const user = useSelector((state) => state.auth.user)

  useEffect(() => {

    const department = user?.department

    if (!user) {
      nav("/login")
      return
    }

    if (department === "MDRRMO") {
      nav("/mdrrmo")
    } else if (department === "TODA") {
      nav("/toda")
    } else {
      nav("/unauthorized")
    }
  }, [user, nav])

  return <div>Loading...</div>
}

export default DashBoard