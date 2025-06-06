import { SQSHandler } from "aws-lambda";
import {
    GetObjectCommand,
    PutObjectCommandInput,
    GetObjectCommandInput,
    S3Client,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client();
const ddbDocClient = createDDbDocClient();

export const handler: SQSHandler = async (event) => {
    console.log("Event ", JSON.stringify(event));
    for (const record of event.Records) {
        const recordBody = JSON.parse(record.body);        // Parse SQS message
        const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

        if (snsMessage.Records) {
            console.log("Record body ", JSON.stringify(snsMessage));
            for (const messageRecord of snsMessage.Records) {
                const s3e = messageRecord.s3;
                const srcBucket = s3e.bucket.name;
                // Object key may have spaces or unicode non-ASCII characters.
                const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

                if (!srcKey.endsWith(".jpeg") && !srcKey.endsWith(".png")) {
                    console.error(`Invalid file type: ${srcKey}`);
                    throw new Error(`Invalid file type: ${srcKey}`);
                }
                let origimage = null;
                try {
                    // Download the image from the S3 source bucket.
                    const params: GetObjectCommandInput = {
                        Bucket: srcBucket,
                        Key: srcKey,
                    };
                    origimage = await s3.send(new GetObjectCommand(params));
                    
                    const commandOutput = await ddbDocClient.send(
                        new PutCommand({
                          TableName: process.env.TABLE_NAME!,
                          Item: {
                            imageName: srcKey,
                            status: "Pending",
                          },
                        })
                      );
                    
                } catch (error) {
                    console.log(error);
                }
            }
        }
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    return DynamoDBDocumentClient.from(ddbClient, {
        marshallOptions: {
            convertEmptyValues: true,
            removeUndefinedValues: true,
            convertClassInstanceToMap: true,
        },
        unmarshallOptions: {
            wrapNumbers: false,
        },
    });
}
