const request = require("supertest");
const { app, setDb } = require("../server");

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a lightweight mock of the MongoDB `db` object.
 * Each method can be overridden per-test via the `overrides` argument.
 */
function mockDb(overrides = {}) {
    return {
        collection: () => ({
            find: () => ({ toArray: async () => overrides.users || [] }),
            insertOne: async (doc) => ({ insertedId: "mock-id", ...doc }),
            ...overrides.collection,
        }),
    };
}

// ── /health ──────────────────────────────────────────────────────────────────

describe("GET /health", () => {
    it("returns ok with db disconnected when db not set", async () => {
        setDb(null);
        const res = await request(app).get("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.db).toBe("disconnected");
    });

    it("returns ok with db connected when db is set", async () => {
        setDb(mockDb());
        const res = await request(app).get("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.db).toBe("connected");
    });
});

// ── GET /getUsers ─────────────────────────────────────────────────────────────

describe("GET /getUsers", () => {
    afterEach(() => setDb(null));

    it("returns 503 when DB is not ready", async () => {
        setDb(null);
        const res = await request(app).get("/getUsers");
        expect(res.statusCode).toBe(503);
        expect(res.body.error).toMatch(/not ready/i);
    });

    it("returns empty array when no users exist", async () => {
        setDb(mockDb({ users: [] }));
        const res = await request(app).get("/getUsers");
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });

    it("returns list of users from DB", async () => {
        const fakeUsers = [
            { name: "Pallavi", email: "pallavi@test.com" },
            { name: "Alice", email: "alice@test.com" },
        ];
        setDb(mockDb({ users: fakeUsers }));
        const res = await request(app).get("/getUsers");
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].name).toBe("Pallavi");
    });
});

// ── POST /addUser ─────────────────────────────────────────────────────────────

describe("POST /addUser", () => {
    afterEach(() => setDb(null));

    it("returns 503 when DB is not ready", async () => {
        setDb(null);
        const res = await request(app)
            .post("/addUser")
            .send("name=Test&email=test@test.com");
        expect(res.statusCode).toBe(503);
        expect(res.body.error).toMatch(/not ready/i);
    });

    it("returns 400 when body is empty", async () => {
        setDb(mockDb());
        const res = await request(app)
            .post("/addUser")
            .set("Content-Type", "application/json")
            .send({});
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/empty/i);
    });

    it("adds a user and returns success message", async () => {
        setDb(mockDb());
        const res = await request(app)
            .post("/addUser")
            .type("form")
            .send("name=Pallavi&email=pallavi@test.com");
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe("User Added Successfully");
    });
});
