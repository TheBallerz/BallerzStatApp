# Ballerz Stat App
Overall, our app should allow users to create an account, save their favorite teams, look at all NBA games and the stats for them. Users also will have the capability to look at team and individual stats for teams and players throughout the NBA season.

## Getting Started
```bash
npm install      # Install dependencies
npm run dev      # Start development server at http://localhost:5173
npm run build    # Build for production
npm test         # Run tests
```

## Project Structure
```
BallerzStatApp/
├── frontend/                # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # Backend API integrations
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript type definitions
│   │   ├── App.tsx          # Main app component
│   │   ├── App.css          # App styles
│   │   ├── App.test.tsx     # App tests
│   │   └── main.tsx         # Entry point
│   ├── eslint.config.js
│   └── package.json
│
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── setup.js         # mongodb-memory-server setup for tests
│   │   │   └── models.test.js   # Unit tests for all Mongoose models
│   │   ├── config/
│   │   │   └── database.js      # MongoDB connection
│   │   ├── models/              # Mongoose schemas (Team, Player, User, stats)
│   │   ├── routes/              # Express route handlers
│   │   └── server.js            # Express server entry point
│   ├── jest.config.js
│   ├── eslint.config.mjs
│   └── package.json
│
└── README.md
```

## Testing

### Backend
The backend uses [Jest](https://jestjs.io/) with [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server) to run an in-memory MongoDB instance — no live database connection required.

All tests live in a single file: `backend/src/__tests__/models.test.js`

The suite covers all 7 Mongoose models (Team, Player, User, TeamGameStats, PlayerGameStats, TeamSeasonStats, PlayerSeasonStats) with 48 tests total, verifying:
- Document creation and field persistence
- Default values
- Required field validation
- Enum and min/max constraint enforcement
- Unique and compound unique index enforcement
- Read, update, and delete operations

Run from the `backend/` directory:
```bash
npm test                # run all tests
npm run test:coverage   # run tests with coverage report
```

### Frontend
The frontend uses [Jest](https://jestjs.io/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

Run from the `frontend/` directory:
```bash
npm test
```

## Linting and Formatting
This project uses [ESLint](https://eslint.org/) for code linting and [Prettier](https://prettier.io/) for formatting, following Google's JavaScript style guide.

Run these from the `frontend/` or `backend/` directory:

```bash
npm run lint           # Check for linting errors
npm run lint:fix       # Auto-fix linting errors
npm run format         # Format all files with Prettier
npm run format:check   # Check if files are formatted (no changes made)
```
