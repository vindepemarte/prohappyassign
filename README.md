# ProHappyAssignments

An application for assignment assistance in the UK, designed with a friendly and modern user interface.

## Features

- **Multi-role Authentication**: Support for clients, workers, and agents
- **Project Management**: Create, track, and manage assignments
- **Push Notifications**: Real-time notifications for project updates
- **File Management**: Upload and manage project files
- **Progressive Web App**: Works offline with service worker support

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Express.js with PostgreSQL
- **Authentication**: JWT-based authentication
- **Build Tool**: Vite
- **Deployment**: Docker, Coolify

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file with:
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   JWT_SECRET=your_jwt_secret_key
   GEMINI_API_KEY=your_gemini_api_key
   BCRYPT_ROUNDS=12
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Deployment

See [coolify-deploy.md](./coolify-deploy.md) for detailed deployment instructions using Coolify.

### Quick Deploy with Docker

```bash
# Build the Docker image
docker build -t prohappyassignments .

# Run the container
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key prohappyassignments
```

## Configuration

### Database Setup
1. Set up a PostgreSQL database
2. Update the `DATABASE_URL` environment variable
3. Run database migrations if needed

### Push Notifications
1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Update `services/notificationService.ts` with your public key
3. Add VAPID keys to your environment variables

## Project Structure

```
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard components
│   └── common/         # Shared components
├── contexts/           # React contexts
├── hooks/              # Custom hooks
├── services/           # API services
├── routes/             # Express.js API routes
└── types.ts            # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.
