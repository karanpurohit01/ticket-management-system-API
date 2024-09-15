const { pool } = require('../models/db');

exports.createTicket = async (req, res) => {
  const { title, description, type, venue, status, price, priority, dueDate } = req.body;
  const createdBy = req.user.id;

  if (new Date(dueDate) <= new Date()) {
    return res.status(400).json({ message: 'Due date must be a future date' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tickets (title, description, type, venue, status, price, priority, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, type, venue, status, price, priority, dueDate, createdBy]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error creating ticket', error: err.message });
  }
};

exports.assignUserToTicket = async (req, res) => {
  const { ticketId } = req.params;
  const { userId } = req.body;

  try {
    const ticket = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);

    if (ticket.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (ticket.rows[0].status === 'closed') {
      return res.status(400).json({ message: 'Cannot assign users to a closed ticket' });
    }

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (user.rows.length === 0 || user.rows[0].type === 'admin') {
      return res.status(400).json({ message: 'User does not exist or is an admin' });
    }

    await pool.query('INSERT INTO ticket_assignments (ticket_id, user_id) VALUES ($1, $2)', [ticketId, userId]);

    res.json({ message: 'User assigned successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error assigning user', error: err.message });
  }
};


exports.getTicketDetails = async (req, res) => {
  const { ticketId } = req.params;

  try {
    const ticket = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);

    if (ticket.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const users = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN ticket_assignments ta ON u.id = ta.user_id WHERE ta.ticket_id = $1`,
      [ticketId]
    );

    res.json({
      ...ticket.rows[0],
      assignedUsers: users.rows,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving ticket details', error: err.message });
  }
};

exports.getTicketHistory = async (req, res) => {
  try {
    const { startDate, endDate, status, priority, type, venue } = req.query;

    let query = `
      SELECT t.id, t.title, t.status, t.priority, t.type, t.venue, t."created_at", t."created_by"
      FROM tickets t
      WHERE 1=1
    `;

    // Apply filters if they are provided
    if (startDate) query += ` AND t."created_at" >= '${startDate}'`;
    if (endDate) query += ` AND t."created_at" <= '${endDate}'`;
    if (status) query += ` AND t.status = '${status}'`;
    if (priority) query += ` AND t.priority = '${priority}'`;
    if (type) query += ` AND t.type = '${type}'`;
    if (venue) query += ` AND t.venue = '${venue}'`;

    const result = await pool.query(query);

    const totalTickets = result.rows.length;
    const closedTickets = result.rows.filter(ticket => ticket.status === 'closed').length;
    const openTickets = result.rows.filter(ticket => ticket.status === 'open').length;
    const inProgressTickets = result.rows.filter(ticket => ticket.status === 'in-progress').length;

    // Calculate priority distribution
    const priorityDistribution = {
      low: result.rows.filter(ticket => ticket.priority === 'low').length,
      medium: result.rows.filter(ticket => ticket.priority === 'medium').length,
      high: result.rows.filter(ticket => ticket.priority === 'high').length,
    };

    // Calculate type distribution
    const typeDistribution = result.rows.reduce((acc, ticket) => {
      acc[ticket.type] = (acc[ticket.type] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      totalTickets,
      closedTickets,
      openTickets,
      inProgressTickets,
      priorityDistribution,
      typeDistribution,
      tickets: result.rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching ticket history', error: err.message });
  }
};


exports.getTicketAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, status, priority, type, venue } = req.query;

    let query = `
      SELECT t.id, t.title, t.status, t.priority, t.type, t.venue, t.price, t."created_at", t."created_by"
      FROM tickets t
      WHERE 1=1
    `;

    // Apply filters
    if (startDate) query += ` AND t."created_at" >= '${startDate}'`;
    if (endDate) query += ` AND t."created_at" <= '${endDate}'`;
    if (status) query += ` AND t.status = '${status}'`;
    if (priority) query += ` AND t.priority = '${priority}'`;
    if (type) query += ` AND t.type = '${type}'`;
    if (venue) query += ` AND t.venue = '${venue}'`;

    const result = await pool.query(query);

    const totalTickets = result.rows.length;
    const closedTickets = result.rows.filter(ticket => ticket.status === 'closed').length;
    const openTickets = result.rows.filter(ticket => ticket.status === 'open').length;
    const inProgressTickets = result.rows.filter(ticket => ticket.status === 'in-progress').length;

    // Calculate total spending and average spending per customer
    const totalSpending = result.rows.reduce((sum, ticket) => sum + ticket.price, 0);
    const averageCustomerSpending = totalSpending / totalTickets;

    // Calculate priority and type distribution
    const priorityDistribution = {
      low: result.rows.filter(ticket => ticket.priority === 'low').length,
      medium: result.rows.filter(ticket => ticket.priority === 'medium').length,
      high: result.rows.filter(ticket => ticket.priority === 'high').length,
    };

    const typeDistribution = result.rows.reduce((acc, ticket) => {
      acc[ticket.type] = (acc[ticket.type] || 0) + 1;
      return acc;
    }, {});

    // Calculate daily booking stats
    const averageTicketsBookedPerDay = totalTickets / 30; // Assuming a 30-day period

    res.status(200).json({
      totalTickets,
      closedTickets,
      openTickets,
      inProgressTickets,
      averageCustomerSpending,
      averageTicketsBookedPerDay,
      priorityDistribution,
      typeDistribution
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching ticket analytics', error: err.message });
  }
};





