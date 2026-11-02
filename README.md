# MERN Stack Project (Group 9)
## Local Quick Start

1. Install deps
```sh
npm install
(cd server && npm install)
(cd client && npm install)
```

2. Create .env
```sh
cp .env.example .env
# Edit .env with editor of choice
```

3. Start MongoDB
```sh
docker run --rm -d --name mern-mongo -p 27017:27017 mongo:7
```

4. Create database
```sh
npm run db:setup
# Optional: SEED_DEVELOPMENT=true npm run db:seed
```

5. Start server
```sh
# In one terminal
cd server
npm run dev
```

6. Start client
```sh
# In another terminal
cd client
npm run dev
```
