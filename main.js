//
// minicomment: A very mini comment system.
// This can be embedded with your mini blogging platform.
// Users can post comments anonymously, given that they can pass a captcha check.
// Data are stored locally on a sqlite databse.
// 

const express = require("express");
const cors = require("cors");
const database = require("./database");
const sanitizeHTML = require("sanitize-html");
const app = express();
app.use(cors());
app.use(express.json());
let captchas = {};

// Configurations
const captchaFont = "bitMatrix-A2.ttf";
const captchaLength = 4;
const captchaSize = [190, 72];
const port = 30001;

// Some test-and-set initializations
const db = database.initializeDatabase("comments.sqlite3");

//
// Shows the comments under post url, or ID, or some identifier.
// You can also see the number of stars under the comment.
//
app.get("/comments", (req, res) => {
    let ret = {};
    if (!req.query.post) {
        res.writeHead(404);
        ret.error = "post parameter needed";
        res.end(JSON.stringify(ret));
        return;
    }

    res.writeHead(200);
    database.getPost(db, req.query.post, post => {
        ret.post = post;
        res.end(JSON.stringify(ret));
    });
});

//
// Generates a captcha challenge.
// We don't care about where it is generated; but every comment post requires
// a valid captcha challenge ID and its correct result.
//
app.get("/captcha", (req, res) => {
    res.writeHead(200);
    res.end("Generating a random captcha");
});

// 
// Post a comment.
// Username, comment body, captcha ID and captcha required.
// 
app.post("/comment", (req, res) => {
    let ret = {};
    
    if (!("post" in req.body && "username" in req.body && "content" in req.body)) {
        ret.error = "something is missing";
        res.end(JSON.stringify(ret));
        return;
    }

    let identifier = req.body.post;
    let username = sanitizeHTML(req.body.username).trim();
    let content = sanitizeHTML(req.body.content).trim();

    if (username == "" || content == "") {
        ret.error = "nice try";
        res.end(JSON.stringify(ret));
        return;
    }

    database.commentPost(db, identifier, 
        username, 
        content, 
        (err) => {
            ret.post = identifier;
            if (err) {
                ret.error = "error code:" + err.errno;
            }
            res.end(JSON.stringify(ret));
        }
    );
});

//
// Star a post.
// We don't care about repetitive stars; this is a problem you will have to solve yourself.
// Maybe using cookie or something?
// If someone is cool enough to figure out other ways to repetitively star your post,
// Then they must love your post a lot.
// 
app.post("/star", (req, res) => {
    let ret = {};

    if (!("post" in req.body)) {
        ret.error = "post parameter needed";
        res.end(JSON.stringify(ret));
        return;
    }

    let identifier = req.body.post;
    database.starPost(db, identifier);

    ret.post = identifier;
    res.end(JSON.stringify(ret));
    return;
});

app.listen(port, () => {
    console.log("minicomment is running at port", port, ".");
});
