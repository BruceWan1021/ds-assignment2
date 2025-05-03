## Distributed Systems - Event-Driven Architecture.

__Name:__ Zhenyang Wan

__Demo__: ....URL of YouTube demo ......

This repository contains the implementation of a skeleton design for an application that manages a photo gallery, illustrated below. The app uses an event-driven architecture and is deployed on the AWS platform using the CDK framework for infrastructure provisioning.

![](./images/arch.png)

### Code Status.

__Feature:__
+ Photographer:
  + Log new Images - Completed and Tested.
  + Metadata updating - Completed and Tested.
  + Invalid image removal - Completed and Tested.  
  + Status Update Mailer - Completed and Tested.
+ Moderator
  + Status updating - Completed and Tested.

### Notes (Optional)
+ Metadata update filtering (through SNS Subscription filterPolicy + Validation within Lambda code)
+ Review message update filtering (Determine whether update.status exists through the inner Lambda by if else)
+ Email notification filtering (status SNS topic → mailer SQS subscription, filterPolicy based on status)

