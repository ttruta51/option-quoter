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
    EXTENDED_EXPIRATION_TICKERS=SPY,RSP,TLT
    ```
    
    **Environment Variables:**
    - `TICKERS`: Comma-separated list of stock tickers to fetch options for (e.g., `AAPL,MSFT,SPY,TLT`)
    - `EXTENDED_EXPIRATION_TICKERS`: Comma-separated list of tickers (from your TICKERS list) that should fetch options up to 70 days out instead of the default 14 days. Only tickers that are also in `TICKERS` will be processed. (e.g., `SPY,RSP,TLT`)
    - `RISK_FREE_RATE`: Risk-free rate for Greeks calculations (default: 0.045)
    
    **Note:** To fetch options for a ticker, it must be in the `TICKERS` variable. The `EXTENDED_EXPIRATION_TICKERS` variable only controls the expiration window (70 vs 14 days) for tickers that are already in `TICKERS`.

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

2. **Configure GitHub Secrets and Variables**:
   - Go to your repository → **Settings** → **Secrets and variables** → **Actions**
   
   **Secrets** (click "New repository secret"):
     - `DB_HOST`: Your Supabase host (e.g., `db.xxxxx.supabase.co`)
     - `DB_PORT`: `6543` (for connection pooling, recommended) or `5432` (direct connection)
     - `DB_USER`: `postgres`
     - `DB_PASSWORD`: Your Supabase database password
     - `DB_NAME`: `postgres`
   
   **Variables** (click "Variables" tab, then "New repository variable"):
     - `TICKERS`: Comma-separated list of tickers to fetch options for (e.g., `AAPL,MSFT,SPY,TLT`)
     - `RISK_FREE_RATE`: Optional, defaults to `0.045` if not set
     - `EXTENDED_EXPIRATION_TICKERS`: Comma-separated list of tickers (from your TICKERS list) that should fetch 70 days of expirations instead of 14 days (e.g., `SPY,RSP,TLT`). Only tickers that are also in `TICKERS` will be processed. Leave empty or omit for default 14-day behavior for all tickers.
     
     **Important:** To fetch options for any ticker (including SPY, RSP, TLT), you must add it to the `TICKERS` variable. The `EXTENDED_EXPIRATION_TICKERS` variable only controls how many days of expirations to fetch (70 vs 14) for tickers that are already in `TICKERS`.

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
