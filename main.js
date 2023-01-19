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
const PImage = require("pureimage");
const uuid = require("uuid");
const app = express();
app.use(cors());
app.use(express.json());
let captchas = {};

// Configurations
const captchaFont = "./bitMatrix-A2.ttf";
const captchaLength = 4;
const captchaSize = [190, 72];
const port = 30001;

const sanitizeConf = {
    allowedTags: [ 'b', 'i', 'em', 'strong', 'a' ],
    allowedAttributes: {
        'a': [ 'href' ]
    }
};
const strictSanitizeConf = {
    allowedTags: []
};

const font = PImage.registerFont(captchaFont, "bitMatrix");
font.load(() => {
});

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
    //
    // Generates code from 0-9, A-Z
    //
    function genCode(len) {
        let ret = "";

        for (let i = 0; i < len; i++) {
            let r = Math.floor(Math.random() * 36);

            // No 0s and Os
            if (r == 0 || r == 24) {
                i -= 1;
                continue;
            }
            
            if (r < 10) {
                ret += String.fromCharCode(48 + r);
            } else {
                ret += String.fromCharCode(65 + r - 10);
            }
        }
        return ret;
    }

    //
    // Generates the image itself
    //
    function genImage(code) {
        const img = PImage.make(captchaSize[0], captchaSize[1]);
        const ctx = img.getContext("2d");

        function randomPoint() {
            return [
                Math.floor(Math.random() * captchaSize[0]),
                Math.floor(Math.random() * captchaSize[1])
            ];
        }

        // Random lines and shapes
        let numLines = 5 + Math.floor(Math.random() * 40); 
        // let numCircles = 5 + Math.floor(Math.random() * 5);

        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#777777";

        // for (let i = 0; i < numCircles; i++) {
        //     let p = randomPoint();
        //     let r = 5 + Math.floor(Math.random() * 20.0);
            
        //     let counter = Math.floor() < 0.5;
        //     ctx.beginPath();
        //     ctx.arc(p[0], p[1], r, 0, 1.0 * Math.PI + Math.random() * Math.PI, counter);
        //     ctx.fill();
        // }

        for (let i = 0; i < numLines; i++) {
            ctx.beginPath();
            let p1 = randomPoint();
            let p2 = randomPoint();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.stroke();
        }

        ctx.font = "48pt bitMatrix";
        ctx.fillStyle = "#000000";
        let x = 10;

        for (let i = 0; i < code.length; i++) {
            ctx.save();
            ctx.rotate((Math.random() * 2.0 - 1.0) * 0.1);
            ctx.translate(x, captchaSize[1] - 10.0);
            ctx.fillText(code[i], 0, 0);
            ctx.restore();
            x += 48;
        }

        return img;
    }

    // Generate a random ID
    let id = uuid.v4();
    let time = new Date();
    let code = genCode(captchaLength);

    captchas[id] = {
        time,
        code
    };

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
    res.setHeader("Access-Control-Expose-Headers", "X-UUID");
    res.setHeader("X-UUID", id);
    res.writeHead(200);
    PImage.encodePNGToStream(genImage(code), res);
});

// 
// Post a comment.
// Username, comment body, captcha ID and captcha required.
// 
app.post("/comment", (req, res) => {
    let ret = {};

    if (!("post" in req.body && "username" in req.body && "content" in req.body &&
        "captcha" in req.body && "captchaID" in req.body)) {
        ret.error = "something is missing";
        res.end(JSON.stringify(ret));
        return;
    }

    if (!(req.body.captchaID in captchas)) {
        ret.error = "no such challenge";
        res.end(JSON.stringify(ret));
        return;
    }

    if (captchas[req.body.captchaID].code != req.body.captcha.trim().toUpperCase()) {
        ret.error = "captcha challenge failed";
        res.end(JSON.stringify(ret));
        return;
    }

    let identifier = req.body.post;
    let username = sanitizeHTML(req.body.username, strictSanitizeConf).trim();
    let content = sanitizeHTML(req.body.content, sanitizeConf).trim().replaceAll("\n", "<br />");

    if (username == "" || content == "") {
        ret.error = "nice try";
        res.end(JSON.stringify(ret));
        return;
    }

    delete captchas[req.body.captchaID];

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
