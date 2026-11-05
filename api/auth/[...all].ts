import { auth } from "../../lib/auth.js";
import { toNodeHandler } from "better-auth/node";

const authHandler = toNodeHandler(auth);

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  return authHandler(req, res);
}