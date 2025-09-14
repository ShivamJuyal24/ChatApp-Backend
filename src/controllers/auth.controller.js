import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const createToken = (userId)=>{
     return jwt.sign(
         {id : userId}, process.env.JWT_SECRET, {expiresIn: '7d'}
         ); 
        }
// Register Controller
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required."
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use."
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashed
    });

    const token = createToken(user._id);
    const userSafe = { id: user._id, username: user.username, email: user.email };

    res.status(201).json({
      message: "User registered successfully ✅",
      token,
      user: userSafe
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login Controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials." });

    const token = createToken(user._id);
    const userSafe = { id: user._id, username: user.username, email: user.email };

    res.json({
      message: "Login successful 🎉",
      token,
      user: userSafe
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
