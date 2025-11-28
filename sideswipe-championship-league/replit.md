# VELOX Team System

### Overview
The VELOX Team System is a comprehensive platform designed for managing the Sideswipe Championship League (SCL). It integrates a Discord bot for administrative tasks, robust backend APIs for data management, and a public-facing frontend website for displaying league information. The system's primary goal is to provide tools for SCL management, including real-time standings, match details, and team statistics, thereby enhancing the league experience for participants and viewers.

### User Preferences
I prefer clear, concise, and structured information. When making changes or suggesting improvements, please provide a brief explanation of the rationale. I value iterative development, so propose changes in manageable steps. Do not make changes to the `website-vlx/` or `website-vlx-chatgpt/` folders.

### System Architecture
The VELOX Team System employs a modular architecture comprising a Discord Bot, Backend APIs, and a Frontend Website.

**UI/UX Decisions:**
The frontend (`website-scl/`) features a responsive design, utilizes Font Awesome icons, and incorporates specific CSS for components like authentication forms, tabs, cards, and data grids. Team logos are prominently displayed with dynamic gradient fallbacks, and match status is indicated by color-coded badges.

**Technical Implementations:**
-   **Discord Bot:** Manages team creation, player assignments, and deploys predefined messages using Discord.js. It implements an atomic role system (`base role + cosmetic role`) with full rollback for team management commands, ensuring data consistency between Discord and the database.
-   **Backend APIs:** Two Express.js-based APIs (`api-scl` on port 4300 and `api` on port 4000) handle tournament data, team management, player leaderboards, predictions, and administration. Prisma ORM is used for all database interactions.
-   **Frontend Website (`website-scl/`):** A static HTML/CSS/JS application that consumes data from `api-scl`. It displays SCL data, including teams, standings, matches, player leaderboards, match predictions, and an admin dashboard. It uses clean URLs and dynamic content loading.
-   **Unified Authentication System:** A single registration system (`AuthAccount` model) with JWT-based authentication and role-based access control (VIEWER, PLAYER, LEADER, STAFF, ADMIN).
-   **Database Interaction:** PostgreSQL database accessed via Prisma ORM.
-   **API Design:** RESTful APIs with dedicated endpoints for data retrieval and manipulation.
-   **URL Management:** Clean URLs implemented via Express.js URL rewriting.
-   **Discord Webhook Integration:** Supports automated and manual webhooks for match updates, standings, and matchday schedules, configured via the admin dashboard.
-   **Match Submit Portal:** Integrated into the main SCL website at `/submit`, allowing team members to submit match result screenshots. It includes a separate authentication system, team-based access control, and an admin panel for review.
-   **OCR Processing System:** Utilizes Tesseract.js to extract text from match screenshots for score validation, with an admin review workflow for pending submissions.
-   **Image Generation:** Uses `node-canvas` to generate dynamic PNG images for standings and leaderboards, which can be sent via Discord webhooks.
-   **Database Schema:** Comprehensive Prisma schema defining models for various components, including `Tournament`, `Team`, `Player`, `Match`, `Standing`, `User`, `Prediction`, `DiscordWebhook`, and bot-specific models.
-   **Deployment:** Designed for Replit, with `start.js` as the entry point, running frontend (port 5000) and backend (port 4300) servers.

### External Dependencies
-   **Discord.js:** For Discord bot development.
-   **Express.js:** Web framework for APIs and frontend serving.
-   **Prisma ORM:** Database toolkit for PostgreSQL.
-   **PostgreSQL:** Primary database, hosted on Neon.
-   **bcryptjs:** Password hashing.
-   **jsonwebtoken:** JWT for authentication.
-   **Font Awesome:** Frontend icons.
-   **Discord CDN:** For hosting team logo images.
-   **Tesseract.js:** For OCR processing of match screenshots.
-   **node-canvas:** For server-side image generation.
-   **Toornament.com API:** For syncing tournament data, using OAuth 2.0.