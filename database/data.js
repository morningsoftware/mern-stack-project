require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const DATABASE_NAME = "mern";

async function seedDevelopment() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("Set MONGODB_URI before running this script.");
    }

    // Safety check: this script is only for sample data.
    if (process.env.SEED_DEVELOPMENT !== "true") {
        throw new Error(
            "Set SEED_DEVELOPMENT=true to confirm sample data insertion."
        );
    }

    const client = new MongoClient(uri);

    // Generate IDs so documents can reference one another.
    const ids = {
        users: {
            alex: new ObjectId(),
            sam: new ObjectId(),
            jordan: new ObjectId(),
            taylor: new ObjectId()
        },
        team: new ObjectId(),
        project: new ObjectId(),
        milestone: new ObjectId(),
        task1: new ObjectId(),
        task2: new ObjectId(),
        bug: new ObjectId(),
        feedback: new ObjectId()
    };

    const now = new Date();

    try {
        await client.connect();

        const db = client.db(DATABASE_NAME);

        await db.command({ ping: 1 });

        console.log(`Connected to database: ${DATABASE_NAME}`);

        // Check for existing sample data to prevent duplicate inserts.
        const existingSeed = await db.collection("users").findOne({
            username: "alex_dev"
        });

        if (existingSeed) {
            throw new Error(
                "Sample data already exists. No documents were inserted."
            );
        }

        // USERS
        await db.collection("users").insertMany([
            {
                _id: ids.users.alex,
                username: "alex_dev",
                email: "alex@example.com",
                displayName: "Alex Rivera",
                role: "developer",
                createdOn: now,
                createdBy: null
            },
            {
                _id: ids.users.sam,
                username: "sam_codes",
                email: "sam@example.com",
                displayName: "Sam Chen",
                role: "developer",
                createdOn: now,
                createdBy: ids.users.alex
            },
            {
                _id: ids.users.jordan,
                username: "jordan_art",
                email: "jordan@example.com",
                displayName: "Jordan Lee",
                role: "artist",
                createdOn: now,
                createdBy: ids.users.alex
            },
            {
                _id: ids.users.taylor,
                username: "taylor_tests",
                email: "taylor@example.com",
                displayName: "Taylor Morgan",
                role: "playtester",
                createdOn: now,
                createdBy: ids.users.alex
            }
        ]);

        // TEAMS
        await db.collection("teams").insertOne({
            _id: ids.team,
            name: "Pixel Forge",
            description: "A small indie game development team.",
            createdOn: now,
            createdBy: ids.users.alex
        });

        // TEAM MEMBERS
        await db.collection("teamMembers").insertMany([
            {
                teamId: ids.team,
                userId: ids.users.alex,
                role: "owner",
                createdOn: now,
                createdBy: ids.users.alex
            },
            {
                teamId: ids.team,
                userId: ids.users.sam,
                role: "developer",
                createdOn: now,
                createdBy: ids.users.alex
            },
            {
                teamId: ids.team,
                userId: ids.users.jordan,
                role: "artist",
                createdOn: now,
                createdBy: ids.users.alex
            }
        ]);

        // PROJECTS
        await db.collection("projects").insertOne({
            _id: ids.project,
            teamId: ids.team,
            name: "Starfall",
            description: "A 2D adventure game set among the stars.",
            status: "active",
            createdOn: now,
            createdBy: ids.users.alex
        });

        // MILESTONES
        await db.collection("milestones").insertOne({
            _id: ids.milestone,
            projectId: ids.project,
            name: "Playable Prototype",
            description: "Complete the first playable game level.",
            status: "in_progress",
            dueDate: new Date("2026-11-05T23:59:00Z"),
            createdOn: now,
            createdBy: ids.users.alex
        });

        // TASKS
        await db.collection("tasks").insertMany([
            {
                _id: ids.task1,
                projectId: ids.project,
                milestoneId: ids.milestone,
                title: "Implement player movement",
                description: "Add walking, jumping, and collision handling.",
                status: "in_progress",
                priority: "high",
                assigneeId: ids.users.sam,
                createdOn: now,
                createdBy: ids.users.alex
            },
            {
                _id: ids.task2,
                projectId: ids.project,
                milestoneId: ids.milestone,
                title: "Create the first level background",
                description: "Design a starry environment for the prototype.",
                status: "todo",
                priority: "medium",
                assigneeId: ids.users.jordan,
                createdOn: now,
                createdBy: ids.users.alex
            }
        ]);

        // BUG REPORTS
        await db.collection("bugReports").insertOne({
            _id: ids.bug,
            projectId: ids.project,
            title: "Player falls through platform",
            description: "The character sometimes falls through the bridge.",
            severity: "high",
            status: "open",
            reportedBy: ids.users.taylor,
            createdOn: now,
            createdBy: ids.users.taylor
        });

        // PLAYTEST FEEDBACK
        await db.collection("playtestFeedback").insertOne({
            _id: ids.feedback,
            projectId: ids.project,
            userId: ids.users.taylor,
            rating: 4,
            comments: "Fun movement and atmosphere. The controls need polish.",
            createdOn: now,
            createdBy: ids.users.taylor
        });

        console.log("Sample data inserted successfully!");
        console.log("Database: mern");
        console.log("Collections populated: 8");
        console.log("Save these sample IDs for API testing:");
        console.log({
            teamId: ids.team.toString(),
            projectId: ids.project.toString(),
            milestoneId: ids.milestone.toString(),
            alexUserId: ids.users.alex.toString(),
            samUserId: ids.users.sam.toString()
        });
    } catch (error) {
        console.error("Seed failed:", error.message);
        throw error;
    } finally {
        await client.close();
    }
}

seedDevelopment().catch(() => {
    process.exitCode = 1;
});
