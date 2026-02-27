const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

mongoose.connect("mongodb://127.0.0.1:27017/rpspro")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  friends: [String]
});

const User = mongoose.model("User", userSchema);

const JWT_SECRET = "supersecretkey";

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed, friends: [] });
  res.json({ message: "User created" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ username }, JWT_SECRET);
  res.json({ token });
});

let onlineUsers = {};

io.on("connection", (socket) => {
  socket.on("login", (username) => {
    onlineUsers[username] = socket.id;
  });

  socket.on("challenge", ({ from, to }) => {
    if (onlineUsers[to]) {
      io.to(onlineUsers[to]).emit("challengeReceived", from);
    }
  });

  socket.on("move", ({ from, to, move }) => {
    if (onlineUsers[to]) {
      io.to(onlineUsers[to]).emit("opponentMove", { from, move });
    }
  });

  socket.on("disconnect", () => {
    for (let user in onlineUsers) {
      if (onlineUsers[user] === socket.id) {
        delete onlineUsers[user];
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});