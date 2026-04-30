const pdfParse=require("pdf-parse")

const {generateInterviewReport,generateResumePdf}=require("../services/ai.service")
const interviewReportModel=require("../models/interviewReport.model")


/**
 * 
 *@description Controller to generate interview report based on user self decription , resume and job description 
 */
async function generateInterviewController(req, res) {
  try {
    const { selfDescription, jobDescription } = req.body;

    let resumeText = "";

    // ✅ Handle resume safely
    if (req.file) {
      const resumeContent = await (
        new pdfParse.PDFParse(
          Uint8Array.from(req.file.buffer)
        )
      ).getText();

      resumeText = resumeContent.text;
    }

    // ❗ Validation (important)
    if (!resumeText && !selfDescription) {
      return res.status(400).json({
        message: "Either resume or self description is required",
      });
    }

    // 🤖 Generate AI report
    const interViewReportByAi = await generateInterviewReport({
      resume: resumeText,
      selfDescription,
      jobDescription,
    });

    // 💾 Save to DB
    const InterviewReport = await interviewReportModel.create({
      user: req.user.id,
      resume: resumeText,
      selfDescription,
      jobDescription,
      ...interViewReportByAi,
    });

    res.status(201).json({
      message: "Interview report generated successfully",
      InterviewReport,
    });

  } catch (err) {
    console.log(err);
    const statusCode = err.message?.includes("503") || err.message?.includes("UNAVAILABLE") ? 503 : 500;
    const message = err.message?.includes("503") || err.message?.includes("UNAVAILABLE")
      ? "AI service is temporarily unavailable due to high demand. Please try again in a few minutes."
      : err.message?.includes("quota") || err.message?.includes("429")
        ? "AI API quota exceeded. Please try again later."
        : "Server error";
    res.status(statusCode).json({ message });
  }
}

/**
 * 
 *@description Controller to get interview report by interviewId
 */
async function getInterviewReportByIdController(req,res){
  try {
    const {interviewId} = req.params
    const interviewReport=await interviewReportModel.findOne({_id:interviewId,user:req.user.id})

    if(!interviewReport){
            return res.status(404).json({
                message:"Interview report not found."
            })
    }

    res.status(200).json({
        message:"Interview report fetched successfull.",
        interviewReport
    })
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
}

/**
 * @description get all interview reports of logged in user
 */

async function getAllInterviewReportsController(req,res){
  try {
    const interviewReports=await interviewReportModel.find({user:req.user.id}).sort({createdAt:-1}).select({resume:0,selfDescription:0,jobDescription:0,technicalQuestions:0,behavioralQuestions:0,skillGaps:0,preparationPlan:0})
    res.status(200).json({
        message:"Interview reports fetched successfully",
        interviewReports
    })
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
}


/**
 * @description Controller to generate resume pdf based on user self description and job description
 */

async function generateResumePdfController(req,res){
  try {
    const {interviewReportId}=req.params

    const interviewReport=await interviewReportModel.findById(interviewReportId)
    if(!interviewReport){
      return res.status(404).json({
        message:"Interview report not found."
      })
    } 

    const {resume,selfDescription,jobDescription}=interviewReport

    const pdfBuffer=await generateResumePdf({resume,selfDescription,jobDescription})
    res.set({
      "Content-Type":"application/pdf",
      "Content-Disposition":`attachment; filename=resume_${interviewReportId}.pdf`
      })

    res.send(pdfBuffer)
  } catch (err) {
    console.log(err);
    const statusCode = err.message?.includes("503") || err.message?.includes("UNAVAILABLE") ? 503 : 500;
    const message = err.message?.includes("503") || err.message?.includes("UNAVAILABLE")
      ? "AI service is temporarily unavailable. Please try again in a few minutes."
      : "Failed to generate resume PDF";
    res.status(statusCode).json({ message });
  }
}
    


module.exports={generateInterviewController,getInterviewReportByIdController,getAllInterviewReportsController,generateResumePdfController}