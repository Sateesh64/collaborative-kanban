const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

function createToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Enter a name, valid email and password of 8-72 bytes"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    const token = createToken(user.id);

    return res.status(201).json({
      message: "Registration successful",
      user,
      token
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Email is already registered"
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Unable to register user"
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token: createToken(user.id)
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Unable to log in"
    });
  }
}

module.exports = { register, login };
