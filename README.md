# Option Quoter Gemini

This project fetches end-of-day option quotes for configured stock tickers using the Yahoo Finance API and stores them in a PostgreSQL database.

## Local Development Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configuration**:
    Create a `.env` file with your database credentials and desired tickers:
    ```env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=postgres
    DB_PASSWORD=your_password
    DB_NAME=option_quotes
    TICKERS=AAPL,MSFT,GOOGL
    RISK_FREE_RATE=0.045
    ```

3.  **Database Setup**:
    Ensure you have a PostgreSQL instance running. Then run:
    ```bash
    npm run setup-db
    ```

4.  **Run**:
    ```bash
    npm run fetch
    ```

## Deployment: Supabase + GitHub Actions (Free Tier)

This project is configured to run automatically using Supabase (free PostgreSQL) and GitHub Actions (free cron jobs).

### Step 1: Set up Supabase

1. Go to [supabase.com](https://supabase.com) and sign up for a free account
2. Create a new project:
   - Choose a project name
   - Set a strong database password (save this!)
   - Select a region close to you
   - Wait for provisioning (~2 minutes)

3. Get your connection details:
   - Go to **Project Settings** → **Database**
   - Find **Connection string** → **URI** (or use **Connection pooling** for port 6543)
   - Your connection string will look like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```

4. Initialize the database schema:
   - Go to **SQL Editor** in the Supabase dashboard
   - Run the contents of `src/db/schema.sql`
   - Run the contents of `src/db/migrate-greeks.sql`
   - Or run locally: `npm run setup-db` (after setting up `.env` with Supabase credentials)

### Step 2: Set up GitHub Actions

1. **Push your code to GitHub**:
   - Create a new repository (public repos get free GitHub Actions)
   - Push your code to the repository

2. **Configure GitHub Secrets**:
   - Go to your repository → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret** and add the following:
     - `DB_HOST`: Your Supabase host (e.g., `db.xxxxx.supabase.co`)
     - `DB_PORT`: `6543` (for connection pooling, recommended) or `5432` (direct connection)
     - `DB_USER`: `postgres`
     - `DB_PASSWORD`: Your Supabase database password
     - `DB_NAME`: `postgres`
     - `TICKERS`: Comma-separated list (e.g., `AAPL,MSFT,GOOGL`)
     - `RISK_FREE_RATE`: Optional, defaults to `0.045` if not set

3. **Test the workflow**:
   - Go to **Actions** tab in your repository
   - Select **Daily Option Quote Fetch** workflow
   - Click **Run workflow** to manually trigger it
   - Check the logs to verify it runs successfully

### Step 3: Verify Scheduled Runs

The workflow is configured to run automatically:
- **Schedule**: Every weekday (Monday-Friday) at 5:00 PM UTC
- **Manual trigger**: Available via "Run workflow" button

To change the schedule, edit `.github/workflows/daily-fetch.yml` and update the cron expression.

### Notes

- **Connection Pooling**: Use port `6543` for connection pooling (better for serverless environments like GitHub Actions)
- **Public vs Private Repos**: Public repositories get free GitHub Actions. Private repositories require GitHub Pro or paid plans.
- **Supabase Free Tier**: Includes 500MB database storage and 2GB bandwidth per month (usually sufficient for daily option quotes)
- **Timezone**: The cron job runs at 17:00 UTC. Adjust the cron expression in the workflow file if you need a different time.

## Project Structure

*   `src/config`: Configuration loading.
*   `src/db`: Database connection management and setup scripts.
*   `src/models`: TypeScript interfaces.
*   `src/services`: Business logic (fetching, storing).
*   `src/utils`: Helper functions.
*   `.github/workflows`: GitHub Actions workflow definitions.
