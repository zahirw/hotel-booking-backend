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
const contactsFile = path.join(__dirname, 'data/contacts.json');

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

app.get('/api/me', auth, (req, res) => {
  const users = readData(usersFile);
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
});

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
  const guests = parseInt(req.query.guests, 10);
  const checkInDate = req.query.checkInDate; // format: YYYY-MM-DD
  const sort = req.query.sort
  const rooms = readData(roomsFile);

  // Filter based on guests and date
  const filteredRooms = rooms.filter((room) => {
    const fitsGuests = guests ? room.maxGuests >= guests : true;
    const available = checkInDate
      ? room.availableDates.includes(checkInDate)
      : true;
    return fitsGuests && available;
  });

  let sortedRooms = [...filteredRooms];

  if (sort === "asc") {
    sortedRooms.sort((a, b) => a.pricePerNight - b.pricePerNight);
  } else if (sort === "desc") {
    sortedRooms.sort((a, b) => b.pricePerNight - a.pricePerNight);
  }

  res.json(sortedRooms);
});

// Get room by id
app.get('/api/rooms/:id', (req, res) => {
  const rooms = readData(roomsFile);
  const room = rooms.find(r => r.id === parseInt(req.params.id));
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
});

app.get('/api/bookings', auth, (req, res) => {
  const bookings = readData(bookingsFile).filter(b => b.userId === req.query.userId);
  res.json(bookings);
});

app.post('/api/bookings', auth, (req, res) => {
  const { roomId, checkin, checkout, userId, } = req.body;
  const bookings = readData(bookingsFile);
  const newBooking = { id: Date.now(), userId, roomId, checkin, checkout, contactId: '' };
  bookings.push(newBooking);
  writeData(bookingsFile, bookings);
  res.json({ message: 'Booking created', booking: newBooking });
});

// Update booking contactId
app.patch('/api/bookings/:id', auth, (req, res) => {
  const { id } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    return res.status(400).json({ message: 'contactId is required' });
  }

  const bookings = readData(bookingsFile);
  const bookingIndex = bookings.findIndex(
    (b) => b.id === parseInt(id)
  );

  if (bookingIndex === -1) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  bookings[bookingIndex].contactId = contactId;

  writeData(bookingsFile, bookings);

  res.json({
    message: 'Booking updated',
    booking: bookings[bookingIndex],
  });
});

app.delete('/api/bookings/:id', auth, (req, res) => {
  const bookings = readData(bookingsFile);
  const updated = bookings.filter(b => b.id !== parseInt(req.params.id) || b.userId !== req.user.id);
  writeData(bookingsFile, updated);
  res.json({ message: 'Booking cancelled' });
});

// Get all contacts
app.get('/api/contacts', (req, res) => {
  const contacts = readData(contactsFile);
  res.json(contacts);
});

// Get contact by id
app.get('/api/contacts/:id', (req, res) => {
  const contacts = readData(contactsFile);
  const contact = contacts.find(c => c.id === parseInt(req.params.id));
  if (!contact) return res.status(404).json({ message: 'Contact not found' });
  res.json(contact);
});

// Add new contact
app.post('/api/contacts', (req, res) => {
  const { title, name, email, userId } = req.body;
  const contacts = readData(contactsFile);
  const newContact = { id: Date.now(), title, name, email, userId };
  contacts.push(newContact);
  writeData(contactsFile, contacts);
  res.json({ message: 'Contact added', contact: newContact });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));
