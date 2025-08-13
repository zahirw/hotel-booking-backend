import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import jsonfile from 'jsonfile';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET = 'supersecret';

// File paths
const usersFile = path.join(__dirname, 'data/users.json');
const roomsFile = path.join(__dirname, 'data/rooms.json');
const bookingsFile = path.join(__dirname, 'data/bookings.json');

// Helper
function readData(file) {
  return jsonfile.readFileSync(file);
}
function writeData(file, data) {
  jsonfile.writeFileSync(file, data, { spaces: 2 });
}

// Middleware for auth
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Routes
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  const users = readData(usersFile);
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const newUser = { id: Date.now(), name, email, password: hashed };
  users.push(newUser);
  writeData(usersFile, users);
  res.json({ message: 'Registered successfully' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = readData(usersFile);
  const user = users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/rooms', (req, res) => {
  res.json(readData(roomsFile));
});

app.get('/api/bookings', auth, (req, res) => {
  const bookings = readData(bookingsFile).filter(b => b.userId === req.user.id);
  res.json(bookings);
});

app.post('/api/bookings', auth, (req, res) => {
  const { roomId, checkin, checkout } = req.body;
  const bookings = readData(bookingsFile);
  const newBooking = { id: Date.now(), userId: req.user.id, roomId, checkin, checkout };
  bookings.push(newBooking);
  writeData(bookingsFile, bookings);
  res.json({ message: 'Booking created', booking: newBooking });
});

app.delete('/api/bookings/:id', auth, (req, res) => {
  const bookings = readData(bookingsFile);
  const updated = bookings.filter(b => b.id !== parseInt(req.params.id) || b.userId !== req.user.id);
  writeData(bookingsFile, updated);
  res.json({ message: 'Booking cancelled' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));
