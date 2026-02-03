# Docker Deployment Instructions

The project is now fully containerized.

## Quick Start through Docker

1.  **Build Client Image (Important)**
    Because we are not using `docker-compose` build args, you MUST manually build the client image with your environment variables:
    ```bash
    docker build \
      --build-arg VITE_API_URL="http://localhost:5008/api" \
      --build-arg VITE_GOOGLE_CLIENT_ID="your_google_client_id_here" \
      -t client:v1 client
    ```
    *Replace `your_google_client_id_here` with your actual Google Client ID.*

2.  **Start Containers**
    ```bash
    docker compose up -d
    ```

2.  **Initialize Database (First Time Only)**
    Since migrations are not auto-run, initialize the DB manually:
    ```bash
    # Create Tables
    docker exec project-portal-Backend npx prisma db push

    # Seed Admin User
    docker exec project-portal-Backend node prisma/seed.js nithiyan.al23@bitsathy.ac.in
    ```

3.  **Access the Application**
    - **Frontend:** [http://localhost:8088](http://localhost:8088)
    - **Backend API:** [http://localhost:5008/api](http://localhost:5008/api)
    - **Database:** Internal port 3306 (exposed as 3312)

## Configuration Details

### Ports
- **Frontend**: Mapped to `8088` (container 80).
- **Backend**: Mapped to `5008` (container 5000).

### Database Credentials
- **User**: `nithiyan`
- **Password**: `2501`
- **Database**: `student_portal_db`

### Troubleshooting
If you see "Prisma Client not initialized", it means the build step `RUN npx prisma generate` failed or was skipped. We have fixed this in the `Dockerfile`.
If you see database errors, ensure you ran the `db push` command above.

## Pulling from Docker Hub
You can also pull the pre-built images directly:
```bash
docker pull demon25/project-portal-frontend:v1
docker pull demon25/project-portal-backend:v1.1
```
*(Note for Frontend: You still need to run the container with your specific Environment Variables as the built image has them baked in. It is recommended to build your own frontend image appropriately.)*

### Google Authentication
If you see a **403 error** or "Origin not allowed" when signing in:
1.  Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2.  Edit your **OAuth 2.0 Client ID**.
3.  Add `http://localhost:8088` to **Authorized JavaScript origins**.
4.  Add `http://localhost:8088` to **Authorized redirect URIs**.
5.  Save and wait a few minutes for changes to propagate.

## Production Deployment (Live Server)

To deploy and seed on your server:

1.  **Prerequisite: Environment Variables**
    Ensure you have your `.env` file in the same directory as `docker-compose.yml` on your server. Docker needs this to configure the Database and Backend.
    *You can transfer your local `.env` or create a new one with the same variables.*

2.  **Pull Images:**
    ```bash
    docker pull demon25/project-portal-frontend:v1
    docker pull demon25/project-portal-backend:v1.1
    ```

2.  **Start Services:**
    ```bash
    docker compose up -d
    ```

3.  **Seed Database (Run this on the server terminal):**
    ```bash
    docker exec project-portal-Backend node prisma/seed.js nithiyan.al23@bitsathy.ac.in
    ```
    *(Ensure the backend container is running before executing this)*
