# Freelance Proposal Optimizer - Backend API

FastAPI backend for the Freelance Proposal Optimizer SaaS application.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Firebase Configuration

1. Download your Firebase service account JSON file from the Firebase Console
2. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to the JSON file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

Or on Windows:

```bash
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\service-account-key.json
```

### 3. Run the Application

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### POST /v1/users

Create a new user profile.

**Request Body:**

```json
{
  "user_id": "string",
  "name": "string",
  "email": "string",
  "skills": ["string"],
  "resume_url": "string",
  "case_studies": ["string"],
  "fiverr_gigs": ["string"],
  "upwork_profile": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User saved"
}
```

### GET /v1/users/{user_id}

Retrieve a user profile by user_id.

**Response:**
Returns the user profile data as JSON.

**Error Responses:**

- `404`: User not found
- `500`: Server error

## API Documentation

Once the server is running, you can access:

- Interactive API docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

## Project Structure

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── routes/
│   │   ├── __init__.py
│   │   └── user.py          # User-related endpoints
│   └── services/
│       ├── __init__.py
│       └── firestore_client.py  # Firestore database client
├── requirements.txt
└── README.md
```
