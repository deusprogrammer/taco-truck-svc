const express = require('express');
const router = express.Router();
const PanelDesign = require('../models/componetModel'); // Adjust path if needed

// Create a new project
router.post('/', async (req, res) => {
  const owner = req.user.username;
  let guestId = req.headers.guestId;
  if (req.user.roles.includes('ANONYMOUS_USER') && !guestId) {
    // Generate a cryptographically random UUID (v4)
    guestId = crypto.randomUUID();
  }
  const ownedProject = { ...req.body, owner, guestId };
  try {
    const project = new PanelDesign(ownedProject);
    await project.save();
    return res.status(201).json(project);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Get all projects (panelDimensions not [0, 0])
router.get('/', async (req, res) => {
  try {
    // Find all where panelDimensions is not exactly [0, 0]
    const projects = await PanelDesign.find({
      $or: [
        { "panelDimensions.0": { $ne: 0 } },
        { "panelDimensions.1": { $ne: 0 } }
      ]
    });
    return res.json(projects);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a single project by ID (and panelDimensions not [0, 0])
router.get('/:id', async (req, res) => {
  try {
    const project = await PanelDesign.findOne({
      _id: req.params.id,
      $or: [
        { "panelDimensions.0": { $ne: 0 } },
        { "panelDimensions.1": { $ne: 0 } }
      ]
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a single component by ID (and panelDimensions: [0, 0])
router.delete('/:id', async (req, res) => {
  try {
    const found = await PanelDesign.findOne({ _id: req.params.id });

    if (!found) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // TODO Check to see if the current user is the owner or if the user has the role "TACO_TRUCK_ADMIN"
    if (req.user.username !== found.owner && !req.user.roles.includes('TACO_TRUCK_ADMIN')) {
      return res.status(403).json({ error: 'User does not have access to delete this project' });
    }

    await PanelDesign.deleteOne({ _id: req.params.id })
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
