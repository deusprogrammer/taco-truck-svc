const express = require('express');
const router = express.Router();
const PartModel = require('../models/partModel');

// Create a new part
router.post('/', async (req, res) => {
  try {
    const part = new PartModel(req.body);
    await part.save();
    return res.status(201).json(part);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Get all parts
router.get('/', async (req, res) => {
  try {
    const parts = await PartModel.find();
    return res.json(parts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a single part by ID
router.get('/:id', async (req, res) => {
  try {
    const part = await PartModel.findById(req.params.id);
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }
    return res.json(part);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update a part by ID
router.put('/:id', async (req, res) => {
  try {
    const part = await PartModel.findById(req.params.id);
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }
    Object.assign(part, req.body);
    await part.save();
    return res.json(part);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
