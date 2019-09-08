//Server Setup
const path = require('path');
const express = require('express');
const publicPath = (path.join(__dirname,'..','public'));
const port = process.env.PORT || 3010;
const socketIO = require('socket.io');
const http = require('http');
const fs = require('fs');

const multer = require('multer');
const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        cb(null, `${ Date.now() }${ path.extname(file.originalname) }`);
    }
})
const upload = multer({
    storage: storage
});

//AWS Setup
const AWS = {};
AWS.service = require('aws-sdk');
AWS.service.config.update({
    region: 'us-east-1'
})
AWS.s3 = new AWS.service.S3();
AWS.uploadParams = {Bucket: 'conorchat'}


const messageG = require('./utils/message');
const isRealString = require('./utils/validation');
const roomService = require('./utils/rooms')
const admins = require('./utils/admins');
const tracked = require('./utils/tracked');

let app = express();
let server = http.createServer(app);
var io = socketIO(server);

app.get('/chatLogs/:room', (req, res) => {
    if(tracked.includes(req.params.room)) {
        res.sendFile(path.join(__dirname, 'chatLogs', req.params.room + '.txt'));
    } else {
        res.status(404).send("This channel does not have tracking enabled, speak to Conor O'Malley or Jonathan Dunlop if you would like it enabled");
    }
})

app.post('/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        console.log('image saved');
        const stream =  fs.createReadStream(req.file.path)
        stream.on('error', function(err) {
            console.log('File Error', err);
        });
        AWS.s3.upload(Object.assign({Body: stream, Key: path.basename(req.file.path)}, AWS.uploadParams), (err, data) => {
            if (err) {
                console.log(err);
            } if (data) {
                fs.unlink(req.file.path, err => {
                    if(err) {
                        console.log(err);
                        return;
                    }
                })
                res.status(200).send({filename: req.file.filename});
            }
        })
    } else {
        console.log("No Image Uploaded")
        return res.status(404).send('Bad Request.');
    }
});

app.use(express.static(publicPath));

io.on('connection',(socket) => {
    console.log("New connectipn: " + socket.id);
    socket.on('join', (params, callback) => {
        const roomId = params.room;

        if(!isRealString(params.name) || !isRealString(roomId)){
            return callback('Name and room name are required');
        }

        if(params.random){
            params.color = [Math.random(),Math.random(),Math.random()]
                           .map(num => Math.floor(num*170).toString(16).padStart(2,'0'))
                           .reduce((acc,cur) => acc+cur,'#');
        }

        const admin = admins.some(admin => admin.pass === params.pass && admin.room === roomId);
        let room = roomService.getRoom(roomId);
        if (!room) {
            room = roomService.makeRoom(roomId)
        }
        
        socket.join(roomId);
        room.removeUser(socket.id);

        const user = room.addUser(socket.id,params.name,roomId,params.color, admin);

        io.to(roomId).emit('updateUserList', room.getUserList());
        if (room.history) socket.emit('massMessageList', room.messageHistory);
        socket.emit('newMessage',messageG('Admin',"Hey " + params.name + ", Welcome to the server"));
        socket.broadcast.to(roomId).emit('newMessage',messageG('Admin', params.name + " has joined the server"));

        socket.on('createMessage', (messageP, callback) => {
            if (room.locked && !admin) return callback('Room Locked');
            const message = (typeof messageP === 'object') ?
                messageG(user.name, false , user.color, messageP.url) :
                messageG(user.name, messageP, user.color);
            if(tracked.includes(roomId)) {
                fs.appendFile(path.join(__dirname, 'chatLogs', roomId + '.txt'), `[${message.createdAt}] ${message.name}: ${message.text || message.url} \n`, (err) => {
                    if (err) console.log(err);
                });
            }
            if (room.history) room.messageHistory.push(message);
            io.to(user.room).emit('newMessage', message);
        });

        socket.on('disconnect', () => {
            room.removeUser(socket.id);
            if(user){
                io.to(user.room).emit('updateUserList', room.getUserList(user.room));
                io.to(user.room).emit('newMessage',messageG('Admin', user.name + " disconnected."));
            }
        });

        if (admin) {
            callback(true);
            console.log('Admin joined for room ' + roomId);
            socket.on("toggleChatHistory", (get, cb) => {
                if (get) return cb(room.history);
                room.history = !room.history;
                cb(room.history);
                if(room.history) {
                    room.timeout = setTimeout(() => {
                        room.messageHistory = [];
                        room.history = false;
                    }, 4 * 60 * 60 * 1000);
                } else {
                    room.messageHistory = [];
                    clearTimeout(room.timeout);
                } 
            });
            socket.on("toggleChatLock", (get, cb) => {
                if (get) return cb(room.locked);
                room.locked = !room.locked;
                cb(room.locked);
                if(room.locked) {
                    io.to(roomId).emit('newMessage', messageG('Admin', 'The chatroom has been locked'));
                } else {
                    io.to(roomId).emit('newMessage', messageG('Admin', 'The chatroom has been unlocked'));
                }
            })
            socket.on("emergency", cb => {
                if (!room.locked) room.locked = !room.locked;
                room.messageHistory = [];
                cb(room.locked);
                if(room.locked) {
                    io.to(roomId).emit('newMessage', messageG('Admin', 'The chatroom has been locked'));
                } else {
                    io.to(roomId).emit('newMessage', messageG('Admin', 'The chatroom has been unlocked'));
                }
                io.to(roomId).emit('clearChat');
            })
        }
    });
});


server.listen(port, () => {
    console.log("Listeing on port " + port);
});
