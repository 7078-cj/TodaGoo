import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from "react-redux";
import { loginUser } from '../utils/auth';
import TodaGoo from '../assets/TodaGoo.svg'
import TodaGooLogo from '../assets/TodaGoo_Logo.svg'
import { EyeClosed, EyeIcon } from 'lucide-react';

function Login() {
  const dispatch = useDispatch()
  const nav = useNavigate()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [error]);

  const inputStyle = "px-3 py-4 rounded-lg outline-none bg-green-200 focus:border-1 border-green-500 text-gray-700 my-1"

  return (
    <div className="grid grid-cols-[60%_40%] min-h-screen bg-gray-100">

      <div className="bg-gradient-to-b from-[#a8c3b0] via-[#d9c9a8] to-[#e8c39b]">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-full max-w-lg">
            <img src={TodaGooLogo} alt="TODA GOO LOGO" className="w-full mx-auto mt-20" />
            <img src={TodaGoo} alt="TODA GOO" className="w-full" />
          </div>
          
        </div>
        
      </div>
      

      {/* login form */}
      <div className="p-4 flex items-center justify-center flex-1">
        <div className="w-full max-w-[75%] ">
          <h2 className="text-6xl font-semibold mb-6 text-center text-gray-800">Welcome</h2>

          {error && (
            <p className="text-red-500 text-center mb-4">
              {error}
            </p>
          )}

          <form
            onSubmit={(e) => loginUser(e, dispatch, nav, setError, setLoading)}
            className="flex flex-col space-y-4"
          >
            <label className="flex flex-col text-gray-700 font-medium">
              Username
              <input
                type="text"
                name="username"
                className={inputStyle}
                placeholder="username"
              />
            </label>

            <label className="flex flex-col text-gray-700 font-medium">
              Password
              <div className={`flex flex-row justify-between items-center ${inputStyle}`}>
                
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="flex-1 bg-transparent outline-none w-full"
                  placeholder="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-sm text-green-600 mt-1 self-end"
                >
                  {showPassword ? <EyeIcon /> : <EyeClosed />}
                </button>
              </div>
            </label>

            <div className="flex justify-center mt-6">
              <button
                type="submit"
                disabled={loading}
                className={`w-[40%] py-4 text-2xl bg-green-500 hover:bg-green-600 ${loading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"} active:bg-green-700 rounded-full text-white transition`}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </div>

            
          </form>
        </div>

      </div>
      
    </div>
  )
}

export default Login