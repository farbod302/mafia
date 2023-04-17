const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server, Socket } = require("socket.io");
const Jwt = require('./helpers/jwt');
const reject = require('./helpers/reject_handler');
const cors = require("cors")
const bodyParser = require("body-parser");
const Imports = require('./helpers/imports');
const mongoose=require("mongoose");
const SocketProvider = require('./socket');
require('dotenv').config()
app.use(cors())
app.use(bodyParser.json())

mongoose.connect(process.env.DB,()=>{console.log("connected to DB");})
const verify_token = (req, res, next) => {
    const { token } = req.body
    if (!token) return next()
    const user = Jwt.verify(token)
    if (!user) return reject(2, res)
    req.body["user"] = user
    next()
}

app.use(verify_token)

const io = new Server(server, {
    cors: {
        origin: "*",
    }
});
let socket =new SocketProvider(io)
socket.lunch()
let keys= Object.keys(Imports)

keys.forEach(key => {
    app.use(`/${key}`,Imports[key])
});

app.use("/files",express.static("./files"))


server.listen(process.env.PORT, () => { console.log("Server Run"); })