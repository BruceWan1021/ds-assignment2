import { SNSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: SNSHandler = async (event) => {
  console.log("SNS Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const attributes = record.Sns.MessageAttributes;

    const id = message.id;
    const value = message.value;
    const metadataType = attributes?.metadata_type?.Value;

    if (!["Caption", "Date", "name"].includes(metadataType)) {
      console.warn(`Ignored metadata_type: ${metadataType}`);
      continue;
    }

    const attributeMap: Record<string, string> = {
      Caption: "caption",
      Date: "date",
      name: "photographerName",
    };

    const fieldName = attributeMap[metadataType];

    try {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: process.env.TABLE_NAME!,
          Key: { imageName: id },
          UpdateExpression: `SET ${fieldName} = :val`,
          ExpressionAttributeValues: {
            ":val": value,
          },
        })
      );
    } catch (error) {
      console.error(`Failed to update metadata for ${id}`, error);
    }
  }
};
