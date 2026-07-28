require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const chatRouter = require("./routes/chat");
const usersRouter = require("./routes/users");

const app = express();
app.use(cors());

app.use("/audio", express.static(path.join(__dirname, "..", "public", "audio")));
app.use("/api", chatRouter);
app.use("/api", usersRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TerraLingo backend listening on port ${PORT}`);
});

module.exports = app;
