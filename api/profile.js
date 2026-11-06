import { profileApi } from "../profiles.js";
export default async function handler(req, res) {
  const { status, body } = await profileApi(req.method, req.query, req.body);
  res.status(status).json(body);
}
