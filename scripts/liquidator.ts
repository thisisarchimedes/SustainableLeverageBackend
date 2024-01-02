import { Context } from "aws-lambda/handler";
import { handler } from "../src/liquidator/lambda-handler";

(async () => {
  await handler({}, { callbackWaitsForEmptyEventLoop: false } as Context);
})();