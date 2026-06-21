# SafeScribe — Production Transition Guide

This document outlines the changes and architecture required to transition SafeScribe from a client-side prototype (using client-side mock authentication and `localStorage`) to a fully functional production website connected to a database and real Google Sign-In.

---

## 1. Connecting to Real Google Sign-In

To replace the simulated popup with authentic Google OAuth 2.0, you must configure a Google Cloud Developer project and integrate the official Google Identity Services library in the frontend.

### Step 1.1: Setup Google Cloud Console
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **SafeScribe**.
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   * Set user type to **External**.
   * Fill out the app information.
   * Add the `.../auth/userinfo.profile` and `.../auth/userinfo.email` scopes.
4. Navigate to **Credentials** > **Create Credentials** > **OAuth client ID**:
   * Select application type **Web application**.
   * Add Authorized JavaScript origins: `http://localhost:5173` (for local development, note: no trailing slash).
   * Add Authorized redirect URIs: `http://localhost:5173/` (note: must end with a trailing slash or path) and your production redirect endpoint.
5. Copy your **OAuth Client ID**.

### Step 1.2: Install Google Auth SDK
In your terminal, run:
```bash
npm install @react-oauth/google
```

### Step 1.3: Wire the Official Login SDK
Wrap the application inside `src/main.jsx` with the `<GoogleOAuthProvider>`:
```jsx
import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

Then, update your Google Sign-In button in `src/pages/Login.jsx` using Google's official Sign-In hook:
```jsx
import { useGoogleLogin } from '@react-oauth/google';

// Inside Login component:
const handleGoogleSignIn = useGoogleLogin({
  onSuccess: async (tokenResponse) => {
    // 1. Fetch user profile info using the access token
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    const profile = await res.json();
    
    // 2. Pass real profile data to your authentication context
    loginWithGoogle({
      name: profile.name,
      email: profile.email,
      photoUrl: profile.picture,
    });
    navigate('/');
  },
  onError: () => setError('Google Sign-In Failed'),
});
```

---

## 2. Transitioning from Browser Cache to a Database

Currently, all user accounts and notes are stored in the browser's `localStorage` cache. If the user clears their history or accesses the app from another browser/device, their notes will be lost. 

To save notes persistently, you need a backend database. You have two primary options:

### Option A: Serverless Backend (Recommended for React Apps)
Services like **Supabase** or **Firebase** provide a database, user management, and image storage without requiring you to write a separate backend server.

#### Example with Supabase (PostgreSQL Database)
1. Register on [Supabase](https://supabase.com/) and create a project.
2. Run SQL to create tables for `users` and `notes`:
   ```sql
   create table notes (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users not null,
     type text check (type in ('text', 'image')),
     title text not null,
     content text,
     is_protected boolean default false,
     protection_pin text,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );
   ```
3. Install the Supabase client:
   ```bash
   npm install @supabase/supabase-js
   ```
4. Update `src/context/NotesContext.jsx` to make real API requests to database tables instead of `localStorage`:
   ```javascript
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

   // Inside NotesProvider:
   const fetchNotes = async () => {
     const { data, error } = await supabase
       .from('notes')
       .select('*')
       .order('created_at', { ascending: false });
     if (!error) setNotes(data);
   };

   const addNote = async (note) => {
     const { data, error } = await supabase
       .from('notes')
       .insert([{ ...note, user_id: supabase.auth.user().id }])
       .select();
     if (!error) setNotes(prev => [data[0], ...prev]);
   };
   ```

### Option B: Custom REST API (Node.js/Express + MongoDB)
If you prefer a traditional backend, you can build a custom Node.js/Express server and connect it to a database like MongoDB.

#### Proposed Architecture:
```
  [ React Client ] <---- REST API (HTTP) ----> [ Node.js/Express Server ] <----> [ MongoDB Atlas ]
```

#### Node.js Server Code Example (`server.js`):
```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/safescribe');

const NoteSchema = new mongoose.Schema({
  userId: String,
  type: { type: String, enum: ['text', 'image'] },
  title: String,
  content: String,
  isProtected: Boolean,
  protectionPin: String,
}, { timestamps: true });

const Note = mongoose.model('Note', NoteSchema);

// API Endpoints
app.get('/api/notes', async (req, res) => {
  const notes = await Note.find({ userId: req.headers.userid }).sort({ createdAt: -1 });
  res.json(notes);
});

app.post('/api/notes', async (req, res) => {
  const newNote = new Note(req.body);
  await newNote.save();
  res.status(201).json(newNote);
});

app.listen(5000, () => console.log('Server running on port 5000'));
```

#### Update Frontend to Call Backend API:
Replace `localStorage` calls inside `src/context/NotesContext.jsx` with standard `fetch` API commands:
```javascript
const addNote = useCallback(async (note) => {
  const response = await fetch('http://localhost:5000/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'userid': user.username
    },
    body: JSON.stringify(note)
  });
  const newNote = await response.json();
  setNotes(prev => [newNote, ...prev]);
}, [user]);
```

---

## 3. Handling Image Upload Storage in Production

Currently, images are converted to Base64 strings and stored inside `localStorage`. Storing heavy binary data in a SQL or NoSQL database is inefficient.

### The Production Approach:
1. When a user uploads an image, upload it to a **Cloud Storage Bucket** (such as AWS S3, Supabase Storage, or Google Cloud Storage).
2. The storage bucket returns a public static URL for the image (e.g. `https://your-bucket.s3.amazonaws.com/uploads/photo.jpg`).
3. Save **only the URL string** in the `content` field of the note entry in your database.

---

## 4. Production Deployment Checklist
1. **Frontend Hosting**: Deploy your built React files (run `npm run build` first) to a CDN host like **Vercel** or **Netlify**.
2. **Backend API Hosting**: If you build a custom Express backend, host it on services like **Render**, **Railway**, or **Heroku**.
3. **Environment Variables**: Never hardcode client credentials or database keys. Put them in an `.env` file on your server/environment, and load them using `process.env.SUPABASE_KEY` or `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
