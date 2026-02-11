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
│   │   └── server.js        # Express server entry point
│   ├── eslint.config.mjs
│   └── package.json
│
└── README.md
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
