import React, { useState } from "react";
import {useNavigate, Link} from "react-router";
import { useAuth } from "../hooks/useAuth";
import "../auth.form.scss"

const Register =()=>{

    const navigate =useNavigate()
    const [email,setEmail]=useState("");
    const [username,setUsername]=useState("")
    const [password,setPassword]=useState("")
    const [validationError, setValidationError] = useState("")
    
    const {loading ,handleRegister, error, setError}=useAuth()



    const handleSubmit=async (e)=>{
     e.preventDefault()
     setValidationError("")
     setError(null)

     // Client-side validation
     if (!username.trim() || !email.trim() || !password.trim()) {
       setValidationError("Please fill in all fields")
       return
     }

     if (password.length < 6) {
       setValidationError("Password must be at least 6 characters")
       return
     }

     const result = await handleRegister({username,email,password})
     if (result?.success) {
       navigate('/')
     }
    }

    const displayError = validationError || error

    return (
        <main>
        <div className="form-container">
        <h1>Register</h1>

        {displayError && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input 
              onChange={(e)=>{setUsername(e.target.value)}}
              type="text" id="username" name="username" 
              placeholder="Enter username"/>
            </div>

            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input 
              onChange={(e)=>{setEmail(e.target.value)}}
              type="email" id="email" name="email" 
              placeholder="Enter email address"/>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
              onChange={(e)=>{setPassword(e.target.value)}}
              type="password" id="password" name="password" 
              placeholder="Enter password (min 6 characters)"/>
            </div>

            <button className="button primary-button">Register</button>
        </form>
        <p className="form-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
        </div>
        </main>
    )
}


export default Register
