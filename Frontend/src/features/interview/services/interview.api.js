import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
    withCredentials: true,
})

/**
 * 
 * @description Generate interview report
 * @param {string} jobDescription 
 * @param {File} resumeFile 
 * @param {string} selfDescription 
 * @returns {Promise<Object>}
 */
export const generateInterviewReport = async ({ jobDescription, resume, selfDescription }) => {

    const formData = new FormData();

    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    if (resume) {
        formData.append("resume", resume);
    }

    const response = await api.post("/api/interview", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }

    }

    )

    return response.data
}


/**
 * 
 * @description Get interview report by interviewId
 * @param {string} interviewId 
 * @returns {Promise<Object>}
 */
export const getInterviewReport = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`)
    return response.data
}


/**
 * 
 * @description Get all interview reports of logged in user
 * @returns {Promise<Object>}
 */
export const getAllInterviewReport = async () => {
    const response = await api.get("/api/interview")
    return response.data
}


/** * @description Generate resume pdf based on user self description and job description
 * @param {string} interviewReportId 
 * @returns {Promise<Blob>}
 */
export const generateResumePdf = async (interviewReportId) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`,null ,{
        responseType:"blob"
    })
    return response.data
}
