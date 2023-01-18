//
// Database operations
//

const fs = require("fs");
const sqlite3 = require("sqlite3");

// 
// Test-and-set creates initial database.
//
function initializeDatabase(filename) {
    db = new sqlite3.Database(filename);
    
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY,
        identifier TEXT NOT NULL,
        stars INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY,
        identifier TEXT NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    return db;
}

//
// Star a post - if the post doesn't exist, create it.
//
function starPost(db, identifier) {
    const query = `SELECT * FROM posts WHERE identifier=?`;
    db.get(query, identifier, (err, row) => {
        if (err) {
            throw err;
        }
        if (!row) {
            db.run(`INSERT INTO posts (identifier, stars) VALUES (?, 1)`, identifier, (err) => {
                if (err) {
                    throw err;
                }
            });
        } else {
            db.run(`UPDATE posts SET stars=? WHERE identifier=?`, row.stars + 1, identifier, (err) => {
                if (err) {
                    throw err;
                }
            });
        }
    });
}

//
// Comment on a post - if the post doesn't exist, create it.
//
function commentPost(db, identifier, username, content, callback) {
    const query = `SELECT * FROM posts WHERE identifier=?`;

    db.get(query, identifier, (err, row) => {
        if (err) { 
            callback(err); 
            return;
        }
        if (!row) {
            let erred = false;
            db.run(`INSERT INTO posts (identifier, stars) VALUES (?, 0)`, identifier, (err) => {
                if (err) {
                    erred = true;
                    callback(err);
                }
            });
            if (erred) {
                return;
            }
        }

        db.run(`INSERT INTO comments (identifier, username, content) VALUES (?, ?, ?)`,
            identifier,
            username,
            content, 
            (err) => {
                callback(err);
            }
        );
    });
}

// 
// Get all information about a post.
//
function getPost(db, identifier, callback) {
    const query = `SELECT * FROM posts WHERE identifier=?`;

    db.get(query, identifier, (err, row) => {
        if (err) { throw err; }
        if (!row) {
            callback({
                "post": identifier,
                "stars": 0,
                "comments": []
            });
            return;
        }
        let stars = row.stars;

        db.all(`SELECT * FROM comments WHERE identifier=?`, identifier, (err, rows) => {
            if (err) { throw err; }
            let comments = [];
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                comments.push({
                    id: row.id,
                    username: row.username,
                    content: row.content,
                    created: row.created
                });
            }
            
            callback({
                "post": identifier,
                "stars": stars,
                "comments": comments
            });
        });
    });
}

// 
// Content moderation!
//
function deleteComment(db, id) {
    db.run(`DELETE FROM comments WHERE id=?`, id, (err) => {
        if (err) { throw err; }
    });
}

//
// Delete a post and all its comments
//
function deletePost(db, identifier) {
    const query = `SELECT * FROM posts WHERE identifier=?`;

    db.get(query, identifier, (err, row) => {
        if (err) { throw err; }
        if (!row) {
            return;
        }
        db.run(`DELETE FROM posts WHERE identifier=?`, identifier, err => {
            if (err) { throw err; }
        });
        db.run(`DELETE FROM comments WHERE identifier=?`, identifier, err => {
            if (err) { throw err; }
        });
    });
}

module.exports = {
    initializeDatabase,
    getPost,
    commentPost,
    starPost
};
