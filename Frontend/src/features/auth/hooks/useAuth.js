 import { AuthContext } from "../auth.context";
import { useContext } from "react";
import { useEffect, useState } from "react";
 import {login,register,logout,getMe} from "../services/auth.api";


 export const useAuth=()=>{
    const context=useContext(AuthContext)
    const {user,setUser,loading ,setLoading}=context
    const [error, setError] = useState(null)

    const handleLogin=async({email,password})=>{
        setLoading(true)
        setError(null)
        try{
        const data=await login({email,password})
        setUser(data.user)
        return { success: true }
        }catch(err){
        setError(err.message || "Login failed")
        return { success: false, error: err.message }
        }finally{
           setLoading(false)
        }
        
    }

    const handleRegister=async({username,email,password})=>{
        setLoading(true)
        setError(null)
       try{
        const data=await register({username,email,password})
        setUser(data.user)
        return { success: true }
       }catch(err){
        setError(err.message || "Registration failed")
        return { success: false, error: err.message }
       }finally{
        setLoading(false)
       }
    }

    const handleLogout =async ()=>{
        setLoading(true)
        setError(null)
       try{
        const data=await logout()
        setUser(null)
       }catch(err){
        setError(err.message || "Logout failed")
       }finally{
        setLoading(false)
       }
    }
    

    
    useEffect(()=>{
        const getAndSetUser=async()=>{
            try{
           const data=await getMe()
           if (data && data.user) {
             setUser(data.user)
           }
            }catch(err){}finally{
            setLoading(false)
            }
          
        }

        getAndSetUser()
    },[])

      return{user,loading,error,setError,handleRegister,handleLogin,handleLogout}
 }