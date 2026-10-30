require("dotenv").config();

const { MongoClient } = require("mongodb");

const DATABASE_NAME = "mern";

// All collections used by the application.
const COLLECTIONS = [
    "users",
    "teams",
    "teamMembers",
    "projects",
    "milestones",
    "tasks",
    "bugReports",
    "playtestFeedback"
];

async function setupDatabase() {
    const uri = process.env.MONGODB_URI;
    
console.log("Connecting to Atlas...");
console.log("Database:", DATABASE_NAME);
console.log("Username:", new URL(process.env.MONGODB_URI).username);

    if (!uri) {
        throw new Error(
            "MONGODB_URI is missing. Set your Atlas connection string first."
        );
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();

        const db = client.db(DATABASE_NAME);

        // Verify the connection before changing anything.
        await db.command({ ping: 1 });

        console.log(`Connected to MongoDB database: ${DATABASE_NAME}`);

        // Find collections that already exist.
        const existingCollections = await db
            .listCollections({}, { nameOnly: true })
            .toArray();

        const existingNames = new Set(
            existingCollections.map((collection) => collection.name)
        );

        // Create missing collections without deleting existing ones.
        for (const collectionName of COLLECTIONS) {
            if (!existingNames.has(collectionName)) {
                await db.createCollection(collectionName);
                console.log(`Created collection: ${collectionName}`);
            } else {
                console.log(`Collection already exists: ${collectionName}`);
            }
        }

        // USERS
        // Prevent duplicate usernames and email addresses.
        await db.collection("users").createIndex(
            { username: 1 },
            { unique: true, name: "unique_username" }
        );

        await db.collection("users").createIndex(
            { email: 1 },
            { unique: true, name: "unique_email" }
        );

        // TEAMS
        // Find teams created by a particular user.
        await db.collection("teams").createIndex(
            { createdBy: 1 },
            { name: "teams_by_creator" }
        );

        // TEAM MEMBERS
        // Prevent the same user from joining the same team twice.
        await db.collection("teamMembers").createIndex(
            { teamId: 1, userId: 1 },
            { unique: true, name: "unique_team_membership" }
        );

        await db.collection("teamMembers").createIndex(
            { userId: 1 },
            { name: "members_by_user" }
        );

        // PROJECTS
        // Find projects belonging to a team.
        await db.collection("projects").createIndex(
            { teamId: 1 },
            { name: "projects_by_team" }
        );

        // MILESTONES
        // Find milestones belonging to a project.
        await db.collection("milestones").createIndex(
            { projectId: 1 },
            { name: "milestones_by_project" }
        );

        // TASKS
        // Find tasks by project and status.
        await db.collection("tasks").createIndex(
            { projectId: 1, status: 1 },
            { name: "tasks_by_project_status" }
        );

        // Find tasks assigned to a particular user.
        await db.collection("tasks").createIndex(
            { assigneeId: 1 },
            { name: "tasks_by_assignee" }
        );

        // BUG REPORTS
        // Find bug reports by project and status.
        await db.collection("bugReports").createIndex(
            { projectId: 1, status: 1 },
            { name: "bugs_by_project_status" }
        );

        // PLAYTEST FEEDBACK
        // Retrieve a project's newest feedback first.
        await db.collection("playtestFeedback").createIndex(
            { projectId: 1, createdOn: -1 },
            { name: "feedback_by_project_date" }
        );

        console.log("Database setup completed successfully.");
        console.log("Existing documents were preserved.");
        console.log("No sample data was inserted.");
    } catch (error) {
        console.error("Database setup failed:", error.message);
        throw error;
    } finally {
        await client.close();
    }
}

setupDatabase().catch(() => {
    process.exitCode = 1;
});
