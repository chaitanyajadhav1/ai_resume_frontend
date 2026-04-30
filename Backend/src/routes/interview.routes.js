const express = require("express")
const authMiddleware=require("../middlewares/auth.middleware")
const interviewRouter=express.Router()
const interviewController=require("../controllers/intervirw.controller")

const upload=require("../middlewares/file.middlreware")


/**
 * @route POST /api/interview
 * @description generate new interview report on the basis of user self description,resume pdf and job description
 * @access private
 */

interviewRouter.post("/",authMiddleware.authUser,upload.single("resume"),interviewController.generateInterviewController)


/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId,
 * @access private
 */

interviewRouter.get("/report/:interviewId",authMiddleware.authUser,interviewController.getInterviewReportByIdController)

/**
 * @route GET /api/interview/
 * @description get all interview reports of user
 * @access private
 */

interviewRouter.get("/",authMiddleware.authUser,interviewController.getAllInterviewReportsController)


/**
 * @route GET /api/interview/resume/pdf
 * @description generate resume pdf based on user self description and job description
 * @access private
 */

interviewRouter.post("/resume/pdf/:interviewReportId",authMiddleware.authUser,interviewController.generateResumePdfController)   
module.exports=interviewRouter