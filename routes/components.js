const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const PanelDesign = require('../models/componentModel'); // Adjust path if needed

// Create a new component
router.post('/', async (req, res) => {
  try {
    const owner = req.user.username;
    let guestId = req.headers.guestId;
    if (req.user.roles.includes('ANONYMOUS_USER') && !guestId) {
      // Generate a cryptographically random UUID (v4)
      guestId = crypto.randomUUID();
    }

    const ownedProject = { ...req.body, owner, guestId };
    const component = new PanelDesign(ownedProject);
    await component.save();
    return res.status(201).json(component);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Get all components (panelDimensions: [0, 0])
router.get('/', async (req, res) => {
  try {
    const components = await PanelDesign.find({ panelDimensions: [0, 0] });
    return res.json(components);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a single component by ID (and panelDimensions: [0, 0])
router.get('/:id', async (req, res) => {
  try {
    const component = await PanelDesign.findOne({ _id: req.params.id, panelDimensions: [0, 0] });
    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }
    return res.json(component);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a single component by ID (and panelDimensions: [0, 0])
router.delete('/:id', async (req, res) => {
  try {
    const found = await PanelDesign.findOne({ _id: req.params.id, panelDimensions: [0, 0] });

    if (!found) {
      return res.status(404).json({ error: 'Component not found' });
    }

    if (req.user.username !== found.owner && !req.user.roles.includes('TACO_TRUCK_ADMIN')) {
      return res.status(403).json({ error: 'User does not have access to delete this component' });
    }

    await PanelDesign.deleteOne({ _id: req.params.id, panelDimensions: [0, 0] });

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update a single component by ID (and panelDimensions: [0, 0])
router.put('/:id', async (req, res) => {
  try {
    const found = await PanelDesign.findOne({ _id: req.params.id, panelDimensions: [0, 0] });

    if (!found) {
      return res.status(404).json({ error: 'Component not found' });
    }

    if (req.user.username !== found.owner && !req.user.roles.includes('TACO_TRUCK_ADMIN')) {
      return res.status(403).json({ error: 'User does not have access to update this component' });
    }

    // Update the component with the new data from req.body
    Object.assign(found, req.body);
    await found.save();

    return res.json(found);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
