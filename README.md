# Ballerz Stat App

Search NBA players and teams for full season stats.

## Getting Started

```bash
npm install      # Install dependencies
npm run dev      # Start development server at http://localhost:5173
npm run build    # Build for production
npm test         # Run tests
```

## Project Structure

```
src/
├── components/    # Reusable UI components
├── pages/         # Page components
├── services/      # Backend API integrations
├── hooks/         # Custom React hooks
├── types/         # TypeScript type definitions
├── App.tsx        # Main app component
├── App.css        # App styles
├── App.test.tsx   # App tests
└── main.tsx       # Entry point
```

### Where to Put Your Code

| What you're building | Where it goes |
|---------------------|---------------|
| UI components (buttons, cards, etc.) | `src/components/` |
| Full pages | `src/pages/` |
| API calls and backend integration | `src/services/` |
| Custom hooks | `src/hooks/` |
| TypeScript interfaces/types | `src/types/` |
| Tests | Next to the file being tested (e.g., `Component.test.tsx`) |
