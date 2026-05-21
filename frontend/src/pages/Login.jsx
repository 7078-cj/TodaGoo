import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from "react-redux";
import { loginUser } from '../utils/auth';

function Login() {
  const dispatch = useDispatch()
  const nav = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex-1 flex justify-center items-center p-6">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h2>

          {error && (
            <p className="text-red-500 text-center mb-4">
              {error}
            </p>
          )}

          <form
            onSubmit={(e) => loginUser(e, dispatch, nav, setError)}
            className="flex flex-col space-y-4"
          >
            <label className="flex flex-col text-gray-700 font-medium">
              Username
              <input
                type="text"
                name="username"
                className="mt-1 px-3 py-2 border-2 border-gray-300 rounded-md outline-none focus:border-green-500 text-gray-700"
              />
            </label>

            <label className="flex flex-col text-gray-700 font-medium">
              Password
              <input
                type="password"
                name="password"
                className="mt-1 px-3 py-2 border-2 border-gray-300 rounded-md outline-none focus:border-green-500 text-gray-700"
              />
            </label>

            <button
              type="submit"
              className="w-full py-2 bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-md text-white font-semibold transition"
            >
              Login
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}

export default Login