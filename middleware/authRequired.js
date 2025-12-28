import User from "../models/User.js";

export default async function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = auth.replace("Bearer ", "");
  const user = await User.findOne({ token });

  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = user;
  next();
}
