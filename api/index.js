const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const User = require("./Models/User");
const Post = require("./Models/Post");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const secret = "deepakbhaihtera";
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");

const cookieParser = require("cookie-parser");
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json());
app.use(cookieParser());
const uri =
  "mongodb+srv://meenadeepraj1:Deepak2002@cluster0.igu9hrl.mongodb.net/Blog?retryWrites=true&w=majority";
mongoose
  .connect(uri, {
    // Add this line to use the new Server Discover and Monitoring engine
  })
  .then(() => console.log("DB connection successful!"));
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new user with the hashed password
    const userDoc = await User.create({
      username,
      password: hashedPassword, // Store the hashed password in the database
    });

    console.log(username, password);
    res.json(userDoc);
  } catch (e) {
    res.status(400).json(e);
  }
});
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user by their username
    const userDoc = await User.findOne({ username });

    if (userDoc) {
      // Compare the entered password with the hashed password from the database
      const passwordMatch = await bcrypt.compare(password, userDoc.password);
      console.log(passwordMatch, "let's check password");
      if (passwordMatch) {
        // Passwords match, user is authenticated
        jwt.sign({ username, id: userDoc._id }, secret, (error, token) => {
          if (error) {
            throw error;
          }
          console.log(token, "token");
          res.cookie("token", token).json({
            id: userDoc._id,
            username,
          });
        });
      } else {
        // Passwords do not match, authentication failed
        res.status(401).json({ message: "Authentication failed" });
      }
    } else {
      // User not found, authentication failed
      res.status(401).json({ message: "User not found" });
    }
  } catch (e) {
    res.status(400).json(e);
  }
});
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
  //  console.log(req.cookies,"cookie");
  //  res.json(req.cookies);
});
app.post("/logout", (req, res) => {
  res.clearCookie("token"); // Clear the 'token' cookie
  res.json("ok");
});
app.post("/post", (req, res) => {
  uploadMiddleware.single("file")(req, res, async (err) => {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) throw err;
      const { title, summary, content } = req.body;
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(postDoc);
    }); // Use req.file to access the uploaded file
  });
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});
app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

app.put("/post", async (req, res) => {
  // Handle file upload using the "uploadMiddleware" middleware
  uploadMiddleware.single("file")(req, res, async (err) => {
    // Initialize newPath to null
    let newPath = null;

    if (req.file) {
      // If a file was uploaded, rename it to include the original file extension
      const { originalname, path } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      newPath = path + "." + ext;
      fs.renameSync(path, newPath);
    }

    // Retrieve the user's token from cookies
    const { token } = req.cookies;

    // Verify the user's token with JWT
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Extract necessary data from the request body
      const { id, title, summary, content } = req.body;

      // Find the post document by ID
      const postDoc = await Post.findById(id);

      // Check if the user is the author of the post
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);

      if (!isAuthor) {
        return res.status(403).json({ error: "You are not the author" });
      }

      // Update the post document with new data
      postDoc.title = title;
      postDoc.summary = summary;
      postDoc.content = content;
      postDoc.cover = newPath ? newPath : postDoc.cover;

      // Save the updated post document
      await postDoc.save();

      // Respond with the updated post document
      res.json(postDoc);
    });
  });
});
app.delete("/post/:id", async (req, res) => {
  const { id } = req.params;
  const { token } = req.cookies;

  try {
    // Verify user authentication using the token
    const userInfo = jwt.verify(token, secret);

    // Check if the user is the author of the post
    const postDoc = await Post.findById(id);
    if (!postDoc) {
      // If the post doesn't exist, respond with a 404 Not Found error
      return res.status(404).json({ error: "Post not found" });
    }

    if (postDoc.author.toString() !== userInfo.id) {
      // If the user is not the author, respond with a 403 Forbidden error
      return res.status(403).json({ error: "You are not the author of this post" });
    }

    // If authorized, delete the post using findByIdAndDelete
    const deletedPost = await Post.findByIdAndDelete(id);

    if (deletedPost) {
      res.json({ message: "Post deleted successfully" });
    } else {
      res.status(500).json({ error: "Error while deleting the post" });
    }
  } catch (error) {
    // Handle any errors related to token verification or other operations
    console.error("Error while deleting the post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.listen(4000);
// mongodb+srv://meenadeepraj1:C5m51euSIb409kL8@cluster0.igu9hrl.mongodb.net/?retryWrites=true&w=majority
