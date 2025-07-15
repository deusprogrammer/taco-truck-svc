const mongoose = require('mongoose');

/*
// Line
{ type: 'line', attributes: { start: [0, 0], end: [100, 100] } }

// Curve
{ type: 'curve', attributes: { start: [0, 0], end: [100, 0], control1: [25, 50], control2: [75, 50] } }

// Rectangle
{ type: 'rectangle', attributes: { x: 10, y: 10, width: 50, height: 30 } }

// Circle
{ type: 'circle', attributes: { cx: 50, cy: 50, r: 25 } }
*/

const TransformSchema = new mongoose.Schema({
  rotate: { type: Number, default: 0 },
  skewX: { type: Number, default: 0 },
  skewY: { type: Number, default: 0 },
  translate: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  scale: {
    x: { type: Number, default: 1 },
    y: { type: Number, default: 1 }
  }
}, { _id: false });

const PathDataChildSchema = new mongoose.Schema({
  stroke: String,
  strokeWidth: mongoose.Schema.Types.Mixed,
  fill: String,
  type: String,
  d: String,
  transform: TransformSchema,
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  rx: Number,
  ry: Number,
  cx: Number,
  cy: Number,
  r: Number,
  points: [mongoose.Schema.Types.Mixed],
  opacity: Number,
  fillOpacity: Number,
  strokeOpacity: Number,
  strokeDasharray: String,
  strokeLinecap: String,
  strokeLinejoin: String,
  strokeMiterlimit: Number,
  strokeDashoffset: Number,
  children: [this]
}, { _id: false });

const PathDataSchema = new mongoose.Schema({
  header: {
    width: String,
    height: String,
    viewBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    }
  },
  children: [PathDataChildSchema]
}, { _id: false });

const GeometrySchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['line', 'curve', 'rectangle', 'circle']
  },
  attributes: mongoose.Schema.Types.Mixed
}, { _id: false });

const PartSchema = new mongoose.Schema({
  name: String,
  geometry: [GeometrySchema],
  modelTree: PathDataSchema,
  owner: String
});

module.exports = mongoose.model('Part', PartSchema);
