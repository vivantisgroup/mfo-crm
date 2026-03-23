import { onRequest } from "firebase-functions/v2/https";

export const ping = onRequest({ region: "us-central1" }, (_req, res) => {
  res.status(200).send("ok");
});
