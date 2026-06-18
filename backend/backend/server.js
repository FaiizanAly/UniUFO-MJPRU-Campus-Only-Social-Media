// ============================================
// STUDO — Simple Backend (Node.js + Express)
// Database: db.json file (no MySQL needed!)
// ============================================

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app     = express();
const PORT    = 8080;
const DB_FILE = path.join(__dirname, 'db.json');

// ---- Middleware ----
app.use(cors({ origin: '*' }));
app.use(express.json());

// ---- DB Helpers ----
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', app: 'Studo Backend', version: '1.0.0', university: 'MJPRU, Bareilly' });
});

// ============================================
// AUTH
// ============================================
app.post('/api/auth/register', (req, res) => {
  const db = readDB();
  const { name, email, password, university, semester } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });

  const exists = db.users.find(u => u.email === email);
  if (exists)
    return res.status(400).json({ message: 'Email already registered' });

  const user = {
    id:          'u' + Date.now(),
    name,
    email,
    password,   // ⚠️ In production always hash passwords!
    university:  university || 'MJPRU, Bareilly',
    semester:    semester   || '1st Semester',
    initials:    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    verified:    false,
    followers:   0,
    following:   0,
    posts:       0,
    joinedAt:    new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
    bio:         '',
    avatarColor: 'linear-gradient(135deg, #0071e3, #5856d6)',
  };

  db.users.push(user);
  writeDB(db);

  const { password: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token: 'token-' + user.id });
});

app.post('/api/auth/login', (req, res) => {
  const db = readDB();
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user)
    return res.status(401).json({ message: 'Invalid email or password' });

  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token: 'token-' + user.id });
});

// ============================================
// POSTS
// ============================================
app.get('/api/posts', (req, res) => {
  const db = readDB();
  res.json(db.posts);
});

app.post('/api/posts', (req, res) => {
  const db = readDB();
  const { content, tags, authorId } = req.body;

  if (!content)
    return res.status(400).json({ message: 'Content is required' });

  const author = db.users.find(u => u.id === authorId) || db.users[0];
  const { password: _, ...safeAuthor } = author;

  const post = {
    id:       'p' + Date.now(),
    content,
    tags:     tags || [],
    likes:    0,
    comments: 0,
    shares:   0,
    liked:    false,
    time:     'Just now',
    author:   safeAuthor,
  };

  db.posts.unshift(post);
  writeDB(db);
  res.status(201).json(post);
});

app.post('/api/posts/:id/like', (req, res) => {
  const db   = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  post.liked  = !post.liked;
  post.likes += post.liked ? 1 : -1;
  writeDB(db);
  res.json(post);
});

app.delete('/api/posts/:id', (req, res) => {
  const db  = readDB();
  const idx = db.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Post not found' });

  db.posts.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Post deleted' });
});

// ============================================
// USERS
// ============================================
app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users.map(({ password, ...u }) => u));
});

app.get('/api/users/:id', (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

// ============================================
// MARKETPLACE
// ============================================
app.get('/api/marketplace', (req, res) => {
  res.json(readDB().products);
});

app.post('/api/marketplace', (req, res) => {
  const db  = readDB();
  const item = { id: 'm' + Date.now(), ...req.body, time: 'Just now' };
  db.products.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// ============================================
// NOTES
// ============================================
app.get('/api/notes', (req, res) => {
  res.json(readDB().notes);
});

app.post('/api/notes', (req, res) => {
  const db   = readDB();
  const note = { id: 'n' + Date.now(), ...req.body, downloads: 0, rating: 0, time: 'Just now' };
  db.notes.unshift(note);
  writeDB(db);
  res.status(201).json(note);
});

// ============================================
// EVENTS
// ============================================
app.get('/api/events', (req, res) => {
  res.json(readDB().events);
});

app.post('/api/events/:id/register', (req, res) => {
  const db    = readDB();
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found' });

  event.registered = !event.registered;
  event.attendees  += event.registered ? 1 : -1;
  writeDB(db);
  res.json(event);
});

// ============================================
// COMMUNITIES
// ============================================
app.get('/api/communities', (req, res) => {
  res.json(readDB().communities);
});

app.post('/api/communities/:id/join', (req, res) => {
  const db   = readDB();
  const comm = db.communities.find(c => c.id === req.params.id);
  if (!comm) return res.status(404).json({ message: 'Community not found' });

  comm.joined   = !comm.joined;
  comm.members += comm.joined ? 1 : -1;
  writeDB(db);
  res.json(comm);
});

// ============================================
// LOST & FOUND
// ============================================
app.get('/api/lost-found', (req, res) => {
  res.json(readDB().lostItems);
});

app.post('/api/lost-found', (req, res) => {
  const db   = readDB();
  const item = { id: 'l' + Date.now(), ...req.body, claimed: false, date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) };
  db.lostItems.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// ============================================
// MESSAGES
// ============================================
app.get('/api/conversations', (req, res) => {
  res.json(readDB().conversations);
});

app.get('/api/messages/:conversationId', (req, res) => {
  res.json(readDB().chatMessages);
});

// ============================================
// ADMIN
// ============================================
app.get('/api/admin/stats', (req, res) => {
  res.json(readDB().adminStats);
});

app.get('/api/admin/verifications', (req, res) => {
  res.json(readDB().pendingVerifications);
});

app.put('/api/admin/verifications/:id/approve', (req, res) => {
  const db  = readDB();
  const idx = db.pendingVerifications.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });

  db.pendingVerifications.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Approved' });
});

app.put('/api/admin/verifications/:id/reject', (req, res) => {
  const db  = readDB();
  const idx = db.pendingVerifications.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });

  db.pendingVerifications.splice(idx, 1);
  writeDB(db);
  res.json({ message: 'Rejected' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🎓 Studo Backend — MJPRU, Bareilly      ║');
  console.log(`║  ✅ Running at http://localhost:${PORT}     ║`);
  console.log('║  📖 Health: /api/health                  ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
