import nodemailer from "nodemailer";
import config from "../config/config.js";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: config.GOOGLE_USER,
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    refreshToken: config.GOOGLE_REFRESH_TOKEN,
  },
});

// verify the connnection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("Email server is ready to take messages");
  }
});

const sendEmail = async (to, subject, text, html) => {
  try {
    const mailOptions = {
      from: `"OzaBay" <${config.GOOGLE_USER}>`,
      to,
      subject,
      text,
      html,
    };
    const delivery = await transporter.sendMail(mailOptions);
    const acceptedRecipients = delivery.accepted.map((recipient) => (
      String(recipient).trim().toLowerCase()
    ));
    if (!acceptedRecipients.includes(to.trim().toLowerCase())) {
      throw new Error("Gmail did not accept the email recipient");
    }
    console.log(`Email accepted by Gmail (${delivery.messageId})`);
  } catch (error) {
    console.error("Error sending email:", {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message,
    });
    throw new Error("Failed to send email", { cause: error });
  }
};

export default sendEmail;
