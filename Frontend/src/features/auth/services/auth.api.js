import axios from "axios"


const api=axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials:true
})

export async function register({username,email,password}){
 try{
    const response=await api.post('/api/auth/register',{
    username,email,password
  })

  return response.data
 } catch(err){
    const message = err.response?.data?.message || "Registration failed. Please try again."
    throw new Error(message)
 }
}


export async function login({email,password}) {

    try{
     const response=await api.post('/api/auth/login',{
    email,password
  })
   return response.data
    }catch(err){
       const message = err.response?.data?.message || "Login failed. Please try again."
       throw new Error(message)
    }
    
}

export async function logout() {
    try {
        const response=await api.get("/api/auth/logout")

        return response.data;

    }catch(err){
      const message = err.response?.data?.message || "Logout failed."
      throw new Error(message)
    }
    
}

export async function getMe() {
    try{
        const response=await api.get("/api/auth/get-me")

        return response.data
    }catch(err){
        // getMe failure is expected when not logged in — don't throw
        return null
    }
}