# Animation AI Generator

A Next.js-based web application for generating animated videos using AI, with integrated video editing capabilities and OpenCut integration.

## Features

- 🎬 AI-powered video generation
- ✂️ Video editing with timeline and multi-track support
- 🎨 Multiple animation styles
- 📝 Storyboard generation
- 💳 Payment integration (Creem)
- 🔐 User authentication (Supabase)
- 🌐 Multi-language support

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Video Processing**: OpenCut, Canvas API
- **Payment**: Creem Payment Gateway
- **AI Services**: DashScope (Alibaba Cloud), Volcano Engine

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Environment variables configured

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd animationaigenerator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with the required environment variables (see `.env.example` if available).

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app router pages
├── components/             # React components
│   ├── storyboard/        # Video editor components
│   └── ui/                # UI components
├── lib/                   # Utility libraries
│   ├── opencut/          # OpenCut integration
│   ├── supabase/         # Supabase client
│   └── payment/          # Payment integration
├── public/               # Static assets
└── supabase/            # Database migrations
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

Private - All rights reserved

