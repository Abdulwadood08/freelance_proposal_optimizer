# Freelance Proposal Optimizer - Frontend

Next.js frontend for the Freelance Proposal Optimizer SaaS application.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API URL

Create a `.env.local` file in the frontend directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If your backend is running on a different port or URL, update this accordingly.

### 3. Run Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Features

- **Home Page**: Welcome screen with quick actions
- **Profile Management**: Create and update user profiles with skills, case studies, and portfolio links
- **Proposal Generator**: Generate AI-powered proposals with multiple tone variations
- **Simple CSS Styling**: Clean, modern UI without Tailwind CSS

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Home page
│   │   ├── profile/
│   │   │   └── page.tsx      # Profile management
│   │   ├── generate/
│   │   │   └── page.tsx      # Proposal generator
│   │   ├── layout.tsx         # Root layout with navigation
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   └── Navigation.tsx    # Navigation component
│   └── lib/
│       └── api.ts            # API client for FastAPI backend
├── package.json
└── README.md
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Integration

The frontend connects to the FastAPI backend running on `http://localhost:8000` by default. Make sure your backend server is running before using the frontend.

## Pages

### Home (`/`)
- Welcome screen
- Quick links to create profile or generate proposal

### Profile (`/profile`)
- Create or update user profile
- Add skills, case studies, portfolio links
- Load existing profile by User ID

### Generate Proposal (`/generate`)
- Enter User ID and paste job post
- Generate AI-powered proposal
- View proposal with multiple tone variations
- Copy proposals to clipboard
