import { SNSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const ddbDocClient = createDdbClient();

export const handler: SNSHandler = async (event) => {
    console.log("SNS Event:", JSON.stringify(event));

    for (const record of event.Records) {
        const snsMessage = record.Sns.Message;
        let data;

        try {
            data = JSON.parse(snsMessage);
        } catch (err) {
            console.error("Failed to parse SNS message:", snsMessage);
            continue;
        }

        const { id, update } = data;

        if (!id || !update?.status || !update?.reason) {
            console.error("Missing required fields in message:", data);
            continue;
        }

        try {
            await ddbDocClient.send(
                new UpdateCommand({
                    TableName: process.env.TABLE_NAME,
                    Key: { imageName: id },
                    UpdateExpression: "SET #s = :status, #r = :reason",
                    ExpressionAttributeNames: {
                        "#s": "status",
                        "#r": "reason",
                    },
                    ExpressionAttributeValues: {
                        ":status": update.status,
                        ":reason": update.reason,
                    },
                })
            );

            const snsClient = new SNSClient({ region: process.env.REGION });

            await snsClient.send(
                new PublishCommand({
                    TopicArn: process.env.STATUS_TOPIC_ARN,
                    Message: JSON.stringify({
                        id,
                        status: update.status,
                        reason: update.reason,
                    }),
                })
            );
        } catch (err) {
            console.error(err);
        }
    }
};

function createDdbClient() {
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
