const express = require("express");
const app = express();
const MongoClient = require("mongodb").MongoClient;

const PORT = process.env.PORT || 5050;
const MONGO_URL = process.env.MONGO_URL || "mongodb://mongo-service:27017";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

const client = new MongoClient(MONGO_URL);

let db;

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", db: db ? "connected" : "disconnected" });
});

// GET all users
app.get("/getUsers", async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not ready yet, try again in a moment." });
    const data = await db.collection("users").find({}).toArray();
    res.json(data);
});

// POST new user
app.post("/addUser", async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not ready yet, try again in a moment." });
    const userObj = req.body;
    if (!userObj || Object.keys(userObj).length === 0) {
        return res.status(400).json({ error: "Request body is empty." });
    }
    console.log(userObj);
    await db.collection("users").insertOne(userObj);
    console.log("Data inserted in DB");
    res.json({ message: "User Added Successfully" });
});

// Only start listening when run directly (not when imported by tests)
if (require.main === module) {
    app.listen(PORT, () => console.log(`server running on port ${PORT}`));
    connectDB();
}

module.exports = { app, connectDB, setDb: (d) => { db = d; } };

// Connect to MongoDB, then start server
// Retries every 3 seconds so it survives the mongo pod being slow to start
async function connectDB() {
    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            await client.connect();
            console.log("Connected successfully to MongoDB");
            db = client.db("pallavi-db");
            return; // success
        } catch (err) {
            console.error(`MongoDB connection attempt ${attempt} failed: ${err.message}`);
            if (attempt < 10) {
                console.log("Retrying in 3 seconds...");
                await new Promise(res => setTimeout(res, 3000));
            } else {
                console.error("Could not connect to MongoDB after 10 attempts. Exiting.");
                process.exit(1);
            }
        }
    }
}

connectDB();