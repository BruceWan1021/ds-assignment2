import * as cdk from 'aws-cdk-lib';
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from "aws-cdk-lib";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class Assignment2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    //Table
    const imagesTable = new dynamodb.Table(this, "imagesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "imageName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "imagesTable",
    });

    // Integration infrastructure
    const newImageTopic = new sns.Topic(this, "NewImageTopic", {
      displayName: "New Image topic",
    });

    const badImagesQueue = new sqs.Queue(this, "bad-images-q", {
      // # of rejections by consumer (lambda function)
      retentionPeriod: Duration.minutes(5),
    });

    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
      deadLetterQueue: {
        queue: badImagesQueue,
        maxReceiveCount: 1,
      },
      retentionPeriod: Duration.minutes(5),
    });


    // Lambda functions
    const processImageFn = new lambdanode.NodejsFunction(
      this,
      "ProcessImageFn",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/processImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
        }
      }
    );

    const addMetadataFn = new lambdanode.NodejsFunction(
      this,
      "addMetadataFn",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/addMetadata.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
        }
      }
    );

    const deleteInvalidImageFn = new lambdanode.NodejsFunction(
      this,
      "DeleteInvalidImageFn",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/deleteInvalidImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
      }
    );

    const updateStatusFn = new lambdanode.NodejsFunction(
      this,
      "UpdateStatusFn",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/updateStatus.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
        environment: {
          TABLE_NAME: imagesTable.tableName,
        }
      }
    );

    // S3 --> SNS
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(newImageTopic)
    );

    newImageTopic.addSubscription(
      new subs.SqsSubscription(imageProcessQueue)
    );

    newImageTopic.addSubscription(
      new subs.LambdaSubscription(addMetadataFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: ["Caption", "Date", "name"],
          }),
        },
      })
    );

    newImageTopic.addSubscription(
      new subs.LambdaSubscription(updateStatusFn)
    );

    // SQS --> Lambda
    const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    const newDeleteImageSource = new events.SqsEventSource(badImagesQueue, {
      batchSize: 1,
      maxBatchingWindow: cdk.Duration.seconds(5),
    })

    deleteInvalidImageFn.addEventSource(newDeleteImageSource);
    processImageFn.addEventSource(newImageEventSource);

    // Permissions
    imagesBucket.grantRead(processImageFn);
    imagesBucket.grantDelete(deleteInvalidImageFn);

    imagesTable.grantWriteData(processImageFn);
    imagesTable.grantReadWriteData(addMetadataFn);
    imagesTable.grantReadWriteData(updateStatusFn);

    // Output
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });

    new cdk.CfnOutput(this, "newImageTopicArn", {
      value: newImageTopic.topicArn,
    });


  }
}
