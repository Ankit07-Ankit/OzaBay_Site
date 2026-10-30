import { randomInt } from "node:crypto";

const generateOTP = () => randomInt(100000, 1000000).toString();

const otpHtmlTemplate = (otp, purpose = "verification") => {
  const isPasswordReset = purpose === "password reset";
  const title = isPasswordReset ? "Reset your password" : "Verify your email";
  const description = isPasswordReset
    ? "Use the code below to reset your OzaBay password."
    : "Use the code below to verify your email address and continue to OzaBay.";
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Your OzaBay verification code</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-card { padding: 32px 24px !important; }
            .otp-code { font-size: 32px !important; letter-spacing: 8px !important; }
          }
        </style>
      </head>
      <body style="margin:0; padding:0; background-color:#f5f2ec; color:#292820; font-family:Arial, Helvetica, sans-serif;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
          Your OzaBay ${purpose} code is ${otp}.
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f2ec;">
          <tr>
            <td align="center" style="padding:40px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
                <tr>
                  <td align="center" style="padding:0 0 20px;">
                    <span style="color:#315d50; font-family:Georgia, 'Times New Roman', serif; font-size:28px; font-weight:bold; letter-spacing:1px;">OzaBay</span>
                  </td>
                </tr>
                <tr>
                  <td class="email-card" style="padding:44px 48px; background-color:#ffffff; border:1px solid #e9e3d8; border-radius:12px;">
                    <p style="margin:0 0 12px; color:#9a7448; font-size:12px; font-weight:bold; letter-spacing:2px; text-align:center; text-transform:uppercase;">OzaBay account security</p>
                    <h1 style="margin:0 0 16px; color:#292820; font-family:Georgia, 'Times New Roman', serif; font-size:28px; font-weight:normal; line-height:1.3; text-align:center;">${title}</h1>
                    <p style="margin:0 0 28px; color:#68665e; font-size:15px; line-height:1.7; text-align:center;">${description}</p>
                    <div class="otp-code" style="margin:0 0 28px; padding:20px 12px; background-color:#f5f2ec; border:1px solid #e9e3d8; border-radius:8px; color:#315d50; font-size:36px; font-weight:bold; letter-spacing:12px; line-height:1.2; text-align:center;">${otp}</div>
                    <p style="margin:0; color:#68665e; font-size:14px; line-height:1.7; text-align:center;">This code expires in <strong style="color:#292820;">10 minutes</strong>. For your security, do not share it with anyone.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:24px 12px 0; color:#89867d; font-size:12px; line-height:1.6;">
                    If you did not request this code, you can safely ignore this email.<br>
                    &copy; OzaBay
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export { generateOTP, otpHtmlTemplate };
