const express = require('express');
const dotenv = require('dotenv');
const { registerUser } = require('./controllers/userController');
const { loginUser } = require('./controllers/authController');
const { createTicket, assignUserToTicket, getTicketDetails, getTicketAnalytics, getTicketHistory } = require('./controllers/ticketController');
const { authenticateJWT } = require('./middleware/authMiddleware');

dotenv.config();

const app = express();
app.use(express.json());

// User Routes
app.post('/users', registerUser);
app.post('/auth/login', loginUser);

// Ticket Routes
app.post('/tickets', authenticateJWT, createTicket);
app.post('/tickets/:ticketId/assign', authenticateJWT, assignUserToTicket);
app.get('/tickets/:ticketId', authenticateJWT, getTicketDetails);
app.get('/tickets-history', authenticateJWT, getTicketHistory);
app.get('/dashboard/analytics', authenticateJWT, getTicketAnalytics);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
