import { Task } from "effect-start";
import { AwsSqs } from "effect-start/x/aws-sqs";

export default Task.layer(AwsSqs.layer);
