import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in env.ts"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    // 解析状态更新消息
    const { id, status, reason } = snsMessage;

    if (!id || !status || !reason) {
      console.warn("Invalid message format:", snsMessage);
      continue;
    }

    try {
      const { name, email, message }: ContactDetails = {
        name: "Image Moderator",
        email: SES_EMAIL_FROM,
        message: `Image ID: ${id}<br>Status: <b>${status}</b><br>Reason: ${reason}`,
      };

      const params = sendEmailParams({ name, email, message });
      const response = await client.send(new SendEmailCommand(params));
      console.log("Email sent:", response.MessageId);
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }
};

function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Image Review Notification`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>📷 Image Review Notification</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p>${message}</p>
      </body>
    </html>
  `;
}
