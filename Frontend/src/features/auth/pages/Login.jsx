import React, { useState } from "react";
import "../auth.form.scss"
import { useNavigate,Link } from "react-router";
import{useAuth} from "../hooks/useAuth"
const Login =()=>{ 
   const {loading ,handleLogin, error, setError} =useAuth()
   const navigate=useNavigate()

   const [email,setEmail] =useState("")
   const [password,setPassword] =useState("")
   const [validationError, setValidationError] = useState("")

    const handleSubmit=async(e)=>{
       e.preventDefault()
       setValidationError("")
       setError(null)

       // Client-side validation
       if (!email.trim() || !password.trim()) {
         setValidationError("Please fill in all fields")
         return
       }

       const result = await handleLogin({email,password})
       if (result?.success) {
         navigate('/')
       }
    }

    const displayError = validationError || error

     if(loading){
        return (<main><h1> Loading......</h1></main>)
     }
    return (
        <main>
        <div className="form-container">
        <h1>Login</h1>

        {displayError && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
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
              placeholder="Enter password"/>
            </div>
            <button className="button primary-button">Login</button>
        </form>
        <p className="form-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        </div>
        </main>
    )
}


export default Login