import { SQSHandler } from "aws-lambda";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
    console.log("Event received: ", JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const recordBody = JSON.parse(record.body);         // SQS message body
            const snsMessage = JSON.parse(recordBody.Message);  // SNS message

            if (snsMessage.Records) {
                console.log("Record body: ", JSON.stringify(snsMessage));

                for (const messageRecord of snsMessage.Records) {
                    const s3e = messageRecord.s3;
                    const srcBucket = s3e.bucket.name;
                    const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

                    console.log(`Deleting file from S3: ${srcBucket}/${srcKey}`);

                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: srcBucket,
                            Key: srcKey,
                        })
                    );

                    console.log(`Deleted file: ${srcKey}`);
                }
            } else {
                console.warn("No S3 Records found in SNS message.");
            }
        } catch (err) {
            console.error("Failed to process DLQ record:", err);
        }
    }
};
