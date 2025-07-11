const express = require('express');
const router = express.Router();
const PanelDesign = require('../models/componetModel'); // Adjust path if needed
const { simplify, makerify } = require('../utils/utils');
const makerjs = require('makerjs');

const createSVG = (model) => {
  return makerjs.exporter.toSVG(model, { units: 'mm' });
}

const createDXF = (model) => {
  return makerjs.exporter.toDXF(model, { units: 'mm' });
}

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

// Get a single project by ID (and panelDimensions not [0, 0])
router.get('/:id/file.:ext', async (req, res) => {
  try {
    const project = await PanelDesign.findOne({
      _id: req.params.id,
      $or: [
        { "panelDimensions.0": { $ne: 0 } },
        { "panelDimensions.1": { $ne: 0 } }
      ]
    }).lean();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const simplified = simplify(project);
    let makerified = makerify(simplified);
    makerified = makerjs.model.mirror(makerified, false, true);

    let data, mimeType;
    if (req.params.ext === 'svg') {
      data = createSVG(makerified);
      mimeType = 'image/svg+xml;charset=utf-8';
    } else if (req.params.ext === 'dxf') {
      data = createDXF(makerified);
      mimeType = 'image/x-dxf;charset=utf-8';
    }

    if (!data || !mimeType) {
      return res.status(400).json({ error: 'Invalid export format' });
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${project._id}.${req.params.ext}"`);
    return res.send(data);
  } catch (err) {
    console.error(err);
    console.error(new Error().stack);
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

// Update a single component by ID (and panelDimensions: [0, 0])
router.put('/:id', async (req, res) => {
  try {
    const found = await PanelDesign.findOne({ _id: req.params.id });

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
